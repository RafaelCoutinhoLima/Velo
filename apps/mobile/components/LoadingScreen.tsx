import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing } from '../lib/theme';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export function LoadingScreen({ message, subMessage }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {subMessage ? <Text style={styles.subMessage}>{subMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.bg,
  },
  message: {
    marginTop: Spacing.md,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subMessage: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
