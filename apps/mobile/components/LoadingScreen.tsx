import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, FontWeight, Spacing, useTheme, type Theme } from '../lib/theme';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export function LoadingScreen({ message, subMessage }: LoadingScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {subMessage ? <Text style={styles.subMessage}>{subMessage}</Text> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
      backgroundColor: theme.colors.bg,
    },
    message: {
      marginTop: Spacing.md,
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    subMessage: {
      marginTop: Spacing.sm,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
