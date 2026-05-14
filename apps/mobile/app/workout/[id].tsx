import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
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

interface Workout {
  id: string;
  date: string;
  type?: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  rtss: number | null;
  description?: string;
  feedback_md?: string;
  rpe?: number | null;
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const { get, patch } = useApi();

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
      setRpeError('Não conseguimos salvar o RPE. Tente novamente.');
    } finally {
      setSavingRpe(false);
    }
  }

  if (isLoading) return <LoadingScreen message="Carregando treino..." />;

  if (isError || !data?.workout) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <ErrorCard message="Treino não encontrado ou falha ao carregar." />
      </ScrollView>
    );
  }

  const workout = data.workout;
  const typeConfig = TYPE_CONFIG[workout.type ?? 'easy'] ?? TYPE_CONFIG.easy;
  const distKm = workout.distance_m > 0 ? (workout.distance_m / 1000).toFixed(1) : null;
  const durMin = workout.duration_s > 0 ? Math.floor(workout.duration_s / 60) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={[styles.headerCard, Shadow.card, { borderLeftColor: typeConfig.color }]}>
        <View style={[styles.typeDot, { backgroundColor: typeConfig.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerType}>{typeConfig.label.toUpperCase()}</Text>
          <Text style={styles.headerDate}>{workout.date}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsCard, Shadow.card]}>
        <View style={styles.statGroup}>
          <Text style={styles.statValue}>{distKm ?? '—'}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statGroup}>
          <Text style={styles.statValue}>{durMin != null ? String(durMin) : '—'}</Text>
          <Text style={styles.statLabel}>min</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statGroup}>
          <Text style={styles.statValue}>{workout.avg_hr != null ? String(workout.avg_hr) : '—'}</Text>
          <Text style={styles.statLabel}>bpm</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statGroup}>
          <Text style={styles.statValue}>{workout.rtss != null ? workout.rtss.toFixed(1) : '—'}</Text>
          <Text style={styles.statLabel}>rTSS</Text>
        </View>
      </View>

      {/* Description */}
      {workout.description ? (
        <View style={[styles.card, Shadow.card]}>
          <Text style={styles.cardLabel}>Treino prescrito</Text>
          <Text style={styles.cardText}>{workout.description}</Text>
        </View>
      ) : null}

      {/* RPE */}
      <View style={[styles.card, Shadow.card]}>
        <Text style={styles.cardLabel}>Como foi o esforço? (RPE 1–10)</Text>
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
          <Text style={styles.rpeStatus}>Salvando...</Text>
        ) : rpe && !rpeError ? (
          <Text style={[styles.rpeStatus, { color: Colors.success }]}>RPE {rpe} salvo</Text>
        ) : null}
        {rpeError ? (
          <View style={{ marginTop: Spacing.sm }}>
            <ErrorCard message={rpeError} />
          </View>
        ) : null}
      </View>

      {/* Feedback CTA */}
      {workout.feedback_md ? (
        <TouchableOpacity
          style={[styles.feedbackBtn, Shadow.card]}
          onPress={() => router.push(`/feedback?workoutId=${id}`)}
          accessibilityRole="button"
          accessibilityLabel="Ver análise completa do treino"
        >
          <Text style={styles.feedbackBtnText}>Ver análise do treino →</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  backBtn: { marginTop: Spacing.xxl + Spacing.lg, marginBottom: Spacing.md },
  backText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderLeftWidth: 4,
  },
  typeDot: { width: 12, height: 12, borderRadius: Radii.full },
  headerType: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerDate: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statGroup: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  card: { backgroundColor: Colors.surface, borderRadius: Radii.md, padding: Spacing.md, marginBottom: Spacing.sm },
  cardLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  cardText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  rpeSelected: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
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
  feedbackBtn: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  feedbackBtnText: { color: Colors.accent, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});
