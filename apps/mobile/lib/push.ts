import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { API_URL } from './apiUrl';

// US-015 Camada 2: registra o token de push do dispositivo no backend.
// Best-effort (Camada 3): qualquer falha é engolida — sem token o sistema
// segue funcionando, só não manda notificação. Nunca lança.
export async function registerPushToken(
  athleteId: string,
  accessToken: string,
): Promise<void> {
  try {
    if (Platform.OS === 'web') return; // sem push no target web

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return; // usuário negou — ok, segue sem push

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;
    if (!token) return;

    await fetch(`${API_URL}/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ athlete_id: athleteId, token }),
    });
  } catch {
    // silencioso — push é best-effort
  }
}
