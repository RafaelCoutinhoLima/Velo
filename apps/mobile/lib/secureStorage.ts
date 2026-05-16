import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store tem limite prático de ~2048 bytes por entrada. A sessão
// Supabase (JWT + refresh + user) e o store Zustand passam disso. Padrão
// oficial Supabase RN: fatiar em pedaços e remontar, mantendo tudo no
// keychain/keystore (sem AsyncStorage, sem nova dependência).
//
// Web: expo-secure-store não tem implementação nativa → fallback localStorage.
// (Em produção mobile só ios/android importam; web é dev/debug.)

const CHUNK_SIZE = 1800; // margem segura abaixo de 2048 bytes
const MANIFEST_PREFIX = '__chunks__:';
const isWeb = Platform.OS === 'web';

async function rawGet(key: string): Promise<string | null> {
  if (isWeb) return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}

async function rawSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function rawDel(key: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function chunkKey(key: string, i: number): string {
  return `${key}.${i}`;
}

async function getItem(key: string): Promise<string | null> {
  const head = await rawGet(key);
  if (head == null) return null;
  if (!head.startsWith(MANIFEST_PREFIX)) return head; // valor legado não-fatiado

  const count = Number(head.slice(MANIFEST_PREFIX.length));
  if (!Number.isInteger(count) || count <= 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await rawGet(chunkKey(key, i));
    if (part == null) return null; // pedaço faltando → trata como ausente
    parts.push(part);
  }
  return parts.join('');
}

async function setItem(key: string, value: string): Promise<void> {
  // Limpa pedaços de uma escrita anterior antes de regravar
  await removeItem(key);

  if (value.length <= CHUNK_SIZE) {
    await rawSet(key, value);
    return;
  }

  const count = Math.ceil(value.length / CHUNK_SIZE);
  for (let i = 0; i < count; i++) {
    const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await rawSet(chunkKey(key, i), slice);
  }
  await rawSet(key, `${MANIFEST_PREFIX}${count}`);
}

async function removeItem(key: string): Promise<void> {
  const head = await rawGet(key);
  if (head?.startsWith(MANIFEST_PREFIX)) {
    const count = Number(head.slice(MANIFEST_PREFIX.length));
    if (Number.isInteger(count)) {
      for (let i = 0; i < count; i++) {
        await rawDel(chunkKey(key, i));
      }
    }
  }
  await rawDel(key);
}

export const chunkedSecureStorage = { getItem, setItem, removeItem };
