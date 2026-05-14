import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';

const LIGHT = '300' as const;
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  easy:     { label: 'Regenerativo', color: Colors.workoutEasy },
  interval: { label: 'Intervalado',  color: Colors.workoutInterval },
  tempo:    { label: 'Tempo',        color: Colors.workoutTempo },
  long:     { label: 'Longo',        color: Colors.workoutLong },
  rest:     { label: 'Descanso',     color: Colors.workoutRest },
  cross:    { label: 'Cross',        color: Colors.workoutCross },
};

const RPE_LABELS: Record<number, string> = {
  1: 'Muito fácil', 2: 'Fácil', 3: 'Leve', 4: 'Moderado', 5: 'Razoável',
  6: 'Intenso', 7: 'Difícil', 8: 'Muito difícil', 9: 'Extenuante', 10: 'Máximo',
};

function rpeColor(n: number): string {
  if (n <= 3) return Colors.workoutEasy;
  if (n <= 5) return Colors.workoutTempo;
  if (n <= 7) return Colors.warning;
  return Colors.danger;
}

function formatPace(paceS: number): string {
  const min = Math.floor(paceS / 60);
  const sec = paceS % 60;
  return `${min}'${String(sec).padStart(2, '0')}"`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (s > 0) return `${m}m${String(s).padStart(2, '0')}s`;
  return `${m}min`;
}

interface Workout {
  id: string;
  date: string;
  type?: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  max_hr: number | null;
  rtss: number | null;
  rpe?: number | null;
  avg_pace_s: number | null;
  calories: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  vo2max: number | null;
  steps: number | null;
  activity_name: string | null;
  location: string | null;
  description?: string;
  feedback_md?: string;
}

function StatBox({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MetricRow({ items }: { items: { icon: string; value: string; label: string }[] }) {
  return (
    <View style={styles.metricRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.metricItem}>
          <Text style={styles.metricIcon}>{item.icon}</Text>
          <View>
            <Text style={styles.metricValue}>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const { get, patch } = useApi();
  const insets = useSafeAreaInsets();

  const [rpe, setRpe] = useState<number | null>(null);
  const [savingRpe, setSavingRpe] = useState(false);
  const [rpeError, setRpeError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workout', id],
    queryFn: () => get<{ workout: Workout }>(`/workouts/${id}`),
    enabled: !!id && !!session,
  });

  useEffect(() => {
    if (data?.workout.rpe != null) setRpe(data.workout.rpe);
  }, [data?.workout.rpe]);

  async function saveRpe(value: number) {
    setRpe(value);
    setSavingRpe(true);
    setRpeError(null);
    try {
      await patch(`/workouts/${id}`, { rpe: value });
    } catch {
      setRpeError('Não conseguimos salvar. Tente novamente.');
    } finally {
      setSavingRpe(false);
    }
  }

  const headerStyle = { paddingTop: insets.top + Spacing.sm };

  if (isLoading) return <LoadingScreen message="Carregando treino..." />;

  if (isError || !data?.workout) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBar}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Voltar</Text>
        </TouchableOpacity>
        <View style={styles.content}>
          <ErrorCard message="Treino não encontrado ou falha ao carregar." />
        </View>
      </View>
    );
  }

  const w = data.workout;
  const typeConfig = TYPE_CONFIG[w.type ?? 'easy'] ?? TYPE_CONFIG.easy;
  const distKm = w.distance_m > 0 ? (w.distance_m / 1000).toFixed(1) : '—';

  return (
    <View style={styles.container}>
      {/* ── Back bar ── */}
      <TouchableOpacity
        style={[styles.backBar, headerStyle]}
        onPress={() => router.back()}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Voltar para histórico"
      >
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Voltar</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ── */}
        <View style={[styles.heroCard, Shadow.card, { borderLeftColor: typeConfig.color }]}>
          <View style={styles.heroTop}>
            <View style={[styles.typePill, { backgroundColor: typeConfig.color + '20' }]}>
              <View style={[styles.typeDot, { backgroundColor: typeConfig.color }]} />
              <Text style={[styles.typePillText, { color: typeConfig.color }]}>
                {typeConfig.label.toUpperCase()}
              </Text>
            </View>
            {w.rtss != null && (
              <View style={styles.rtssChip}>
                <Text style={styles.rtssText}>{w.rtss.toFixed(1)} rTSS</Text>
              </View>
            )}
          </View>

          {w.activity_name ? (
            <Text style={styles.activityName}>{w.activity_name}</Text>
          ) : null}

          <View style={styles.heroMeta}>
            <Text style={styles.heroDate}>{formatDate(w.date)}</Text>
            {w.location ? <Text style={styles.heroSep}>·</Text> : null}
            {w.location ? <Text style={styles.heroLocation}>📍 {w.location}</Text> : null}
          </View>
        </View>

        {/* ── Hero stats: distance · pace · duration ── */}
        <View style={[styles.statsHero, Shadow.card]}>
          <StatBox value={`${distKm}`} label="km" />
          <View style={styles.statDivider} />
          <StatBox
            value={w.avg_pace_s ? formatPace(w.avg_pace_s) : '—'}
            label="pace médio"
            highlight
          />
          <View style={styles.statDivider} />
          <StatBox
            value={w.duration_s > 0 ? formatDuration(w.duration_s) : '—'}
            label="tempo"
          />
        </View>

        {/* ── Metrics grid ── */}
        <View style={[styles.metricsCard, Shadow.card]}>
          <MetricRow
            items={[
              {
                icon: '♥',
                value: w.avg_hr != null ? `${w.avg_hr} bpm` : '—',
                label: 'FC média',
              },
              {
                icon: '♥',
                value: w.max_hr != null ? `${w.max_hr} bpm` : '—',
                label: 'FC máx',
              },
            ]}
          />
          <View style={styles.metricDivider} />
          <MetricRow
            items={[
              {
                icon: '🔥',
                value: w.calories != null ? `${w.calories} kcal` : '—',
                label: 'Calorias',
              },
              {
                icon: '👣',
                value: w.steps != null ? w.steps.toLocaleString('pt-BR') : '—',
                label: 'Passos',
              },
            ]}
          />
          <View style={styles.metricDivider} />
          <MetricRow
            items={[
              {
                icon: '↑',
                value: w.elevation_gain != null ? `${w.elevation_gain}m` : '—',
                label: 'Ganho alt.',
              },
              {
                icon: '↓',
                value: w.elevation_loss != null ? `${w.elevation_loss}m` : '—',
                label: 'Perda alt.',
              },
            ]}
          />
          {w.vo2max != null && (
            <>
              <View style={styles.metricDivider} />
              <MetricRow
                items={[
                  { icon: '🫁', value: `${w.vo2max}`, label: 'VO₂ máx estimado' },
                ]}
              />
            </>
          )}
        </View>

        {/* ── RPE (opcional) ── */}
        <View style={[styles.rpeCard, Shadow.card]}>
          <Text style={styles.rpeTitle}>Esforço percebido (opcional)</Text>
          <Text style={styles.rpeSub}>
            Como você sentiu esse treino? Ajuda a calibrar seu plano.
          </Text>
          {rpe != null && (
            <Text style={[styles.rpeSelected, { color: rpeColor(rpe) }]}>
              {rpe} — {RPE_LABELS[rpe]}
            </Text>
          )}
          <View style={styles.rpeRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.rpeBtn,
                  rpe === n && { backgroundColor: rpeColor(n), borderColor: rpeColor(n) },
                ]}
                onPress={() => saveRpe(n)}
                accessibilityRole="button"
                accessibilityLabel={`RPE ${n}: ${RPE_LABELS[n]}`}
                accessibilityState={{ selected: rpe === n }}
              >
                <Text style={[styles.rpeBtnText, rpe === n && styles.rpeBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {savingRpe ? (
            <Text style={styles.rpeStatus}>Salvando…</Text>
          ) : rpe && !rpeError ? (
            <Text style={[styles.rpeStatus, { color: Colors.success }]}>Salvo ✓</Text>
          ) : null}
          {rpeError ? (
            <View style={{ marginTop: Spacing.sm }}>
              <ErrorCard message={rpeError} />
            </View>
          ) : null}
        </View>

        {/* ── Feedback CTA ── */}
        {w.feedback_md ? (
          <TouchableOpacity
            style={[styles.feedbackBtn, Shadow.card]}
            onPress={() => router.push(`/feedback?workoutId=${id}`)}
            accessibilityRole="button"
            accessibilityLabel="Ver análise completa do treino"
          >
            <Text style={styles.feedbackText}>Ver análise do treino →</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 4,
    minHeight: 52,
    backgroundColor: Colors.bg,
  },
  backArrow: {
    fontSize: 32,
    color: Colors.primary,
    fontWeight: LIGHT,
    lineHeight: 36,
    marginTop: -2,
  },
  backLabel: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },

  // Hero header
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    gap: Spacing.xs,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  typeDot: { width: 8, height: 8, borderRadius: Radii.full },
  typePillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  rtssChip: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  rtssText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold },
  activityName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  heroDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  heroSep: { fontSize: FontSize.sm, color: Colors.border },
  heroLocation: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Hero stats
  statsHero: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  statValueHighlight: { color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  // Metrics grid
  metricsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  metricRow: { flexDirection: 'row', paddingVertical: Spacing.sm },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metricIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  metricValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  metricDivider: { height: 1, backgroundColor: Colors.border },

  // RPE
  rpeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  rpeTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  rpeSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  rpeSelected: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  rpeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  rpeBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  rpeBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted },
  rpeBtnTextActive: { color: Colors.surface },
  rpeStatus: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm },

  // Feedback
  feedbackBtn: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  feedbackText: { color: Colors.accent, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});
