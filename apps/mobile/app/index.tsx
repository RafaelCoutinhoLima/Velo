import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/store';
import { useTheme } from '../lib/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function Index() {
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);
  const session = useAuthStore((s) => s.session);
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  const [checking, setChecking] = useState(false);
  const { theme } = useTheme();

  // When a session exists but local store says onboarding incomplete,
  // ask the server — the user may have completed it on another device.
  useEffect(() => {
    if (!_hasHydrated || !session?.athlete_id || onboardingComplete) return;

    let cancelled = false;
    setChecking(true);
    // Precisa do Bearer token: /onboarding/profile-status agora exige auth
    // (o userId sai do token). Sem o header, tomava 401 e o retorno pós-login
    // caía sempre no onboarding.
    fetch(`${API_URL}/onboarding/profile-status`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data: { profile_complete: boolean }) => {
        if (!cancelled && data.profile_complete) setOnboardingComplete();
      })
      .catch(() => {/* silently ignore — local state is the fallback */})
      // Sem guarda de `cancelled`: setOnboardingComplete() re-dispara o efeito
      // e o cleanup roda antes do finally — checking ficaria true pra sempre.
      .finally(() => setChecking(false));

    return () => { cancelled = true; };
  }, [_hasHydrated, session?.athlete_id, onboardingComplete]);

  if (!_hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (onboardingComplete) return <Redirect href="/(tabs)/plan" />;
  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  return <Redirect href="/onboarding" />;
}
