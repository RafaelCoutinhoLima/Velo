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

  // ── Heatmap dos últimos 30 dias ──────────────────────────────────────
  // 5 colunas × 6 linhas (30 cells). Cada cell = 1 dia: número do mês +
  // ponto colorido se houve treino. Hoje tem borda; futuros são tracejados
  // (não aparecem nesse range mas mantemos pra robustez).
  function ThirtyDayGrid({ workouts }: { workouts: Workout[] }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateToWorkouts = new Map<string, number>();
    for (const w of workouts) {
      dateToWorkouts.set(w.date, (dateToWorkouts.get(w.date) ?? 0) + 1);
    }

    const cells = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (29 - i));
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        iso,
        dayOfMonth: d.getDate(),
        count: dateToWorkouts.get(iso) ?? 0,
        isToday: d.getTime() === today.getTime(),
      };
    });

    const workoutsLast30 = cells.filter((c) => c.count > 0).length;
    const totalSessions = cells.reduce((s, c) => s + c.count, 0);

    return (
      <View style={styles.freqSection}>
        <View style={styles.freqHeader}>
          <Text style={styles.freqTitle}>Últimos 30 dias</Text>
          <Text style={styles.freqHint}>
            {workoutsLast30}{' '}
            {workoutsLast30 === 1 ? 'dia ativo' : 'dias ativos'} · {totalSessions}{' '}
            {totalSessions === 1 ? 'sessão' : 'sessões'}
          </Text>
        </View>
        <View style={styles.gridWrap}>
          {cells.map((c) => (
            <View
              key={c.iso}
              style={[
                styles.gridCell,
                c.count > 0 && styles.gridCellActive,
                c.isToday && styles.gridCellToday,
              ]}
            >
              <Text
                style={[
                  styles.gridCellDay,
                  c.count > 0 && styles.gridCellDayActive,
                ]}
              >
                {c.dayOfMonth}
              </Text>
              {c.count > 1 ? (
                <View style={styles.gridCellDoubleDot} />
              ) : null}
            </View>
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
              <ThirtyDayGrid workouts={workouts} />
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
    // Grid de 30 dias (5 cols × 6 rows)
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    gridCell: {
      width: '18.4%', // ~5 colunas com gap
      aspectRatio: 1,
      borderRadius: Radii.sm,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    gridCellActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    gridCellToday: {
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    gridCellDay: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
    },
    gridCellDayActive: {
      color: theme.colors.onAccent,
      fontFamily: Fonts.bodyBold,
    },
    gridCellDoubleDot: {
      position: 'absolute',
      bottom: 4,
      width: 4,
      height: 4,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.onAccent,
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
