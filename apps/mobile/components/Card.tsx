import { StyleSheet, View, type ViewProps } from 'react-native';
import { Colors, Radii, Shadow, Spacing } from '../lib/theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ style, children, elevated = false, ...props }: CardProps) {
  return (
    <View
      style={[styles.card, elevated ? Shadow.elevated : Shadow.card, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
});
