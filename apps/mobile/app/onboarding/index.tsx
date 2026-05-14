// US-008 — Disclaimer obrigatório LGPD antes de qualquer chamada Claude
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={progress.wrapper}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            progress.dot,
            i < step && progress.done,
            i === step && progress.active,
          ]}
        />
      ))}
      <Text style={progress.label}>
        Passo {step + 1} de {total}
      </Text>
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

export default function DisclaimerScreen() {
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const [loading, setLoading] = useState(false);

  async function accept() {
    if (!session?.athlete_id) return;
    setLoading(true);
    try {
      await post('/onboarding/consent', { athlete_id: session.athlete_id });
      router.push('/onboarding/profile');
    } catch {
      // Consentimento é backfillado pelo servidor ao salvar perfil — não bloqueia o fluxo
      router.push('/onboarding/profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ProgressBar step={0} total={4} />

      <Text style={styles.title}>Antes de começar</Text>
      <Text style={styles.subtitle}>Leia com atenção</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏃 O que o FitSync faz</Text>
          <Text style={styles.cardText}>
            Gera planos de corrida personalizados com IA, baseados nos seus dados do Garmin e
            métricas de carga de treino (rTSS, ACWR, HRV).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ O que o FitSync não faz</Text>
          <Text style={styles.cardText}>
            O FitSync AI <Text style={styles.bold}>não substitui</Text> acompanhamento médico,
            fisioterapêutico ou de treinador profissional. Em caso de dor, lesão ou desconforto,
            consulte um profissional de saúde.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔒 Seus dados (LGPD)</Text>
          <Text style={styles.cardText}>
            Coletamos seus dados de treino do Garmin, perfil esportivo e métricas fisiológicas para
            gerar planos personalizados. Seus dados ficam armazenados em servidores no Brasil.
            Você pode exportar ou excluir seus dados a qualquer momento nas configurações.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🤖 IA generativa</Text>
          <Text style={styles.cardText}>
            Os planos são gerados pelo Claude (Anthropic). Aplicamos guardrails automáticos de
            segurança (carga máxima, progressão) mas sempre revise o plano antes de executar.
          </Text>
        </View>
      </ScrollView>

      <Button
        label="Li e aceito os termos"
        onPress={accept}
        loading={loading}
        style={styles.btn}
        accessibilityLabel="Aceitar termos e continuar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.lg, paddingTop: Spacing.xxl },
  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, marginBottom: Spacing.md },
  scroll: { flex: 1 },
  card: {
    backgroundColor: Colors.bg,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  cardText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  bold: { fontWeight: FontWeight.bold },
  btn: { marginTop: Spacing.md },
});
