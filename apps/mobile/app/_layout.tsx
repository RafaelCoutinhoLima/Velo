import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { registerPushToken } from '../lib/push';
import { Colors } from '../lib/theme';

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
        // US-015 Camada 2 — best-effort, nunca bloqueia
        registerPushToken(data.session.user.id, data.session.access_token);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession({ access_token: session.access_token, athlete_id: session.user.id });
        registerPushToken(session.user.id, session.access_token);
      } else {
        clearSession();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'fade',
        }}
      />
    </PersistQueryClientProvider>
  );
}
