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
    fetch(`${API_URL}/onboarding/profile-status?athlete_id=${session.athlete_id}`)
      .then((r) => r.json())
      .then((data: { profile_complete: boolean }) => {
        if (!cancelled && data.profile_complete) setOnboardingComplete();
      })
      .catch(() => {/* silently ignore — local state is the fallback */})
      .finally(() => { if (!cancelled) setChecking(false); });

    return () => { cancelled = true; };
  }, [_hasHydrated, session?.athlete_id, onboardingComplete]);

  if (!_hasHydrated || checking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/plan" />;
}
