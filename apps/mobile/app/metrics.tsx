import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../lib/store';
import { useApi } from '../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../lib/theme';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorCard } from '../components/ErrorCard';

interface MetricsPoint {
  date: string;
  ctl: number;
  tsb: number;
  acwr: number;
}

interface CurrentMetrics {
  date: string;
  atl: number;
  ctl: number;
  tsb: number;
  acwr: number;
}

function acwrColor(acwr: number | null): string {
  if (acwr == null) return Colors.textMuted;
  if (acwr > 1.3) return Colors.danger;
  if (acwr > 1.1) return Colors.warning;
  return Colors.success;
}

function MetricBox({
  label,
  value,
  unit,
  color,
  description,
}: {
  label: string;
  value: number | null;
  unit?: string;
  color: string;
  description: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.metricBox, { borderTopColor: color }, Shadow.card]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value != null ? value.toFixed(1) : 'sem dados'}${unit ? ' ' + unit : ''}. Toque para ${expanded ? 'recolher' : 'ver'} descrição`}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>
        {value != null ? value.toFixed(1) : '—'}
        {unit && value != null ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
      {expanded && <Text style={styles.metricDesc}>{description}</Text>}
    </TouchableOpacity>
  );
}

function LoadChart({ history }: { history: MetricsPoint[] }) {
  if (!history.length) {
    return (
      <View style={[styles.chartBox, Shadow.card]}>
        <Text style={styles.noData}>Sem dados históricos suficientes</Text>
      </View>
    );
  }

  const lastN = history.slice(-42);
  const maxCTL = Math.max(...lastN.map((h) => h.ctl ?? 0), 1);

  return (
    <View style={[styles.chartBox, Shadow.card]}>
      <Text style={styles.chartTitle}>Carga (CTL) — últimas 6 semanas</Text>
      <View style={styles.bars}>
        {lastN.map((point, i) => {
          const height = Math.max(4, ((point.ctl ?? 0) / maxCTL) * 80);
          const isWeekEnd = (i + 1) % 7 === 0;
          return (
            <View key={point.date} style={styles.barWrapper}>
              <View style={[styles.bar, { height, backgroundColor: Colors.primary }]} />
              {isWeekEnd ? <View style={styles.weekDivider} /> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.chartLegend}>
        <Text style={styles.legendText}>← 6 semanas atrás</Text>
        <Text style={styles.legendText}>Hoje →</Text>
      </View>
    </View>
  );
}

export default function MetricsScreen() {
  const session = useAuthStore((s) => s.session);
  const { get } = useApi();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['metrics', session?.athlete_id],
    queryFn: () =>
      get<{ current: CurrentMetrics | null; history: MetricsPoint[] }>(
        `/plan/metrics?athlete_id=${session?.athlete_id}`,
      ),
    enabled: !!session?.athlete_id,
    staleTime: 1000 * 60 * 10,
  });

  if (!session) return null;
  if (isLoading) return <LoadingScreen message="Carregando métricas..." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Voltar ao plano"
      >
        <Text style={styles.backText}>← Voltar ao plano</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Métricas técnicas</Text>
      <Text style={styles.subtitle}>Toque em uma métrica para ver a descrição</Text>

      {isError ? (
        <ErrorCard message="Não conseguimos carregar suas métricas. Tente novamente." />
      ) : !data?.current ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.noData}>
            Métricas disponíveis após sincronizar pelo menos uma semana de treinos.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.metricsGrid}>
            <MetricBox
              label="ACWR"
              value={data.current.acwr}
              color={acwrColor(data.current.acwr)}
              description="Rácio de carga aguda/crônica. Ideal entre 0,8–1,3. Acima de 1,3 = risco elevado de lesão."
            />
            <MetricBox
              label="CTL"
              value={data.current.ctl}
              unit="TSS"
              color={Colors.primary}
              description="Carga crônica (fitness de base). Sobe com treino consistente ao longo de semanas."
            />
            <MetricBox
              label="TSB"
              value={data.current.tsb}
              color={data.current.tsb >= 0 ? Colors.success : Colors.warning}
              description="Balanço de treino (forma). Positivo = mais descansado e fresco; negativo = fadiga acumulada."
            />
            <MetricBox
              label="ATL"
              value={data.current.atl}
              unit="TSS"
              color={Colors.workoutCross}
              description="Carga aguda (fadiga recente dos últimos 7 dias). Sobe rapidamente com volume intenso."
            />
          </View>

          <LoadChart history={data.history} />
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
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  metricBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderTopWidth: 3,
    flex: 1,
    minWidth: '45%',
  },
  metricLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  metricValue: { fontSize: 28, fontWeight: FontWeight.extrabold, fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: FontSize.sm, fontWeight: FontWeight.regular, color: Colors.textMuted },
  metricDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  noData: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  emptyWrap: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  chartBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  chartTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.md },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 88 },
  barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  weekDivider: { position: 'absolute', right: -1, top: 0, bottom: 0, width: 1, backgroundColor: Colors.border },
  chartLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  legendText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
