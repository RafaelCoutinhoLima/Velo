import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

// Mostrado quando a IA falhou e o plano ativo é o fallback determinístico
// (prompt_version *_fallback) — sem isso o usuário recebe um plano genérico
// achando que é personalizado.
export function FallbackPlanBanner() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={20} color={theme.colors.warning} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Plano básico de segurança</Text>
        <Text style={styles.text}>
          Não conseguimos gerar seu plano personalizado agora. Esta é uma semana conservadora —
          peça um novo plano mais tarde em Ajustes.
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.colors.warningLight,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.warningBorder,
    },
    title: { ...theme.type.bodyStrong, color: theme.colors.warning },
    text: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });
