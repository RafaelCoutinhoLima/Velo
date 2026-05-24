import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSize, FontWeight, Radii, Spacing, Tracking, Type } from '../lib/theme';

type Plan = 'annual' | 'monthly';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'sparkles',
    title: 'Planos adaptativos via IA',
    desc: 'Treinos que evoluem em tempo real com base no seu desempenho diário.',
  },
  {
    icon: 'analytics',
    title: 'Métricas avançadas',
    desc: 'Análise profunda de zonas de FC, VO₂ máx, carga e recuperação.',
  },
  {
    icon: 'chatbubbles',
    title: 'Feedback ilimitado',
    desc: 'Orientações personalizadas geradas pela IA para manter sua motivação.',
  },
];

const PLANS: Record<Plan, { label: string; price: string; period: string; note?: string }> = {
  annual: { label: 'Anual', price: 'R$ 399,00', period: '/ano', note: '33% OFF' },
  monthly: { label: 'Mensal', price: 'R$ 49,90', period: '/mês' },
};

export default function SubscriptionScreen() {
  const [selected, setSelected] = useState<Plan>('annual');

  return (
    <View style={styles.container}>
      <View style={styles.bgGlow} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>FitSync Pro</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>Evolua com inteligência</Text>
          <Text style={styles.subtitle}>
            Desbloqueie seu potencial máximo com o treinador de IA definitivo.
          </Text>
        </View>

        {/* ── Benefícios ── */}
        <View style={styles.benefitsCard}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon} size={20} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Planos ── */}
        {(Object.keys(PLANS) as Plan[]).map((p) => {
          const plan = PLANS[p];
          const active = selected === p;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.planCard, active && styles.planCardActive]}
              onPress={() => setSelected(p)}
              activeOpacity={0.9}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Plano ${plan.label}, ${plan.price} ${plan.period}`}
            >
              {plan.note ? (
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{plan.note}</Text>
                </View>
              ) : null}
              <View style={styles.planTop}>
                <Text style={styles.planLabel}>{plan.label}</Text>
                <View style={[styles.radio, active && styles.radioOn]}>
                  {active ? <Ionicons name="checkmark" size={14} color={Colors.onAccent} /> : null}
                </View>
              </View>
              <View style={styles.planPriceRow}>
                <Text style={[styles.planPrice, active && { color: Colors.primary }]}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── CTA fixo ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.ctaBtn}
          accessibilityRole="button"
          accessibilityLabel="Assinar FitSync Pro"
        >
          <Text style={styles.ctaText}>Assinar {PLANS[selected].label}</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>Pagamentos integrados em breve · cancele quando quiser</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  bgGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: 'rgba(62,144,255,0.07)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl + Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontFamily: Fonts.data,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: Tracking.wider,
  },
  content: { padding: Spacing.lg, paddingBottom: 160, gap: Spacing.md },

  hero: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  title: { ...Type.headline, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Type.body, color: Colors.textSecondary, textAlign: 'center' },

  // Benefits
  benefitsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  benefitRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: { ...Type.subtitle, fontSize: FontSize.md, color: Colors.textPrimary },
  benefitDesc: { ...Type.bodySm, color: Colors.textSecondary, marginTop: 2 },

  // Plan cards
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  planCardActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceAlt },
  planBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderBottomLeftRadius: Radii.md,
  },
  planBadgeText: {
    fontFamily: Fonts.data,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.onAccent,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planLabel: { ...Type.title, fontSize: FontSize.xl, color: Colors.textPrimary },
  radio: {
    width: 24,
    height: 24,
    borderRadius: Radii.full,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: Spacing.xs },
  planPrice: {
    fontFamily: Fonts.displayBlack,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
  },
  planPeriod: { ...Type.bodySm, color: Colors.textMuted },

  // Footer CTA
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  ctaBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: Fonts.display,
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
    color: Colors.onAccent,
    textTransform: 'uppercase',
    letterSpacing: Tracking.wide,
  },
  footerNote: { ...Type.bodySm, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});
