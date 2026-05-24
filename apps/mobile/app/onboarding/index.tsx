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

  const cards: { icon: keyof typeof Ionicons.glyphMap; tint: string; title: string; body: React.ReactNode }[] = [
    {
      icon: 'fitness',
      tint: theme.colors.primary,
      title: 'O que o FitSync faz',
      body: 'Gera planos de corrida personalizados com IA, baseados nos seus dados do Garmin e métricas de carga de treino (rTSS, ACWR, HRV).',
    },
    {
      icon: 'warning',
      tint: theme.colors.warning,
      title: 'O que o FitSync não faz',
      body: (
        <>
          O FitSync AI <Text style={{ fontFamily: 'Inter-Bold' }}>não substitui</Text> acompanhamento médico,
          fisioterapêutico ou de treinador profissional. Em caso de dor, lesão ou desconforto,
          consulte um profissional de saúde.
        </>
      ),
    },
    {
      icon: 'lock-closed',
      tint: theme.colors.accent,
      title: 'Seus dados (LGPD)',
      body: 'Coletamos seus dados de treino do Garmin, perfil esportivo e métricas fisiológicas para gerar planos personalizados. Seus dados ficam armazenados em servidores no Brasil. Você pode exportar ou excluir seus dados a qualquer momento nas configurações.',
    },
    {
      icon: 'sparkles',
      tint: theme.colors.primary,
      title: 'IA generativa',
      body: 'Os planos são gerados pelo Claude (Anthropic). Aplicamos guardrails automáticos de segurança (carga máxima, progressão) mas sempre revise o plano antes de executar.',
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
        {cards.map((card) => (
          <View key={card.title} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: card.tint + '1F' }]}>
                <Ionicons name={card.icon} size={18} color={card.tint} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
            </View>
            <Text style={styles.cardText}>{card.body}</Text>
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
    scrollContent: { gap: Spacing.sm, paddingBottom: Spacing.md },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { ...theme.type.subtitle, fontSize: theme.type.body.fontSize, color: theme.colors.textPrimary },
    cardText: { ...theme.type.bodySm, color: theme.colors.textSecondary, lineHeight: 21 },
    btn: { marginTop: Spacing.md },
  });
