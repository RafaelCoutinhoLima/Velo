import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Spacing, useTheme, type Theme } from '../lib/theme';

// Barra de topo do app: avatar à esquerda, marca, sino de notificações à
// direita. Cores se adaptam ao tema ativo (Interstellar / Interspace Blue).
export function TopBar() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.navigate('/(tabs)/settings')}
          accessibilityRole="button"
          accessibilityLabel="Abrir configurações"
        >
          <Ionicons name="person" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>FitSync AI</Text>
      </View>
      <TouchableOpacity
        style={styles.bell}
        accessibilityRole="button"
        accessibilityLabel="Notificações"
      >
        <Ionicons name="notifications-outline" size={22} color={theme.colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xl + Spacing.xs,
      paddingBottom: Spacing.sm,
      backgroundColor: theme.colors.bg,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...theme.type.headline, color: theme.colors.textPrimary },
    bell: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
