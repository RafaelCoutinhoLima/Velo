// US-002 — Conectar Garmin via sidecar + US-005 importar 90 dias
import { useState } from 'react';
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
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={progress.wrapper}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[progress.dot, i < step && progress.done, i === step && progress.active]} />
      ))}
      <Text style={progress.label}>Passo {step + 1} de {total}</Text>
    </View>
  );
}
const progress = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radii.full, backgroundColor: Colors.border },
  active: { backgroundColor: Colors.primary, width: 24, borderRadius: Radii.full },
  done: { backgroundColor: Colors.primaryMuted },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: Spacing.sm },
});

type Step = 'form' | 'connecting' | 'importing' | 'done';

export default function GarminScreen() {
  const session = useAuthStore((s) => s.session);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  const { post } = useApi();
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

      // Limpa credenciais da memória imediatamente após envio bem-sucedido
      setPassword('');
      setMfaCode('');

      setStep('importing');
      await post<{ synced: number }>('/garmin/sync', { athlete_id: session.athlete_id });
      setStep('done');
    } catch (e: unknown) {
      setStep('form');
      setError(e instanceof Error ? e.message : 'Erro ao conectar Garmin');
    }
  }

  async function finish() {
    setOnboardingComplete();
    if (session?.athlete_id) {
      fetch(`${API_URL}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: session.athlete_id }),
      }).catch(() => {
        // Falha silenciosa — job async garante reprocessamento
      });
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
      <View style={styles.centered}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Garmin conectado!</Text>
        <Text style={styles.doneSub}>
          Seus treinos foram importados e seu primeiro plano está sendo gerado.
        </Text>
        <Button label="Ver meu plano" onPress={finish} style={styles.doneBtn} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ProgressBar step={3} total={4} />

        <Text style={styles.title}>Conectar Garmin</Text>
        <Text style={styles.subtitle}>
          Usamos seu Garmin Connect para importar treinos passados e enviar treinos para o relógio.
        </Text>

        {error ? <View style={{ marginBottom: Spacing.md }}><ErrorCard message={error} /></View> : null}

        <View style={[styles.trustCard, Shadow.card]}>
          <Text style={styles.trustTitle}>🔒 Conexão segura</Text>
          <Text style={styles.trustText}>
            Suas credenciais são criptografadas (AES-256) antes de chegar aos nossos servidores.
            Nunca armazenamos sua senha — apenas o token de sessão temporário gerado pelo Garmin.
          </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 22 },
  trustCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  trustTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  trustText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 20 },
  btn: { marginTop: Spacing.sm },
  skipBtn: { alignItems: 'center', marginTop: Spacing.md, padding: Spacing.sm },
  skipText: { color: Colors.textMuted, fontSize: FontSize.sm },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface },
  doneIcon: { fontSize: 56, marginBottom: Spacing.md },
  doneTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  doneSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  doneBtn: { width: '100%' },
});
