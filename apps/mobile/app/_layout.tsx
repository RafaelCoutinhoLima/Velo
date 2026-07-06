import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
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
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
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
    'JetBrainsMono-SemiBold': JetBrainsMono_600SemiBold,
    'JetBrainsMono-Bold': JetBrainsMono_700Bold,
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
      <NotificationRouter />
    </>
  );
}

// Deep link das notificações push (Sprint 3): tap no lembrete de RPE abre o
// treino direto; "calibração concluída" abre o plano. Vive DENTRO do
// ThemedStack (irmão do Stack) para o efeito só rodar com a navegação montada.
function routeFromNotificationData(data: unknown): void {
  const d = data as { type?: string; workout_id?: string } | null;
  if (d?.type === 'rpe_reminder' && d.workout_id) {
    router.push(`/workout/${d.workout_id}` as never);
  } else if (d?.type === 'calibration_done') {
    router.push('/(tabs)/plan' as never);
  }
}

function NotificationRouter() {
  useEffect(() => {
    // App aberto/background: tap chega pelo listener.
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      routeFromNotificationData(resp.notification.request.content.data);
    });

    // Cold start: o app foi ABERTO pelo tap. Pequeno delay pro redirect
    // inicial do index (login/plan) assentar antes de empilhar a rota alvo.
    const timeoutId = setTimeout(() => {
      Notifications.getLastNotificationResponseAsync()
        .then((resp) => {
          if (resp) routeFromNotificationData(resp.notification.request.content.data);
        })
        .catch(() => {/* sem resposta pendente — segue o fluxo normal */});
    }, 800);

    return () => {
      sub.remove();
      clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
