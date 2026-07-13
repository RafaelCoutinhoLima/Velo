import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import {
  PT_MONTHS_FULL,
  SPORT_META,
  sportColor,
  sportOf,
  todayIso,
  type Sport,
  type Workout,
} from './types';

interface MonthCalendarProps {
  workouts: Workout[];
  monthOffset: number;
  onChangeMonth: (offset: number) => void;
}

export function MonthCalendar({ workouts, monthOffset, onChangeMonth }: MonthCalendarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const base = new Date();
  const viewDate = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = todayIso();
  const isCurrentMonth = monthOffset === 0;

  const byDate = new Map<string, Set<Sport>>();
  for (const w of workouts) {
    const set = byDate.get(w.date) ?? new Set<Sport>();
    set.add(sportOf(w));
    byDate.set(w.date, set);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ day: number; iso: string } | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso });
  }

  const monthWorkouts = workouts.filter((w) =>
    w.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`),
  );
  const activeDays = new Set(monthWorkouts.map((w) => w.date)).size;

  return (
    <View>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => onChangeMonth(monthOffset - 1)}
          style={styles.navBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {PT_MONTHS_FULL[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={() => onChangeMonth(Math.min(0, monthOffset + 1))}
          disabled={isCurrentMonth}
          style={styles.navBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
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
      <View style={styles.weekHeader}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((l, i) => (
          <Text key={i} style={styles.weekDay}>
            {l}
          </Text>
        ))}
      </View>
      {/* Heatmap de consistência (tela 18): quadrado raio 9 com fundo soft da
          cor do treino feito; cinza = dia passado sem treino; texto apagado =
          futuro; hoje com borda accent. */}
      <View style={styles.grid}>
        {cells.map((c, i) => {
          if (!c) return <View key={`e${i}`} style={styles.cell} />;
          const sports = byDate.get(c.iso);
          const first = sports ? [...sports][0] : null;
          const tint = first ? sportColor(theme, first) : null;
          const isToday = c.iso === today;
          const isFuture = c.iso > today;
          return (
            <View key={c.iso} style={styles.cell}>
              <View
                style={[
                  styles.daySquare,
                  tint
                    ? { backgroundColor: `${tint}26` }
                    : !isFuture
                      ? { backgroundColor: theme.colors.surfaceAlt }
                      : null,
                  isToday && styles.dayToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    tint ? { color: tint, fontFamily: Fonts.dataSemiBold } : null,
                    isFuture ? styles.dayNumFuture : null,
                    isToday && !tint ? { color: theme.colors.primary } : null,
                  ]}
                >
                  {c.day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{activeDays}</Text>
          <Text style={styles.summaryLabel}>dias ativos</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{monthWorkouts.length}</Text>
          <Text style={styles.summaryLabel}>sessões</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        {(['run', 'bike', 'swim', 'strength'] as Sport[]).map((sp) => (
          <View key={sp} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: sportColor(theme, sp) }]} />
            <Text style={styles.legendText}>{SPORT_META[sp].label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    navBtn: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    monthTitle: { ...theme.type.subtitle, color: theme.colors.textPrimary },
    weekHeader: { flexDirection: 'row', marginBottom: Spacing.xs },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      fontFamily: Fonts.data,
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 5 },
    cell: {
      width: `${100 / 7}%`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    daySquare: {
      width: 38,
      height: 38,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayToday: { borderWidth: 1.5, borderColor: theme.colors.primary },
    dayNum: {
      fontFamily: Fonts.data,
      fontSize: FontSize.sm,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    dayNumFuture: { color: theme.colors.textMuted, opacity: 0.6 },
    dot: { width: 5, height: 5, borderRadius: Radii.full },

    summaryCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      marginTop: Spacing.lg,
    },
    summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
    summaryValue: { ...theme.type.title, color: theme.colors.primary },
    summaryLabel: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textSecondary },
    summaryDivider: { width: 1, backgroundColor: theme.colors.border },

    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      marginTop: Spacing.md,
      justifyContent: 'center',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendText: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textMuted },
  });
