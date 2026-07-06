import Constants from 'expo-constants';

// Resolve a URL da API de forma resiliente a troca de rede/DHCP.
//
// Ordem de precedência:
// 1. EXPO_PUBLIC_API_URL — override explícito (produção/EAS ou apontar pra
//    staging). Em dev, deixe SEM definir: IP hardcoded quebra silenciosamente
//    quando a máquina muda de rede (todas as telas penduram até o timeout).
// 2. hostUri do Metro — o celular carregou o bundle desse host, então o IP é
//    garantidamente alcançável e é a mesma máquina que roda a API na :3000.
// 3. localhost — emulador/web rodando na própria máquina.
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  // Ex.: "192.168.0.39:8081" (Expo Go / dev-client). Ausente em build de
  // produção — lá o env var (baked no build) é obrigatório.
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;

  return 'http://localhost:3000';
}

export const API_URL = resolveApiUrl();
