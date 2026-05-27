import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radii, Spacing, Tracking, useTheme, type Theme } from '../../lib/theme';
import { Stat } from './Stat';
import {
  SPORT_META,
  formatDateShort,
  formatDuration,
  formatPace,
  sportColor,
  sportOf,
  type Workout,
} from './types';

export function WorkoutCard({ workout }: { workout: Workout }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sport = sportOf(workout);
  const meta = SPORT_META[sport];
  const tint = sportColor(theme, sport);
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
        <View style={[styles.typeIcon, { backgroundColor: `${tint}1A` }]}>
          <Ionicons name={meta.icon} size={22} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{meta.label}</Text>
          <Text style={styles.cardDate}>{formatDateShort(workout.date)}</Text>
        </View>
        {workout.rtss != null ? (
          <Text style={[styles.loadBadge, { color: tint, borderColor: `${tint}44` }]}>
            Carga {workout.rtss.toFixed(0)}
          </Text>
        ) : null}
      </View>

      <View style={styles.cardStats}>
        {isTimeOnly ? (
          <>
            <Stat label="Tempo" value={dur} unit={workout.duration_s >= 3600 ? '' : 'm'} />
            <Stat
              label="FC média"
              value={workout.avg_hr ? `${workout.avg_hr}` : '—'}
              unit={workout.avg_hr ? 'bpm' : ''}
            />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
  });
