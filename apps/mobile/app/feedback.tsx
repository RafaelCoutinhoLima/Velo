import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../lib/store';
import { useApi } from '../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../lib/theme';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorCard } from '../components/ErrorCard';

interface FeedbackMetrics {
  acwr?: number;
  rtss?: number;
  ctl?: number;
}

interface FeedbackData {
  feedback_md: string;
  metrics?: FeedbackMetrics;
}

function acwrColor(v: number): string {
  if (v > 1.3) return Colors.danger;
  if (v > 1.1) return Colors.warning;
  return Colors.success;
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

export default function FeedbackScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const session = useAuthStore((s) => s.session);
  const { get } = useApi();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feedback', workoutId],
    queryFn: () =>
      get<{ feedback: FeedbackData | null }>(
        `/feedback?athlete_id=${session?.athlete_id}&workout_id=${workoutId}`,
      ),
    enabled: !!workoutId && !!session?.athlete_id,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <LoadingScreen message="Buscando análise do treino..." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Voltar ao treino"
      >
        <Text style={styles.backText}>← Voltar ao treino</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Feedback do treino</Text>

      {isError ? (
        <ErrorCard message="Não conseguimos carregar o feedback. Tente novamente." />
      ) : !data?.feedback ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyTitle}>Análise ainda não disponível</Text>
          <Text style={styles.emptyText}>
            O feedback é gerado automaticamente após o treino ser processado.
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.feedbackCard, Shadow.card]}>
            <Text style={styles.feedbackText}>{data.feedback.feedback_md}</Text>
          </View>

          {data.feedback.metrics && (
            <View style={[styles.metricsCard, Shadow.card]}>
              <Text style={styles.sectionLabel}>Métricas do treino</Text>
              {data.feedback.metrics.acwr != null && (
                <MetricRow
                  label="ACWR (carga aguda/crônica)"
                  value={data.feedback.metrics.acwr.toFixed(2)}
                  color={acwrColor(data.feedback.metrics.acwr)}
                />
              )}
              {data.feedback.metrics.rtss != null && (
                <MetricRow
                  label="rTSS do treino"
                  value={data.feedback.metrics.rtss.toFixed(1)}
                />
              )}
              {data.feedback.metrics.ctl != null && (
                <MetricRow
                  label="Forma (CTL)"
                  value={data.feedback.metrics.ctl.toFixed(1)}
                  color={Colors.primary}
                />
              )}
            </View>
          )}

          <Text style={styles.disclaimer}>
            FitSync não substitui acompanhamento médico ou de um profissional de saúde.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  backBtn: { marginTop: Spacing.xxl + Spacing.lg, marginBottom: Spacing.md },
  backText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  feedbackCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  feedbackText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 26 },
  metricsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metricLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  metricValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyWrap: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  disclaimer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
});
