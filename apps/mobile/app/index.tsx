import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/store';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/plan" />;
}
