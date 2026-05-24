import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, Radii, Spacing, Tracking, useTheme, type Theme } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { TopBar } from '../../components/TopBar';

type Sport = 'run' | 'bike' | 'swim' | 'strength' | 'other';

interface Workout {
  id: string;
  date: string;
  sport?: Sport;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  rtss: number | null;
  rpe: number | null;
}

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PT_MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Config por esporte — ícone Ionicons + label PT. Cobre os 5 esportes que o
// sidecar classifica; default 'run' pra registros antigos sem o campo.
const SPORT_META: Record<Sport, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  run: { label: 'Corrida', icon: 'footsteps-outline' },
  bike: { label: 'Pedal', icon: 'bicycle-outline' },
  swim: { label: 'Natação', icon: 'water-outline' },
  strength: { label: 'Força', icon: 'barbell-outline' },
  other: { label: 'Atividade', icon: 'fitness-outline' },
};

function sportOf(w: Workout): Sport {
  return w.sport ?? 'run';
}

function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${PT_MONTHS[parseInt(m, 10) - 1] ?? ''}`;
}

function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}`;
}

function formatPace(distanceM: number, durationS: number): string | null {
  if (distanceM <= 0 || durationS <= 0) return null;
  const paceS = Math.round(durationS / (distanceM / 1000));
  const m = Math.floor(paceS / 60);
  const s = paceS % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const session = useAuthStore((s) => s.session);
  const { get } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  // Offset de mês pro calendário (0 = mês atual, -1 = anterior). Vive no pai
  // porque os componentes internos remontam a cada render.
  const [monthOffset, setMonthOffset] = useState(0);

  const SPORT_COLOR: Record<Sport, string> = {
    run: theme.colors.workoutEasy,
    bike: theme.colors.workoutLong,
    swim: theme.colors.accent,
    strength: theme.colors.workoutTempo,
    other: theme.colors.workoutCross,
  };

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['workouts', session?.athlete_id],
    queryFn: () =>
      get<{ workouts: Workout[] }>(`/workouts?athlete_id=${session?.athlete_id}&limit=90`),
    enabled: !!session?.athlete_id,
    staleTime: 1000 * 60 * 5,
  });

  // ── Resumo do mês corrente ────────────────────────────────────────────
  function MonthSummary({ workouts }: { workouts: Workout[] }) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthWorkouts = workouts.filter((w) => w.date.startsWith(ym));

    const totalSec = monthWorkouts.reduce((s, w) => s + w.duration_s, 0);
    const runKm = monthWorkouts
      .filter((w) => sportOf(w) === 'run')
      .reduce((s, w) => s + w.distance_m, 0) / 1000;
    const sessions = monthWorkouts.length;
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);

    // Volume semanal (horas) das últimas 4 semanas — barras
    const weekHours = [0, 0, 0, 0];
    const nowMs = now.getTime();
    for (const w of workouts) {
      const ageD = (nowMs - new Date(`${w.date}T12:00:00`).getTime()) / 86_400_000;
      const wk = Math.floor(ageD / 7);
      if (wk >= 0 && wk < 4) weekHours[wk] += w.duration_s / 3600;
    }
    const maxWeek = Math.max(...weekHours, 0.1);
    const bars = weekHours.map((h, i) => ({ label: `S${4 - i}`, h, pct: h / maxWeek })).reverse();

    return (
      <View style={styles.summaryWrap}>
        <View style={styles.summaryChartCard}>
          <View style={styles.summaryChartHead}>
            <Text style={styles.summaryChartLabel}>Volume semanal (horas)</Text>
            <Text style={styles.summaryMonthBadge}>{PT_MONTHS[now.getMonth()]}</Text>
          </View>
          <View style={styles.barsRow}>
            {bars.map((b) => (
              <View key={b.label} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max(4, b.pct * 100)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.primaryMuted }]}>
            <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.statValue}>
              {hours}h{hours > 0 ? String(mins).padStart(2, '0') : `${mins}m`}
            </Text>
            <Text style={styles.statLabel}>Tempo ativo</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.accentLight }]}>
            <Ionicons name="footsteps-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.statValue}>{runKm.toFixed(1)} km</Text>
            <Text style={styles.statLabel}>Corrida no mês</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Ionicons name="flame-outline" size={20} color={theme.colors.workoutTempo} />
            <Text style={styles.statValue}>{sessions}</Text>
            <Text style={styles.statLabel}>Sessões</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Calendário mensal (Dom–Sáb alinhado, navegável) ───────────────────
  function MonthCalendar({ workouts }: { workouts: Workout[] }) {
    const base = new Date();
    // Aplica o offset de mês (clamp da navegação) sobre o mês corrente.
    const viewDate = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = todayIso();
    const isCurrentMonth = monthOffset === 0;

    // Mapa data → esportes do dia (pra colorir os pontos)
    const byDate = new Map<string, Set<Sport>>();
    for (const w of workouts) {
      const set = byDate.get(w.date) ?? new Set<Sport>();
      set.add(sportOf(w));
      byDate.set(w.date, set);
    }

    const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, iso });
    }

    const monthWorkouts = workouts.filter((w) => w.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));
    const activeDays = new Set(monthWorkouts.map((w) => w.date)).size;

    return (
      <View>
        <View style={styles.calHeaderRow}>
          <TouchableOpacity
            onPress={() => setMonthOffset((o) => o - 1)}
            style={styles.calNavBtn}
            accessibilityRole="button"
            accessibilityLabel="Mês anterior"
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.calMonthTitle}>
            {PT_MONTHS_FULL[month]} {year}
          </Text>
          <TouchableOpacity
            onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
            disabled={isCurrentMonth}
            style={styles.calNavBtn}
            accessibilityRole="button"
            accessibilityLabel="Próximo mês"
            accessibilityState={{ disabled: isCurrentMonth }}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={isCurrentMonth ? theme.colors.borderStrong : theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.calWeekHeader}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((l, i) => (
            <Text key={i} style={styles.calWeekDay}>{l}</Text>
          ))}
        </View>
        <View style={styles.calGrid}>
          {cells.map((c, i) => {
            if (!c) return <View key={`e${i}`} style={styles.calCell} />;
            const sports = byDate.get(c.iso);
            const isToday = c.iso === today;
            return (
              <View key={c.iso} style={styles.calCell}>
                <View style={[styles.calDayCircle, isToday && styles.calDayToday]}>
                  <Text style={[styles.calDayNum, isToday && styles.calDayNumToday]}>{c.day}</Text>
                </View>
                <View style={styles.calDots}>
                  {sports
                    ? [...sports].slice(0, 3).map((sp) => (
                        <View key={sp} style={[styles.calDot, { backgroundColor: SPORT_COLOR[sp] }]} />
                      ))
                    : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.calSummaryCard}>
          <View style={styles.calSummaryItem}>
            <Text style={styles.calSummaryValue}>{activeDays}</Text>
            <Text style={styles.calSummaryLabel}>dias ativos</Text>
          </View>
          <View style={styles.calSummaryDivider} />
          <View style={styles.calSummaryItem}>
            <Text style={styles.calSummaryValue}>{monthWorkouts.length}</Text>
            <Text style={styles.calSummaryLabel}>sessões</Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          {(['run', 'bike', 'swim', 'strength'] as Sport[]).map((sp) => (
            <View key={sp} style={styles.legendItem}>
              <View style={[styles.calDot, { backgroundColor: SPORT_COLOR[sp] }]} />
              <Text style={styles.legendText}>{SPORT_META[sp].label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
      <View style={styles.stat}>
        <Text style={styles.statLabelSm}>{label}</Text>
        <Text style={styles.statValueSm}>
          {value}
          {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
        </Text>
      </View>
    );
  }

  function WorkoutCard({ workout }: { workout: Workout }) {
    const sport = sportOf(workout);
    const meta = SPORT_META[sport];
    const tint = SPORT_COLOR[sport];
    const distKm = workout.distance_m > 0 ? (workout.distance_m / 1000).toFixed(1) : '—';
    const dur = workout.duration_s > 0 ? formatDuration(workout.duration_s) : '—';
    const pace = formatPace(workout.distance_m, workout.duration_s);
    const isTimeOnly = sport === 'strength' || sport === 'other';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/workout/${workout.id}`)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Treino de ${formatDateShort(workout.date)}, ${meta.label}`}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeIcon, { backgroundColor: tint + '1A' }]}>
            <Ionicons name={meta.icon} size={22} color={tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{meta.label}</Text>
            <Text style={styles.cardDate}>{formatDateShort(workout.date)}</Text>
          </View>
          {workout.rtss != null ? (
            <Text style={[styles.loadBadge, { color: tint, borderColor: tint + '44' }]}>
              Carga {workout.rtss.toFixed(0)}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardStats}>
          {isTimeOnly ? (
            <>
              <Stat label="Tempo" value={dur} unit={workout.duration_s >= 3600 ? '' : 'm'} />
              <Stat label="FC média" value={workout.avg_hr ? `${workout.avg_hr}` : '—'} unit={workout.avg_hr ? 'bpm' : ''} />
            </>
          ) : (
            <>
              <Stat label="Distância" value={distKm} unit="km" />
              <Stat label="Tempo" value={dur} unit={workout.duration_s >= 3600 ? '' : 'm'} />
              <Stat label="Pace" value={pace ?? '—'} unit={pace ? '/km' : ''} />
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function ViewToggle() {
    return (
      <View style={styles.toggle}>
        {(['list', 'calendar'] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
            onPress={() => setView(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: view === v }}
          >
            <Ionicons
              name={v === 'list' ? 'list-outline' : 'calendar-outline'}
              size={16}
              color={view === v ? theme.colors.onAccent : theme.colors.textSecondary}
            />
            <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
              {v === 'list' ? 'Lista' : 'Calendário'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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

  const Header = (
    <View>
      <Text style={styles.screenTitle}>Histórico</Text>
      <ViewToggle />
      {workouts.length > 0 ? (
        view === 'calendar' ? (
          <MonthCalendar workouts={workouts} />
        ) : (
          <>
            <MonthSummary workouts={workouts} />
            <Text style={styles.listLabel}>Treinos</Text>
          </>
        )
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <TopBar />
      {isError ? (
        <View style={styles.errorWrap}>
          <ErrorCard message="Não conseguimos carregar seu histórico. Puxe para atualizar." />
        </View>
      ) : workouts.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <View>
              <Text style={styles.screenTitle}>Histórico</Text>
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="footsteps-outline" size={36} color={theme.colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Nenhum treino ainda</Text>
                <Text style={styles.emptyText}>
                  Conecte seu Garmin nas configurações e sincronize para importar seu histórico.
                </Text>
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />
          }
        />
      ) : (
        <FlatList
          data={view === 'list' ? workouts : []}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => <WorkoutCard workout={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={Header}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />
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

    // Toggle Lista / Calendário
    toggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: Radii.md,
      padding: 3,
      marginBottom: Spacing.md,
    },
    toggleBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.sm,
    },
    toggleBtnActive: { backgroundColor: theme.colors.primary },
    toggleText: { fontFamily: Fonts.bodySemiBold, fontSize: FontSize.sm, color: theme.colors.textSecondary },
    toggleTextActive: { color: theme.colors.onAccent },

    // Resumo do mês
    summaryWrap: { gap: Spacing.md, marginBottom: Spacing.lg },
    summaryChartCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    summaryChartHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    summaryChartLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    summaryMonthBadge: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.primary,
      backgroundColor: theme.colors.primaryMuted,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radii.full,
      overflow: 'hidden',
    },
    barsRow: { flexDirection: 'row', height: 90, gap: Spacing.sm, alignItems: 'flex-end' },
    barCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' },
    barTrack: { width: '70%', flex: 1, justifyContent: 'flex-end' },
    barFill: { width: '100%', backgroundColor: theme.colors.primary, borderRadius: Radii.sm },
    barLabel: { fontFamily: Fonts.data, fontSize: 10, color: theme.colors.textMuted },

    statRow: { flexDirection: 'row', gap: Spacing.sm },
    statCard: {
      flex: 1,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: 4,
    },
    statValue: { ...theme.type.title, fontSize: FontSize.xl, color: theme.colors.textPrimary },
    statLabel: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textSecondary },

    listLabel: { ...theme.type.label, color: theme.colors.textMuted, marginBottom: Spacing.sm },

    // Calendário mensal
    calHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    calNavBtn: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    calMonthTitle: { ...theme.type.subtitle, color: theme.colors.textPrimary },
    calWeekHeader: { flexDirection: 'row', marginBottom: Spacing.xs },
    calWeekDay: {
      flex: 1,
      textAlign: 'center',
      fontFamily: Fonts.data,
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
    calDayCircle: {
      width: 32,
      height: 32,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calDayToday: { backgroundColor: theme.colors.primary },
    calDayNum: { fontFamily: Fonts.data, fontSize: FontSize.sm, color: theme.colors.textSecondary },
    calDayNumToday: { color: theme.colors.onAccent, fontFamily: Fonts.bodyBold },
    calDots: { flexDirection: 'row', gap: 2, height: 5 },
    calDot: { width: 5, height: 5, borderRadius: Radii.full },

    calSummaryCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      marginTop: Spacing.lg,
    },
    calSummaryItem: { flex: 1, alignItems: 'center', gap: 2 },
    calSummaryValue: { ...theme.type.title, color: theme.colors.primary },
    calSummaryLabel: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textSecondary },
    calSummaryDivider: { width: 1, backgroundColor: theme.colors.border },

    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendText: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textMuted },

    // Workout card
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    cardTitle: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    cardDate: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
      marginTop: 1,
    },
    loadBadge: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      borderWidth: 1,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    typeIcon: {
      width: 44,
      height: 44,
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
    statLabelSm: {
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
      marginBottom: 2,
    },
    statValueSm: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    statUnit: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textMuted },
    sep: { height: Spacing.sm },

    // Empty
    empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.sm },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    emptyTitle: { ...theme.type.title, color: theme.colors.textPrimary },
    emptyText: {
      ...theme.type.bodySm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: Spacing.lg,
    },
  });
