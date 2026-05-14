import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Radii, Spacing } from '../lib/theme';

interface ErrorCardProps {
  message: string;
}

export function ErrorCard({ message }: ErrorCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  text: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.danger,
    lineHeight: 20,
  },
});
