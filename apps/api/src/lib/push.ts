import { logger } from './logger';

// Envio de push via Expo Push API (sem dependência nova — só HTTPS).
// Ref: https://docs.expo.dev/push-notifications/sending-notifications/
//
// Fire-and-forget: nunca lança. Push é best-effort (US-015 Camada 3 — se
// falhar ou não houver token, o sistema segue sem bloquear nada).

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export async function sendExpoPush(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!token || !isExpoToken(token)) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', data: data ?? {} }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Expo push retornou erro');
    }
  } catch (err) {
    logger.warn({ err }, 'Falha ao enviar push (ignorado)');
  }
}
