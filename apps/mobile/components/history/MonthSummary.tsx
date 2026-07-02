import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { PT_MONTHS_FULL, sportOf, type Workout } from './types';

// Resumo do mês (tela 08): card de 4 colunas mono — km · treinos · horas · carga.
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
  const hours = totalSec / 3600;
  const load = monthWorkouts.reduce((s, w) => s + (w.rtss ?? 0), 0);

  const cells: { value: string; label: string }[] = [
    { value: runKm >= 100 ? `${Math.round(runKm)}` : runKm.toFixed(1), label: 'km' },
    { value: `${sessions}`, label: sessions === 1 ? 'treino' : 'treinos' },
    { value: hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`, label: 'tempo' },
    { value: `${Math.round(load)}`, label: 'rTSS' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.monthLabel}>{PT_MONTHS_FULL[now.getMonth()]}</Text>
      <View style={styles.row}>
        {cells.map((c, i) => (
          <View key={c.label} style={[styles.cell, i > 0 && styles.cellDivider]}>
            <Text style={styles.value}>{c.value}</Text>
            <Text style={styles.label}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.lg,
    },
    monthLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    row: { flexDirection: 'row' },
    cell: { flex: 1, alignItems: 'center', gap: 2 },
    cellDivider: { borderLeftWidth: 1, borderLeftColor: theme.colors.divider },
    value: {
      fontFamily: Fonts.dataBold,
      fontSize: 20,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    label: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 9,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
    },
  });
