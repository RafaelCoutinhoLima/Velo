// US-008 — Disclaimer obrigatório LGPD antes de qualquer chamada Claude
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';

export default function DisclaimerScreen() {
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const topics: { icon: keyof typeof Ionicons.glyphMap; eyebrow: string; title: string; body: React.ReactNode }[] = [
    {
      icon: 'fitness-outline',
      eyebrow: 'Produto',
      title: 'O que a Velo faz',
      body: 'Gera planos de corrida personalizados com IA, baseados nos seus dados do Garmin e em métricas de carga: rTSS (peso de cada treino), ACWR (balanço carga/risco), HRV (recuperação).',
    },
    {
      icon: 'warning-outline',
      eyebrow: 'Limites',
      title: 'O que ele não substitui',
      body: (
        <>
          A Velo <Text style={{ fontFamily: 'Inter-Bold' }}>não substitui</Text> acompanhamento médico,
          fisioterapêutico ou de treinador profissional. Em caso de dor, lesão ou desconforto,
          consulte um profissional de saúde.
        </>
      ),
    },
    {
      icon: 'lock-closed-outline',
      eyebrow: 'Privacidade',
      title: 'Seus dados (LGPD)',
      body: 'Coletamos seus dados de treino do Garmin, perfil esportivo e métricas fisiológicas para gerar planos personalizados. Seus dados ficam armazenados em servidores no Brasil. Você pode exportar ou excluir seus dados a qualquer momento nas configurações.',
    },
    {
      icon: 'sparkles-outline',
      eyebrow: 'Inteligência',
      title: 'Como a IA gera o plano',
      body: 'Os planos são gerados pelo Claude (Anthropic). Aplicamos guardrails automáticos de segurança (carga máxima, progressão), mas sempre revise antes de executar.',
    },
  ];

  async function accept() {
    if (!session?.athlete_id) return;
    setLoading(true);
    try {
      await post('/onboarding/consent', { athlete_id: session.athlete_id });
      router.push('/onboarding/profile');
    } catch {
      // Consentimento é backfillado pelo servidor ao salvar perfil — não bloqueia o fluxo
      router.push('/onboarding/profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
        <Text style={styles.eyebrow}>Antes de começar</Text>
      </View>
      <Text style={styles.title}>Leia com atenção</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {topics.map((topic, i) => (
          <View
            key={topic.title}
            style={[styles.topic, i > 0 ? styles.topicDivided : null]}
          >
            <View style={styles.topicEyebrowRow}>
              <Ionicons name={topic.icon} size={15} color={theme.colors.primary} />
              <Text style={styles.topicEyebrow}>{topic.eyebrow}</Text>
            </View>
            <Text style={styles.topicTitle}>{topic.title}</Text>
            <Text style={styles.topicBody}>{topic.body}</Text>
          </View>
        ))}
      </ScrollView>

      <Button
        label="Li e aceito os termos"
        onPress={accept}
        loading={loading}
        style={styles.btn}
        icon={<Ionicons name="checkmark" size={18} color={theme.colors.onAccent} />}
        accessibilityLabel="Aceitar termos e continuar"
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      padding: Spacing.lg,
      paddingTop: Spacing.xxl + Spacing.md,
    },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
    eyebrow: { ...theme.type.label, color: theme.colors.primary },
    title: { ...theme.type.headline, color: theme.colors.textPrimary, marginBottom: Spacing.md },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: Spacing.md },
    topic: {
      paddingVertical: Spacing.lg,
      gap: Spacing.xs,
    },
    topicDivided: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    topicEyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    topicEyebrow: {
      ...theme.type.label,
      color: theme.colors.primary,
    },
    topicTitle: {
      ...theme.type.title,
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    topicBody: {
      ...theme.type.body,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    btn: { marginTop: Spacing.md },
  });
