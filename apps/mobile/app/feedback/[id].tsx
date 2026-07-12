import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, Radii, Spacing, Tracking, useTheme, type Theme } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { Button } from '../../components/Button';
import { BackHeader } from '../../components/BackHeader';

interface Feedback {
  texto_principal: string;
  destaque_positivo?: string;
  sugestao?: string;
  emoji_resumo?: string;
}

// "Feedback Pós-Treino" — análise comemorativa do treino concluído, gerada
// pela IA. Acessada a partir do detalhe do treino (workout/[id]).
export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const res = await post<Feedback>('/feedback', {
        workout_id: id,
        athlete_id: session?.athlete_id,
      });
      setFeedback(res);
      setStatus('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não conseguimos gerar o feedback.');
      setStatus('error');
    }
  }

  useEffect(() => {
    if (id && session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session]);

  if (status === 'loading') {
    return (
      <LoadingScreen
        message="Analisando seu treino"
        subMessage="A IA está revisando seu pace, FC e histórico"
      />
    );
  }

  return (
    <View style={styles.container}>
      <BackHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {status === 'error' ? (
          <>
            <ErrorCard message={error ?? 'Não conseguimos gerar o feedback.'} />
            <Button label="Tentar novamente" onPress={load} style={{ marginTop: Spacing.md }} />
          </>
        ) : feedback ? (
          <>
            {/* ── Hero comemorativo: círculo check verde (tela 06) ── */}
            <View style={styles.hero}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={46} color={theme.colors.success} />
              </View>
              <Text style={styles.eyebrow}>Feedback do treinador</Text>
              <Text style={styles.heroTitle}>
                {feedback.emoji_resumo ? `Treino analisado ${feedback.emoji_resumo}` : 'Treino analisado'}
              </Text>
            </View>

            {/* ── Texto principal ── */}
            <View style={styles.mainCard}>
              <Text style={styles.mainText}>{feedback.texto_principal}</Text>
            </View>

            {/* ── Destaque positivo ── */}
            {feedback.destaque_positivo ? (
              <View style={[styles.insightCard, styles.positiveCard]}>
                <View style={[styles.insightIcon, { backgroundColor: theme.colors.successLight }]}>
                  <Ionicons name="trophy" size={18} color={theme.colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: theme.colors.success }]}>Destaque</Text>
                  <Text style={styles.insightText}>{feedback.destaque_positivo}</Text>
                </View>
              </View>
            ) : null}

            {/* ── Sugestão ── */}
            {feedback.sugestao ? (
              <View style={[styles.insightCard, styles.suggestionCard]}>
                <View style={[styles.insightIcon, { backgroundColor: theme.colors.warningLight }]}>
                  <Ionicons name="bulb" size={18} color={theme.colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: theme.colors.warning }]}>Próximo passo</Text>
                  <Text style={styles.insightText}>{feedback.sugestao}</Text>
                </View>
              </View>
            ) : null}

            <Button
              label="Voltar ao treino"
              variant="secondary"
              onPress={() => router.back()}
              style={{ marginTop: Spacing.md }}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: Spacing.lg, gap: Spacing.md },

    hero: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
    checkCircle: {
      width: 96,
      height: 96,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.successLight,
      borderWidth: 2,
      borderColor: theme.colors.successBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    eyebrow: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.accent,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wider,
    },
    heroTitle: { ...theme.type.headline, color: theme.colors.textPrimary },

    mainCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.lg,
    },
    mainText: {
      fontFamily: Fonts.body,
      fontSize: 15.5,
      color: theme.colors.textPrimary,
      lineHeight: 24,
    },

    insightCard: {
      flexDirection: 'row',
      gap: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
    },
    positiveCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.successBorder },
    suggestionCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.warningBorder },
    insightIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    insightLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
      marginBottom: 3,
    },
    insightText: { ...theme.type.bodySm, color: theme.colors.textPrimary },
  });
