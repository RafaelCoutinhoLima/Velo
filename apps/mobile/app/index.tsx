import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/store';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/plan" />;
}
