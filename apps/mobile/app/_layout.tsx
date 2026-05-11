import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession({
          access_token: data.session.access_token,
          athlete_id: data.session.user.id,
        });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession({ access_token: session.access_token, athlete_id: session.user.id });
      } else {
        clearSession();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <Stack screenOptions={{ headerShown: false }} />
    </PersistQueryClientProvider>
  );
}
