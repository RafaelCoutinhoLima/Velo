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

const STEPS = ['Perfil', 'Objetivo', 'Garmin', 'Pronto'];

function StepBar({ current }: { current: number }) {
  return (
    <View style={sb.row}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={sb.stepWrap}>
            <View style={[sb.pill, done && sb.pillDone, active && sb.pillActive]}>
              {done ? (
                <Text style={sb.pillTextDone}>✓</Text>
              ) : (
                <Text style={[sb.pillNum, active && sb.pillNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[sb.label, active && sb.labelActive, done && sb.labelDone]}>{label}</Text>
            {i < STEPS.length - 1 && <View style={[sb.connector, done && sb.connectorDone]} />}
          </View>
        );
      })}
    </View>
  );
}
const sb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginBottom: Spacing.xl },
  stepWrap: { alignItems: 'center', position: 'relative', flex: 1 },
  pill: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4, zIndex: 1,
  },
  pillActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  pillDone: { borderColor: Colors.success, backgroundColor: Colors.success },
  pillNum: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textMuted },
  pillNumActive: { color: Colors.surface },
  pillTextDone: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.surface },
  label: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.medium, textAlign: 'center' },
  labelActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  labelDone: { color: Colors.success },
  connector: { position: 'absolute', top: 15, right: '-50%', left: '50%', height: 2, backgroundColor: Colors.border, zIndex: 0 },
  connectorDone: { backgroundColor: Colors.success },
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
      <View style={styles.centered}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Garmin conectado!</Text>
        <Text style={styles.doneSub}>
          Seus treinos foram importados. Calibre suas zonas com o Teste de Cooper para um plano
          muito mais preciso — ou pule e use a estimativa por idade.
        </Text>
        <Button
          label="Calibrar minhas zonas"
          onPress={() => router.replace('/onboarding/cooper' as never)}
          style={styles.doneBtn}
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
        <View style={styles.heroSection}>
          <Text style={styles.title}>Conecte{'\n'}seu Garmin</Text>
          <Text style={styles.subtitle}>
            Importamos seus últimos 90 dias e enviamos treinos direto pro relógio.
          </Text>
        </View>

        <StepBar current={2} />

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
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  heroSection: { marginBottom: Spacing.xl },
  title: { fontSize: 32, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, lineHeight: 40, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, lineHeight: 22 },
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
  doneSkip: { width: '100%', marginTop: Spacing.sm },
});
