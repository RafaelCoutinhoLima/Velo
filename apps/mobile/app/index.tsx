import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/store';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  return <Redirect href={session ? '/(tabs)/plan' : '/(auth)/login'} />;
}
