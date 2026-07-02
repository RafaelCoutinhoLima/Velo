import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Fonts, FontSize, FontWeight, Radii, Spacing, Tracking, useTheme, type Theme } from '../lib/theme';

type Plan = 'annual' | 'monthly';

// Tela 27 — 4 benefícios do handoff.
const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'refresh',
    title: 'Plano que se refaz sozinho',
    desc: 'Cada sync do relógio recalibra sua semana com base na carga real.',
  },
  {
    icon: 'chatbubbles',
    title: 'Chat ilimitado com o treinador',
    desc: 'Pergunte, negocie treinos e entenda cada decisão do plano.',
  },
  {
    icon: 'analytics',
    title: 'Métricas avançadas',
    desc: 'ACWR, CTL, TSB e decoupling explicados em português claro.',
  },
  {
    icon: 'watch',
    title: 'Treinos direto no relógio',
    desc: 'Estruturados no Garmin — é só apertar start no aquecimento.',
  },
];

const PLANS: Record<
  Plan,
  { label: string; price: string; period: string; note?: string; sub?: string }
> = {
  annual: { label: 'Anual', price: 'R$ 20,90', period: '/mês', note: '−40%', sub: 'R$ 249/ano' },
  monthly: { label: 'Mensal', price: 'R$ 34,90', period: '/mês' },
};

export default function SubscriptionScreen() {
  const [selected, setSelected] = useState<Plan>('annual');
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
          <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Velo Pro</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 7l7 5-7 5M12 7l7 5-7 5"
                stroke={theme.colors.onAccent}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.title}>Velo Pro</Text>
          <Text style={styles.subtitle}>
            Um treinador que custa menos que um tênis por ano.
          </Text>
        </View>

        {/* ── Benefícios ── */}
        <View style={styles.benefitsCard}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon} size={18} color={theme.colors.primary} />
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
                  {active ? <Ionicons name="checkmark" size={14} color={theme.colors.onAccent} /> : null}
                </View>
              </View>
              <View style={styles.planPriceRow}>
                <Text style={[styles.planPrice, active && { color: theme.colors.primary }]}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
                {plan.sub ? <Text style={styles.planSub}>· {plan.sub}</Text> : null}
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
          accessibilityLabel="Assinar Velo Pro"
        >
          <Text style={styles.ctaText}>Começar 14 dias grátis</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          Cancela quando quiser. Sem cobrança no período de teste.
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    bgGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 280,
      backgroundColor: theme.colors.accentLight,
      opacity: 0.5,
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
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerLabel: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wider,
    },
    content: { padding: Spacing.lg, paddingBottom: 160, gap: Spacing.md },

    hero: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
      ...theme.shadow.glow,
    },
    title: { ...theme.type.display, color: theme.colors.textPrimary, textAlign: 'center' },
    subtitle: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center' },

    // Benefits
    benefitsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    benefitRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    benefitIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitTitle: { ...theme.type.subtitle, fontSize: FontSize.md, color: theme.colors.textPrimary },
    benefitDesc: { ...theme.type.bodySm, color: theme.colors.textSecondary, marginTop: 2 },

    // Plan cards
    planCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 2,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      overflow: 'hidden',
    },
    planCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryMuted },
    planBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: theme.colors.success,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderBottomLeftRadius: Radii.md,
    },
    planBadgeText: {
      fontFamily: Fonts.data,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: theme.colors.onAccent,
    },
    planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planLabel: { ...theme.type.title, fontSize: FontSize.xl, color: theme.colors.textPrimary },
    radio: {
      width: 24,
      height: 24,
      borderRadius: Radii.full,
      borderWidth: 2,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: Spacing.xs },
    planPrice: {
      fontFamily: Fonts.displayBlack,
      fontSize: FontSize['2xl'],
      fontWeight: FontWeight.extrabold,
      color: theme.colors.textPrimary,
    },
    planPeriod: { ...theme.type.bodySm, color: theme.colors.textMuted },
    planSub: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      fontVariant: ['tabular-nums'],
    },

    // Footer CTA
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      gap: Spacing.sm,
    },
    ctaBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: Radii.full,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    ctaText: {
      fontFamily: Fonts.display,
      fontSize: FontSize.md,
      fontWeight: FontWeight.extrabold,
      color: theme.colors.onAccent,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    footerNote: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.textMuted, textAlign: 'center' },
  });
