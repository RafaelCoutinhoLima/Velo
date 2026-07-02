import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Radii, Spacing, Fonts, useTheme, type Theme } from '../../lib/theme';
import {
  PT_MONTHS,
  SPORT_META,
  formatDuration,
  formatPace,
  sportColor,
  sportOf,
  type Workout,
} from './types';

// Card de treino do histórico (tela 08): quadrado de data 44px com fundo
// soft da cor do esporte, nome com ponto colorido, linha mono de métricas
// e carga (rTSS) à direita.
export function WorkoutCard({ workout }: { workout: Workout }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sport = sportOf(workout);
  const meta = SPORT_META[sport];
  const tint = sportColor(theme, sport);

  const [, m, d] = workout.date.split('-');
  const distKm = workout.distance_m > 0 ? (workout.distance_m / 1000).toFixed(1).replace('.', ',') : null;
  const pace = formatPace(workout.distance_m, workout.duration_s);
  const dur = workout.duration_s > 0 ? formatDuration(workout.duration_s) : null;

  const metaLine = [
    distKm ? `${distKm} km` : dur ? `${dur} min` : null,
    pace ? `${pace.replace(':', "'")}"/km` : null,
    workout.avg_hr ? `${workout.avg_hr} bpm` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/workout/${workout.id}`)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Treino de ${parseInt(d, 10)} de ${PT_MONTHS[parseInt(m, 10) - 1]}, ${meta.label}`}
    >
      <View style={[styles.dateSquare, { backgroundColor: `${tint}1A` }]}>
        <Text style={[styles.dateDay, { color: tint }]}>{parseInt(d, 10)}</Text>
        <Text style={[styles.dateMonth, { color: tint }]}>
          {PT_MONTHS[parseInt(m, 10) - 1]?.toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.nameRow}>
          <View style={[styles.typeDot, { backgroundColor: tint }]} />
          <Text style={styles.name} numberOfLines={1}>
            {meta.label}
          </Text>
        </View>
        {metaLine ? <Text style={styles.metaLine}>{metaLine}</Text> : null}
      </View>

      {workout.rtss != null ? (
        <View style={styles.load}>
          <Text style={styles.loadValue}>{workout.rtss.toFixed(0)}</Text>
          <Text style={styles.loadLabel}>rTSS</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md - 2,
    },
    dateSquare: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateDay: {
      fontFamily: Fonts.dataBold,
      fontSize: 16,
      lineHeight: 18,
      fontVariant: ['tabular-nums'],
    },
    dateMonth: { fontFamily: Fonts.dataSemiBold, fontSize: 9, letterSpacing: 0.5 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    typeDot: { width: 7, height: 7, borderRadius: Radii.full },
    name: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 14,
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    metaLine: {
      fontFamily: Fonts.data,
      fontSize: 11.5,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    load: { alignItems: 'center', gap: 1, paddingRight: 2 },
    loadValue: {
      fontFamily: Fonts.dataBold,
      fontSize: 13,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    loadLabel: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 9,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
    },
  });
