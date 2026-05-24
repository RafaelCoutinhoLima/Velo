import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { StepBar } from '../../components/StepBar';

type Step = 'form' | 'connecting' | 'importing' | 'done';

export default function GarminScreen() {
  const session = useAuthStore((s) => s.session);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  const { post } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!email.trim() || !password || !session?.athlete_id) return;
    setError(null);
    setStep('connecting');

    try {
      await post('/garmin/connect', {
        athlete_id: session.athlete_id,
        email: email.trim(),
        password,
        mfa_code: mfaCode.trim() || undefined,
      });

      setPassword('');
      setMfaCode('');

      setStep('importing');
      await post<{ synced: number }>('/garmin/sync', { athlete_id: session.athlete_id });
      setStep('done');
    } catch (e: unknown) {
      setStep('form');
      const msg = e instanceof Error ? e.message : 'Erro ao conectar Garmin';
      if (msg.toLowerCase().includes('muitas tentativas') || msg.toLowerCase().includes('rate')) {
        setError('Garmin bloqueou temporariamente. Aguarde 15 minutos e tente novamente.');
      } else if (msg.toLowerCase().includes('credencial') || msg.toLowerCase().includes('inválid')) {
        setError('E-mail ou senha incorretos. Verifique suas credenciais do Garmin Connect.');
      } else {
        setError(msg);
      }
    }
  }

  async function finish() {
    setOnboardingComplete();
    if (session?.athlete_id) {
      post('/plan/generate', { athlete_id: session.athlete_id }).catch(() => {});
    }
    router.replace('/(tabs)/plan');
  }

  if (step === 'connecting') {
    return <LoadingScreen message="Conectando ao Garmin..." subMessage="Isso pode levar alguns segundos" />;
  }

  if (step === 'importing') {
    return <LoadingScreen message="Importando seus treinos" subMessage="Buscando os últimos 90 dias do Garmin Connect" />;
  }

  if (step === 'done') {
    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark-circle" size={56} color={theme.colors.primary} />
        </View>
        <Text style={styles.doneTitle}>Garmin conectado!</Text>
        <Text style={styles.doneSub}>
          Seus treinos foram importados. Calibre suas zonas com o Teste de Cooper para um plano
          muito mais preciso — ou pule e use a estimativa por idade.
        </Text>
        <Button
          label="Calibrar minhas zonas"
          onPress={() => router.replace('/onboarding/cooper' as never)}
          style={styles.doneBtn}
          icon={<Ionicons name="pulse" size={18} color={theme.colors.onAccent} />}
          accessibilityLabel="Calibrar zonas com o Teste de Cooper"
        />
        <Button
          label="Pular e ver meu plano"
          variant="ghost"
          onPress={finish}
          style={styles.doneSkip}
          accessibilityLabel="Pular calibração e ver meu plano"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>Conecte seu Garmin</Text>
          <Text style={styles.subtitle}>
            Importamos seus últimos 90 dias e enviamos treinos direto pro relógio.
          </Text>
        </View>

        <StepBar current={2} />

        {error ? <View style={{ marginBottom: Spacing.md }}><ErrorCard message={error} /></View> : null}

        <View style={styles.trustCard}>
          <Ionicons name="lock-closed" size={20} color={theme.colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trustTitle}>Conexão segura</Text>
            <Text style={styles.trustText}>
              Suas credenciais são criptografadas (AES-256) antes de chegar aos nossos servidores.
              Nunca armazenamos sua senha — apenas o token de sessão temporário do Garmin.
            </Text>
          </View>
        </View>

        <Input
          label="E-mail do Garmin Connect"
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Input
          label="Senha"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Input
          label="Código MFA (opcional)"
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          value={mfaCode}
          onChangeText={setMfaCode}
        />

        <Button
          label="Conectar e importar treinos"
          onPress={connect}
          disabled={!email.trim() || !password}
          style={styles.btn}
          icon={<Ionicons name="watch-outline" size={18} color={theme.colors.onAccent} />}
          accessibilityLabel="Conectar Garmin e importar treinos"
        />

        <TouchableOpacity
          onPress={finish}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Pular conexão do Garmin"
        >
          <Text style={styles.skipText}>Pular por agora</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
    hero: { marginBottom: Spacing.lg },
    title: { ...theme.type.display, color: theme.colors.textPrimary },
    subtitle: { ...theme.type.body, color: theme.colors.textMuted, marginTop: Spacing.xs },
    trustCard: {
      flexDirection: 'row',
      gap: Spacing.sm,
      backgroundColor: theme.colors.accentLight,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent,
    },
    trustTitle: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    trustText: { ...theme.type.bodySm, color: theme.colors.textSecondary, marginTop: 2 },
    btn: { marginTop: Spacing.sm },
    skipBtn: { alignItems: 'center', marginTop: Spacing.md, padding: Spacing.sm },
    skipText: { ...theme.type.bodySm, color: theme.colors.textMuted },

    doneWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
      backgroundColor: theme.colors.bg,
    },
    doneIcon: {
      width: 96,
      height: 96,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    doneTitle: { ...theme.type.headline, color: theme.colors.textPrimary, textAlign: 'center' },
    doneSub: {
      ...theme.type.body,
      color: theme.colors.textMuted,
      marginTop: Spacing.sm,
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    doneBtn: { width: '100%' },
    doneSkip: { width: '100%', marginTop: Spacing.sm },
  });
