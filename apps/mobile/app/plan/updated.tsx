import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';

// "Plano Atualizado" — confirmação exibida após a regeneração do plano
// concluir com sucesso (vindo de /plan/new).
export default function PlanUpdatedScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={styles.glow} />
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={52} color={theme.colors.onAccent} />
        </View>
        <Text style={styles.title}>Plano atualizado</Text>
        <Text style={styles.text}>
          Recriamos sua semana com base nos seus dados mais recentes. O objetivo continua o
          mesmo — o caminho até ele ficou mais preciso.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label="Ver meu plano"
          onPress={() => router.replace('/(tabs)/plan')}
          icon={<Ionicons name="arrow-forward" size={18} color={theme.colors.onAccent} />}
          accessibilityLabel="Ver meu plano atualizado"
        />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    glow: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      opacity: 0.7,
    },
    iconCircle: {
      width: 104,
      height: 104,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    title: { ...theme.type.display, color: theme.colors.textPrimary, textAlign: 'center' },
    text: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center' },
    footer: { padding: Spacing.lg },
  });
