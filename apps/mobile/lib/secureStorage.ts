import * as SecureStore from 'expo-secure-store';

// expo-secure-store tem limite prático de ~2048 bytes por entrada. A sessão
// Supabase (JWT + refresh + user) e o store Zustand passam disso. Padrão
// oficial Supabase RN: fatiar em pedaços e remontar, mantendo tudo no
// keychain/keystore (sem AsyncStorage, sem nova dependência).

const CHUNK_SIZE = 1800; // margem segura abaixo de 2048 bytes
const MANIFEST_PREFIX = '__chunks__:';

function chunkKey(key: string, i: number): string {
  return `${key}.${i}`;
}

async function getItem(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(key);
  if (head == null) return null;
  if (!head.startsWith(MANIFEST_PREFIX)) return head; // valor legado não-fatiado

  const count = Number(head.slice(MANIFEST_PREFIX.length));
  if (!Number.isInteger(count) || count <= 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null; // pedaço faltando → trata como ausente
    parts.push(part);
  }
  return parts.join('');
}

async function setItem(key: string, value: string): Promise<void> {
  // Limpa pedaços de uma escrita anterior antes de regravar
  await removeItem(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const count = Math.ceil(value.length / CHUNK_SIZE);
  for (let i = 0; i < count; i++) {
    const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(chunkKey(key, i), slice);
  }
  await SecureStore.setItemAsync(key, `${MANIFEST_PREFIX}${count}`);
}

async function removeItem(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  if (head?.startsWith(MANIFEST_PREFIX)) {
    const count = Number(head.slice(MANIFEST_PREFIX.length));
    if (Number.isInteger(count)) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
    }
  }
  await SecureStore.deleteItemAsync(key);
}

export const chunkedSecureStorage = { getItem, setItem, removeItem };
