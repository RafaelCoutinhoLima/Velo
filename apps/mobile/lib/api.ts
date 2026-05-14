import { useAuthStore } from './store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = 15_000;

async function request<T>(
  method: string,
  path: string,
  accessToken: string | undefined,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Resposta inválida do servidor');
    }

    if (!res.ok) {
      const errMsg = (data as { error?: string }).error ?? `Erro HTTP ${res.status}`;
      throw new Error(errMsg);
    }

    return data as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('A conexão demorou demais. Verifique sua internet.');
    }
    throw err;
  }
}

export function useApi() {
  const session = useAuthStore((s) => s.session);
  const token = session?.access_token;

  return {
    get: <T>(path: string) => request<T>('GET', path, token),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, token, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, token, body),
  };
}
