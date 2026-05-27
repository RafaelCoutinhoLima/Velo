import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Fonts,
  FontSize,
  Radii,
  Spacing,
  Tracking,
  useTheme,
  type Theme,
} from '../../lib/theme';
import { PT_MONTHS, sportOf, type Workout } from './types';

export function MonthSummary({ workouts }: { workouts: Workout[] }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthWorkouts = workouts.filter((w) => w.date.startsWith(ym));

  const totalSec = monthWorkouts.reduce((s, w) => s + w.duration_s, 0);
  const runKm =
    monthWorkouts.filter((w) => sportOf(w) === 'run').reduce((s, w) => s + w.distance_m, 0) /
    1000;
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
  const bars = weekHours
    .map((h, i) => ({ label: `S${4 - i}`, h, pct: h / maxWeek }))
    .reverse();

  return (
    <View style={styles.wrap}>
      <View style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={styles.chartLabel}>Volume semanal (horas)</Text>
          <Text style={styles.monthBadge}>{PT_MONTHS[now.getMonth()]}</Text>
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md, marginBottom: Spacing.lg },
    chartCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    chartHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    chartLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    monthBadge: {
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
    statCard: { flex: 1, borderRadius: Radii.lg, padding: Spacing.md, gap: 4 },
    statValue: { ...theme.type.title, fontSize: FontSize.xl, color: theme.colors.textPrimary },
    statLabel: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textSecondary },
  });
