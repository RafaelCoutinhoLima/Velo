import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

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

function useMetrics(athleteId: string) {
  return useQuery({
    queryKey: ['metrics', athleteId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/plan/metrics?athlete_id=${athleteId}`);
      if (!res.ok) throw new Error('Falha ao buscar métricas');
      return res.json() as Promise<{ current: CurrentMetrics | null; history: MetricsPoint[] }>;
    },
    enabled: !!athleteId,
    staleTime: 1000 * 60 * 10,
  });
}

function MetricBox({ label, value, unit, color }: { label: string; value: number | null; unit?: string; color: string }) {
  return (
    <View style={[styles.metricBox, { borderTopColor: color }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>
        {value != null ? value.toFixed(1) : '—'}
        {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function LoadChart({ history }: { history: MetricsPoint[] }) {
  if (!history.length) return <Text style={styles.noData}>Sem dados históricos</Text>;

  const maxCTL = Math.max(...history.map((h) => h.ctl ?? 0), 1);
  const lastN = history.slice(-42);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Carga (CTL) — últimas 6 semanas</Text>
      <View style={styles.bars}>
        {lastN.map((point, i) => {
          const height = Math.max(4, ((point.ctl ?? 0) / maxCTL) * 80);
          const isWeekEnd = (i + 1) % 7 === 0;
          return (
            <View key={point.date} style={styles.barWrapper}>
              <View style={[styles.bar, { height, backgroundColor: '#2563eb' }]} />
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

function acwrColor(acwr: number | null): string {
  if (acwr == null) return '#6b7280';
  if (acwr > 1.3) return '#ef4444';
  if (acwr > 1.1) return '#f97316';
  return '#22c55e';
}

export default function MetricsScreen() {
  const session = useAuthStore((s) => s.session);
  const { data, isLoading } = useMetrics(session?.athlete_id ?? '');

  if (!session) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Voltar ao plano</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Métricas técnicas</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : !data?.current ? (
        <Text style={styles.noData}>
          Métricas disponíveis após a primeira semana de treinos sincronizados.
        </Text>
      ) : (
        <>
          <View style={styles.metricsGrid}>
            <MetricBox
              label="ACWR"
              value={data.current.acwr}
              color={acwrColor(data.current.acwr)}
            />
            <MetricBox label="CTL" value={data.current.ctl} unit="TSS" color="#2563eb" />
            <MetricBox
              label="TSB"
              value={data.current.tsb}
              color={data.current.tsb > 0 ? '#22c55e' : '#f97316'}
            />
            <MetricBox label="ATL" value={data.current.atl} unit="TSS" color="#8b5cf6" />
          </View>

          <View style={styles.glossary}>
            <Text style={styles.glossaryItem}>
              <Text style={styles.bold}>ACWR</Text> — Rácio de carga aguda/crônica. Ideal entre 0,8–1,3. Acima de 1,3 = risco de lesão.
            </Text>
            <Text style={styles.glossaryItem}>
              <Text style={styles.bold}>CTL</Text> — Carga crônica (forma base). Sobe com consistência.
            </Text>
            <Text style={styles.glossaryItem}>
              <Text style={styles.bold}>TSB</Text> — Balanço de treino (forma). Positivo = mais descansado; negativo = acúmulo de fadiga.
            </Text>
          </View>

          <LoadChart history={data.history} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 40 },
  backBtn: { marginTop: 48, marginBottom: 16 },
  backText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 24 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  metricLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  metricValue: { fontSize: 28, fontWeight: '800' },
  metricUnit: { fontSize: 14, fontWeight: '400', color: '#6b7280' },
  noData: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 40, lineHeight: 22 },
  glossary: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  glossaryItem: { fontSize: 13, color: '#374151', lineHeight: 18 },
  bold: { fontWeight: '700' },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  chartTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 16 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 88 },
  barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  weekDivider: {
    position: 'absolute',
    right: -1,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  chartLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legendText: { fontSize: 10, color: '#9ca3af' },
});
