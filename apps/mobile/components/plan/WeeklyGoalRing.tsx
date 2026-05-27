import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Fonts, FontSize, FontWeight, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

interface WeeklyGoalRingProps {
  done: number;
  total: number;
}

const SIZE = 56;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function WeeklyGoalRing({ done, total }: WeeklyGoalRingProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const progress = total > 0 ? Math.min(done / total, 1) : 0;

  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Meta da Semana</Text>
        <Text style={styles.sub}>
          {done} de {total} treino{total === 1 ? '' : 's'} concluído{done === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={theme.colors.surfaceAlt}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={theme.colors.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.pctWrap}>
          <Text style={styles.pct}>{Math.round(progress * 100)}%</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    title: { ...theme.type.title, color: theme.colors.textPrimary },
    sub: { ...theme.type.bodySm, color: theme.colors.textMuted, marginTop: 2 },
    pctWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    pct: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: theme.colors.primary,
    },
  });
