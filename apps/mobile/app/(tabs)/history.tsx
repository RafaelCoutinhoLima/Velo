import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';

interface Workout {
  id: string;
  date: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  rtss: number | null;
  rpe: number | null;
  type?: string;
}

const TYPE_COLOR: Record<string, string> = {
  easy: Colors.workoutEasy,
  interval: Colors.workoutInterval,
  tempo: Colors.workoutTempo,
  long: Colors.workoutLong,
  rest: Colors.workoutRest,
  cross: Colors.workoutCross,
};

const TYPE_LABEL: Record<string, string> = {
  easy: 'Regenerativo',
  interval: 'Intervalado',
  tempo: 'Tempo',
  long: 'Longo',
  rest: 'Descanso',
  cross: 'Cross',
};

function WorkoutRow({ workout }: { workout: Workout }) {
  const typeColor = TYPE_COLOR[workout.type ?? 'easy'] ?? Colors.textMuted;
  const typeLabel = TYPE_LABEL[workout.type ?? 'easy'] ?? workout.type ?? '—';
  const distKm = workout.distance_m > 0 ? (workout.distance_m / 1000).toFixed(1) : null;
  const durMin = workout.duration_s > 0 ? Math.floor(workout.duration_s / 60) : null;

  return (
    <TouchableOpacity
      style={[styles.row, Shadow.card]}
      onPress={() => router.push(`/workout/${workout.id}`)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Treino de ${workout.date}, ${typeLabel}`}
    >
      <View style={[styles.rowAccent, { backgroundColor: typeColor }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowDate}>{workout.date}</Text>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '22' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
        </View>
        <View style={styles.rowStats}>
          {distKm ? <Text style={styles.stat}>{distKm} km</Text> : null}
          {durMin ? <Text style={styles.stat}>{durMin} min</Text> : null}
          {workout.avg_hr ? <Text style={styles.stat}>♥ {workout.avg_hr} bpm</Text> : null}
          {workout.rtss ? <Text style={styles.stat}>{workout.rtss.toFixed(0)} rTSS</Text> : null}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const session = useAuthStore((s) => s.session);
  const { get } = useApi();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['workouts', session?.athlete_id],
    queryFn: () =>
      get<{ workouts: Workout[] }>(`/workouts?athlete_id=${session?.athlete_id}&limit=50`),
    enabled: !!session?.athlete_id,
    staleTime: 1000 * 60 * 5,
  });

  if (!session) return null;
  if (isLoading) return <LoadingScreen message="Carregando histórico..." />;

  const workouts = data?.workouts ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Histórico</Text>

      {isError ? (
        <View style={styles.errorWrap}>
          <ErrorCard message="Não conseguimos carregar seu histórico. Puxe para atualizar." />
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏃</Text>
          <Text style={styles.emptyTitle}>Nenhum treino ainda</Text>
          <Text style={styles.emptyText}>
            Conecte seu Garmin nas configurações para importar seu histórico.
          </Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => <WorkoutRow workout={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, padding: Spacing.md, paddingTop: Spacing.xxl + Spacing.md },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xl },
  errorWrap: { padding: Spacing.md },
  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 72,
  },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowBody: { flex: 1, padding: Spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  rowDate: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  typeBadge: { borderRadius: Radii.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  typeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  rowStats: { flexDirection: 'row', gap: Spacing.md },
  stat: { fontSize: FontSize.xs, color: Colors.textMuted },
  chevron: { fontSize: 20, color: Colors.textMuted, paddingRight: Spacing.sm },
  sep: { height: Spacing.sm },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyIcon: { fontSize: 56, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
