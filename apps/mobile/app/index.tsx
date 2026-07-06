import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/store';
import { API_URL } from '../lib/apiUrl';
import { useTheme } from '../lib/theme';

// Teto da checagem no servidor. O estado local é o fallback — não vale a pena
// segurar o usuário num spinner mais que isso se a rede estiver ruim.
const PROFILE_CHECK_TIMEOUT_MS = 5_000;

export default function Index() {
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);
  const session = useAuthStore((s) => s.session);
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  // false = ainda não confirmou com o servidor se o onboarding foi concluído
  // em outro device. O redirect pro /onboarding PRECISA esperar isso: no
  // primeiro render o efeito ainda não rodou, e redirecionar já mandaria o
  // usuário pro onboarding antes da resposta chegar (race que causava o
  // "voltei pro app e caí na tela de perfil").
  const [checked, setChecked] = useState(false);
  const { theme } = useTheme();

  // Quando há sessão mas o store local diz onboarding incompleto, pergunta ao
  // servidor — o usuário pode ter completado em outro device (ou reinstalado).
  useEffect(() => {
    if (!_hasHydrated || !session?.athlete_id || onboardingComplete) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROFILE_CHECK_TIMEOUT_MS);

    // Precisa do Bearer token: /onboarding/profile-status exige auth
    // (o userId sai do token). Sem o header, tomava 401.
    fetch(`${API_URL}/onboarding/profile-status`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: { profile_complete: boolean }) => {
        if (!cancelled && data.profile_complete) setOnboardingComplete();
      })
      .catch(() => {/* silently ignore — local state is the fallback */})
      .finally(() => {
        clearTimeout(timeoutId);
        // No sucesso, setOnboardingComplete() já resolve o render via
        // onboardingComplete; `checked` só importa no caminho de erro/perfil
        // incompleto. Guarda de `cancelled` evita setState pós-unmount.
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [_hasHydrated, session?.athlete_id, onboardingComplete]);

  if (!session && _hasHydrated) return <Redirect href="/(auth)/login" />;
  if (onboardingComplete) return <Redirect href="/(tabs)/plan" />;
  if (_hasHydrated && checked) return <Redirect href="/onboarding" />;

  // Hidratando ou aguardando a checagem do servidor (máx. 5s).
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}
