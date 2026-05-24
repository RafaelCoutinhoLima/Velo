// US-008 — Disclaimer obrigatório LGPD antes de qualquer chamada Claude
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, Radii, Spacing, Type } from '../../lib/theme';
import { Button } from '../../components/Button';

const CARDS: { icon: keyof typeof Ionicons.glyphMap; tint: string; title: string; body: React.ReactNode }[] = [
  {
    icon: 'fitness',
    tint: Colors.primary,
    title: 'O que o FitSync faz',
    body: 'Gera planos de corrida personalizados com IA, baseados nos seus dados do Garmin e métricas de carga de treino (rTSS, ACWR, HRV).',
  },
  {
    icon: 'warning',
    tint: Colors.warning,
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
    tint: Colors.accent,
    title: 'Seus dados (LGPD)',
    body: 'Coletamos seus dados de treino do Garmin, perfil esportivo e métricas fisiológicas para gerar planos personalizados. Seus dados ficam armazenados em servidores no Brasil. Você pode exportar ou excluir seus dados a qualquer momento nas configurações.',
  },
  {
    icon: 'sparkles',
    tint: Colors.primary,
    title: 'IA generativa',
    body: 'Os planos são gerados pelo Claude (Anthropic). Aplicamos guardrails automáticos de segurança (carga máxima, progressão) mas sempre revise o plano antes de executar.',
  },
];

export default function DisclaimerScreen() {
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const [loading, setLoading] = useState(false);

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
        <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
        <Text style={styles.eyebrow}>Antes de começar</Text>
      </View>
      <Text style={styles.title}>Leia com atenção</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {CARDS.map((card) => (
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
        icon={<Ionicons name="checkmark" size={18} color={Colors.onAccent} />}
        accessibilityLabel="Aceitar termos e continuar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl + Spacing.md,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
  eyebrow: { ...Type.label, color: Colors.primary },
  title: { ...Type.headline, color: Colors.textPrimary, marginBottom: Spacing.md },
  scroll: { flex: 1 },
  scrollContent: { gap: Spacing.sm, paddingBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...Type.subtitle, fontSize: Type.body.fontSize, color: Colors.textPrimary },
  cardText: { ...Type.bodySm, color: Colors.textSecondary, lineHeight: 21 },
  btn: { marginTop: Spacing.md },
});
