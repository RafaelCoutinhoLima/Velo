import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSize, Spacing } from '../lib/theme';

// Stepper de onboarding (design Stitch): pílulas numeradas ligadas por
// conectores, accent lima no passo ativo, verde no concluído.
const STEPS = ['Perfil', 'Objetivo', 'Garmin', 'Pronto'];

export function StepBar({ current }: { current: number }) {
  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.stepWrap}>
            <View style={[styles.pill, done && styles.pillDone, active && styles.pillActive]}>
              {done ? (
                <Ionicons name="checkmark" size={15} color={Colors.bg} />
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

const styles = StyleSheet.create({
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    zIndex: 1,
  },
  pillActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  pillDone: { borderColor: Colors.success, backgroundColor: Colors.success },
  pillNum: { fontFamily: Fonts.data, fontSize: FontSize.xs, color: Colors.textMuted },
  pillNumActive: { color: Colors.onAccent },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  labelActive: { color: Colors.primary, fontFamily: Fonts.bodyBold },
  labelDone: { color: Colors.success },
  connector: {
    position: 'absolute',
    top: 15,
    right: '-50%',
    left: '50%',
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 0,
  },
  connectorDone: { backgroundColor: Colors.success },
});
