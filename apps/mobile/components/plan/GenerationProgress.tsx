import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

// Tela 15 — checklist transparente do raciocínio da geração. Os rótulos
// espelham as etapas reais do pipeline (/plan/generate): ler histórico,
// calcular carga, distribuir intensidade, posicionar longo/recuperação.
const GENERATION_STEPS = [
  'Li seus últimos treinos sincronizados',
  'Calculei sua carga e ACWR',
  'Distribuindo intensidade 80/20…',
  'Posicionando o longo e a recuperação',
];

interface GenerationProgressProps {
  footnote: string;
  children?: React.ReactNode;
}

// Avança o checklist em ritmo constante enquanto o job roda; o último passo
// só completa quando quem renderiza desmonta este componente (done/erro).
export function GenerationProgress({ footnote, children }: GenerationProgressProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.logo}>
        <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 7l7 5-7 5M12 7l7 5-7 5"
            stroke={theme.colors.onAccent}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.title}>Montando sua semana</Text>

      <View style={styles.checklist}>
        {GENERATION_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <View key={label} style={[styles.step, !done && !active && { opacity: 0.5 }]}>
              {done ? (
                <View style={styles.stepDone}>
                  <Ionicons name="checkmark" size={13} color={theme.colors.onAccent} />
                </View>
              ) : active ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <View style={styles.stepFuture} />
              )}
              <Text style={[styles.stepText, done && styles.stepTextDone]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.footnote}>{footnote}</Text>
      {children}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.lg,
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.glow,
    },
    title: { ...theme.type.headline, color: theme.colors.textPrimary, textAlign: 'center' },
    checklist: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2, minHeight: 22 },
    stepDone: {
      width: 20,
      height: 20,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepFuture: {
      width: 20,
      height: 20,
      borderRadius: Radii.full,
      borderWidth: 1.5,
      borderColor: theme.colors.borderStrong,
    },
    stepText: {
      ...theme.type.bodySm,
      fontSize: FontSize.sm,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    stepTextDone: { color: theme.colors.textSecondary },
    footnote: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
    },
  });
