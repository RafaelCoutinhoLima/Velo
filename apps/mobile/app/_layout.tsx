import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import {
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { queryClient, persister } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { registerPushToken } from '../lib/push';
import { ThemeProvider, useTheme } from '../lib/theme';

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  // Fontes do design system. As chaves batem com Fonts (theme.tokens.ts).
  // Se a carga falhar, o RN cai no sistema — telas seguem funcionando.
  const [fontsLoaded, fontError] = useFonts({
    'HankenGrotesk-Bold': HankenGrotesk_700Bold,
    'HankenGrotesk-ExtraBold': HankenGrotesk_800ExtraBold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'JetBrainsMono-Medium': JetBrainsMono_500Medium,
  });

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

  // Espera as fontes (ou um erro de carga) antes de pintar a UI — evita flash
  // de fonte do sistema. Em erro, segue com o fallback do sistema.
  if (!fontsLoaded && !fontError) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

// Stack envolto pelo Theme — StatusBar e fundo seguem a identidade ativa.
function ThemedStack() {
  const { theme } = useTheme();
  return (
    <>
      <StatusBar style={theme.statusBar} backgroundColor={theme.colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'fade',
        }}
      />
    </>
  );
}
