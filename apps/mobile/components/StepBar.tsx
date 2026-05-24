import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Spacing, useTheme, type Theme } from '../lib/theme';

// Stepper de onboarding: pílulas numeradas ligadas por conectores, primary
// no passo ativo, success no concluído.
const STEPS = ['Perfil', 'Objetivo', 'Garmin', 'Pronto'];

export function StepBar({ current }: { current: number }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.stepWrap}>
            <View style={[styles.pill, done && styles.pillDone, active && styles.pillActive]}>
              {done ? (
                <Ionicons name="checkmark" size={15} color={theme.colors.onAccent} />
              ) : (
                <Text style={[styles.pillNum, active && styles.pillNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.label, active && styles.labelActive, done && styles.labelDone]}>
              {label}
            </Text>
            {i < STEPS.length - 1 ? (
              <View style={[styles.connector, done && styles.connectorDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    stepWrap: { alignItems: 'center', position: 'relative', flex: 1 },
    pill: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
      zIndex: 1,
    },
    pillActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
    pillDone: { borderColor: theme.colors.success, backgroundColor: theme.colors.success },
    pillNum: { fontFamily: Fonts.data, fontSize: FontSize.xs, color: theme.colors.textMuted },
    pillNumActive: { color: theme.colors.onAccent },
    label: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 10,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    labelActive: { color: theme.colors.primary, fontFamily: Fonts.bodyBold },
    labelDone: { color: theme.colors.success },
    connector: {
      position: 'absolute',
      top: 15,
      right: '-50%',
      left: '50%',
      height: 2,
      backgroundColor: theme.colors.border,
      zIndex: 0,
    },
    connectorDone: { backgroundColor: theme.colors.success },
  });
