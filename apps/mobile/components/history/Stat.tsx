import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, Tracking, useTheme, type Theme } from '../../lib/theme';

interface StatProps {
  label: string;
  value: string;
  unit: string;
}

export function Stat({ label, value, unit }: StatProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {value}
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    stat: { flex: 1 },
    label: {
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
      marginBottom: 2,
    },
    value: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    unit: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: theme.colors.textMuted },
  });
