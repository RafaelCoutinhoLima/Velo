import { useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, Radii, Spacing, Tracking, useTheme, type Theme } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { TopBar } from '../../components/TopBar';

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

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TYPE_LABEL: Record<string, string> = {
  easy: 'Rodagem',
  interval: 'Intervalado',
  tempo: 'Tempo',
  long: 'Longo',
  rest: 'Descanso',
  cross: 'Cross',
};

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  easy: 'footsteps-outline',
  interval: 'timer-outline',
  tempo: 'speedometer-outline',
  long: 'footsteps-outline',
  rest: 'bed-outline',
  cross: 'bicycle-outline',
};

// "2026-05-15" → "15 Mai"
function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${PT_MONTHS[parseInt(m, 10) - 1] ?? ''}`;
}

// segundos → "1h02" ou "45m"
function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}`;
}

// pace médio em "M:SS" por km
function formatPace(distanceM: number, durationS: number): string | null {
  if (distanceM <= 0 || durationS <= 0) return null;
  const paceS = Math.round(durationS / (distanceM / 1000));
  const m = Math.floor(paceS / 60);
  const s = paceS % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const session = useAuthStore((s) => s.session);
  const { get } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const TYPE_COLOR: Record<string, string> = {
    easy: theme.colors.workoutEasy,
    interval: theme.colors.workoutInterval,
    tempo: theme.colors.workoutTempo,
    long: theme.colors.workoutLong,
    rest: theme.colors.workoutRest,
    cross: theme.colors.workoutCross,
  };

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['workouts', session?.athlete_id],
    queryFn: () =>
      get<{ workouts: Workout[] }>(`/workouts?athlete_id=${session?.athlete_id}&limit=50`),
    enabled: !!session?.athlete_id,
    staleTime: 1000 * 60 * 5,
  });

  // ── Mini-heatmap de frequência da semana corrente ─────────────────────
  function FrequencyStrip({ workouts }: { workouts: Workout[] }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // domingo

    const workoutDates = new Set(workouts.map((w) => w.date));
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const bars = labels.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const hasWorkout = workoutDates.has(iso);
      const isFuture = d.getTime() > today.getTime();
      const isToday = d.getTime() === today.getTime();
      return { hasWorkout, isFuture, isToday };
    });

    return (
      <View style={styles.freqSection}>
        <View style={styles.freqHeader}>
          <Text style={styles.freqTitle}>Frequência</Text>
          <Text style={styles.freqHint}>Esta semana</Text>
        </View>
        <View style={styles.freqBars}>
          {bars.map((b, i) => (
            <View
              key={i}
              style={[
                styles.freqBar,
                b.hasWorkout && styles.freqBarActive,
                b.isToday && !b.hasWorkout && styles.freqBarToday,
                b.isFuture && styles.freqBarFuture,
              ]}
            />
          ))}
        </View>
        <View style={styles.freqLabels}>
          {labels.map((l, i) => (
            <Text key={i} style={styles.freqLabel}>{l}</Text>
          ))}
        </View>
      </View>
    );
  }

  function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
      <View style={styles.stat}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>
          {value}
          {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
        </Text>
      </View>
    );
  }

  function WorkoutCard({ workout }: { workout: Workout }) {
    const type = workout.type ?? 'easy';
    const tint = TYPE_COLOR[type] ?? theme.colors.textMuted;
    const label = TYPE_LABEL[type] ?? type;
    const distKm = workout.distance_m > 0 ? (workout.distance_m / 1000).toFixed(1) : '—';
    const dur = workout.duration_s > 0 ? formatDuration(workout.duration_s) : '—';
    const pace = formatPace(workout.distance_m, workout.duration_s);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/workout/${workout.id}`)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Treino de ${formatDateShort(workout.date)}, ${label}`}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardDate}>{formatDateShort(workout.date)}</Text>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{label}</Text>
              {workout.rtss != null ? (
                <Text style={[styles.zoneBadge, { color: tint, borderColor: tint + '44' }]}>
                  {workout.rtss.toFixed(0)} rTSS
                </Text>
              ) : null}
            </View>
          </View>
          <View style={[styles.typeIcon, { backgroundColor: tint + '1A' }]}>
            <Ionicons name={TYPE_ICON[type] ?? 'footsteps-outline'} size={20} color={tint} />
          </View>
        </View>

        <View style={styles.cardStats}>
          <Stat label="Distância" value={distKm} unit="km" />
          <Stat label="Tempo" value={dur} unit={workout.duration_s >= 3600 ? '' : 'm'} />
          <Stat label="Pace" value={pace ?? '—'} unit={pace ? '/km' : ''} />
        </View>
      </TouchableOpacity>
    );
  }

  if (!session) return null;
  if (isLoading) {
    return (
      <View style={styles.container}>
        <TopBar />
        <LoadingScreen message="Carregando histórico..." />
      </View>
    );
  }

  const workouts = data?.workouts ?? [];

  return (
    <View style={styles.container}>
      <TopBar />

      {isError ? (
        <View style={styles.errorWrap}>
          <ErrorCard message="Não conseguimos carregar seu histórico. Puxe para atualizar." />
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="footsteps-outline" size={36} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Nenhum treino ainda</Text>
          <Text style={styles.emptyText}>
            Conecte seu Garmin nas configurações para importar seu histórico.
          </Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => <WorkoutCard workout={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <Text style={styles.screenTitle}>Histórico</Text>
              <FrequencyStrip workouts={workouts} />
              <Text style={styles.listLabel}>Treinos</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    screenTitle: { ...theme.type.headline, color: theme.colors.textPrimary, marginBottom: Spacing.md },
    errorWrap: { padding: Spacing.md },

    // Frequency strip
    freqSection: { marginBottom: Spacing.lg },
    freqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    freqTitle: { ...theme.type.subtitle, fontSize: FontSize.md, color: theme.colors.textPrimary },
    freqHint: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.primary,
    },
    freqBars: { flexDirection: 'row', gap: 6, height: 40 },
    freqBar: {
      flex: 1,
      borderRadius: Radii.sm,
      backgroundColor: theme.colors.surfaceAlt,
    },
    freqBarActive: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    freqBarToday: { borderWidth: 1.5, borderColor: theme.colors.accent },
    freqBarFuture: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
    },
    freqLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
    freqLabel: {
      flex: 1,
      textAlign: 'center',
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textMuted,
    },

    listLabel: { ...theme.type.label, color: theme.colors.textMuted, marginBottom: Spacing.sm },

    // Workout card
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    cardDate: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 3 },
    cardTitle: { ...theme.type.title, fontSize: FontSize.xl, color: theme.colors.textPrimary },
    zoneBadge: {
      fontFamily: Fonts.data,
      fontSize: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radii.full,
      borderWidth: 1,
      overflow: 'hidden',
    },
    typeIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardStats: {
      flexDirection: 'row',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    stat: { flex: 1 },
    statLabel: {
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
      marginBottom: 3,
    },
    statValue: {
      fontFamily: Fonts.data,
      fontSize: FontSize.lg,
      color: theme.colors.textPrimary,
    },
    statUnit: { fontSize: FontSize.xs, color: theme.colors.textMuted },
    sep: { height: Spacing.sm },

    // Empty state
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    emptyTitle: { ...theme.type.headline, color: theme.colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
    emptyText: { ...theme.type.body, color: theme.colors.textMuted, textAlign: 'center' },
  });
