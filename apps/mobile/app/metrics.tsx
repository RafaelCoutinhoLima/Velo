import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../lib/store';
import { useApi } from '../lib/api';
import { Fonts, FontSize, FontWeight, Radii, Spacing, Tracking, useTheme, type Theme } from '../lib/theme';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorCard } from '../components/ErrorCard';

interface MetricsPoint {
  date: string;
  ctl: number;
  tsb: number;
  acwr: number;
}

interface CurrentMetrics {
  date: string;
  atl: number;
  ctl: number;
  tsb: number;
  acwr: number;
}

export default function MetricsScreen() {
  const session = useAuthStore((s) => s.session);
  const advancedMode = useAuthStore((s) => s.advancedMode);
  const setAdvancedMode = useAuthStore((s) => s.setAdvancedMode);
  const { get } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function acwrColor(acwr: number | null): string {
    if (acwr == null) return theme.colors.textMuted;
    if (acwr > 1.3) return theme.colors.danger;
    if (acwr > 1.1) return theme.colors.warning;
    return theme.colors.success;
  }

  function acwrStatus(acwr: number | null): string {
    if (acwr == null) return 'Sem dados';
    if (acwr > 1.3) return 'Risco elevado';
    if (acwr > 1.1) return 'Atenção';
    return 'Zona segura';
  }

  function MetricBox({
    label,
    value,
    unit,
    color,
    statusColor,
    statusText,
    description,
  }: {
    label: string;
    value: number | null;
    unit?: string;
    color: string;
    statusColor: string;
    statusText: string;
    description: string;
  }) {
    const [expanded, setExpanded] = useState(false);

    return (
      <TouchableOpacity
        style={styles.metricBox}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value != null ? value.toFixed(1) : 'sem dados'}. ${statusText}. Toque para ${expanded ? 'recolher' : 'ver'} descrição`}
      >
        <View style={styles.metricTop}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Ionicons name={expanded ? 'close' : 'information-circle-outline'} size={16} color={theme.colors.textMuted} />
        </View>
        <Text style={[styles.metricValue, { color }]}>
          {value != null ? value.toFixed(1) : '—'}
          {unit && value != null ? <Text style={styles.metricUnit}> {unit}</Text> : null}
        </Text>
        <View style={styles.metricStatus}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
        {expanded ? <Text style={styles.metricDesc}>{description}</Text> : null}
      </TouchableOpacity>
    );
  }

  function LoadChart({ history }: { history: MetricsPoint[] }) {
    if (!history.length) {
      return (
        <View style={styles.chartBox}>
          <Text style={styles.noData}>Sem dados históricos suficientes</Text>
        </View>
      );
    }

    const lastN = history.slice(-42);
    const maxCTL = Math.max(...lastN.map((h) => h.ctl ?? 0), 1);

    return (
      <View style={styles.chartBox}>
        <Text style={styles.chartTitle}>Carga (CTL) — últimas 6 semanas</Text>
        <View style={styles.bars}>
          {lastN.map((point, i) => {
            const height = Math.max(4, ((point.ctl ?? 0) / maxCTL) * 80);
            const isWeekEnd = (i + 1) % 7 === 0;
            return (
              <View key={point.date} style={styles.barWrapper}>
                <View style={[styles.bar, { height }]} />
                {isWeekEnd ? <View style={styles.weekDivider} /> : null}
              </View>
            );
          })}
        </View>
        <View style={styles.chartLegend}>
          <Text style={styles.legendText}>← 6 semanas atrás</Text>
          <Text style={styles.legendText}>Hoje →</Text>
        </View>
      </View>
    );
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['metrics', session?.athlete_id],
    queryFn: () =>
      get<{ current: CurrentMetrics | null; history: MetricsPoint[] }>(
        `/plan/metrics?athlete_id=${session?.athlete_id}`,
      ),
    enabled: !!session?.athlete_id,
    staleTime: 1000 * 60 * 10,
  });

  if (!session) return null;
  if (isLoading) return <LoadingScreen message="Carregando métricas..." />;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Métricas</Text>
            <Text style={styles.subtitle}>Análise profunda de performance.</Text>
          </View>
        </View>

        <View style={styles.advToggle}>
          <Text style={styles.advLabel}>Modo Avançado</Text>
          <Switch
            value={advancedMode}
            onValueChange={setAdvancedMode}
            trackColor={{ false: theme.colors.surfaceAlt, true: theme.colors.primary }}
            thumbColor={theme.colors.surface}
            ios_backgroundColor={theme.colors.surfaceAlt}
            accessibilityLabel="Modo avançado de métricas"
          />
        </View>

        {isError ? (
          <ErrorCard message="Não conseguimos carregar suas métricas. Tente novamente." />
        ) : !data?.current ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="bar-chart-outline" size={36} color={theme.colors.primary} />
            </View>
            <Text style={styles.noData}>
              Métricas disponíveis após sincronizar pelo menos uma semana de treinos.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <MetricBox
                label="ACWR"
                value={data.current.acwr}
                color={acwrColor(data.current.acwr)}
                statusColor={acwrColor(data.current.acwr)}
                statusText={acwrStatus(data.current.acwr)}
                description="Rácio de carga aguda/crônica. Ideal entre 0,8–1,3. Acima de 1,3 = risco elevado de lesão."
              />
              <MetricBox
                label="CTL"
                value={data.current.ctl}
                unit="TSS"
                color={theme.colors.accent}
                statusColor={theme.colors.accent}
                statusText="Fitness de base"
                description="Carga crônica (fitness de base). Sobe com treino consistente ao longo de semanas."
              />
              <MetricBox
                label="TSB"
                value={data.current.tsb}
                color={data.current.tsb >= 0 ? theme.colors.success : theme.colors.warning}
                statusColor={data.current.tsb >= 0 ? theme.colors.success : theme.colors.warning}
                statusText={data.current.tsb >= 0 ? 'Recuperado' : 'Fadiga leve'}
                description="Balanço de treino (forma). Positivo = mais descansado e fresco; negativo = fadiga acumulada."
              />
              <MetricBox
                label="ATL"
                value={data.current.atl}
                unit="TSS"
                color={theme.colors.workoutCross}
                statusColor={theme.colors.workoutCross}
                statusText="Carga aguda"
                description="Carga aguda (fadiga recente dos últimos 7 dias). Sobe rapidamente com volume intenso."
              />
            </View>

            <LoadChart history={data.history} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    headerBar: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xl + Spacing.xs,
      paddingBottom: Spacing.sm,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: Radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },

    titleRow: { flexDirection: 'row', alignItems: 'flex-end' },
    title: { ...theme.type.display, color: theme.colors.textPrimary },
    subtitle: { ...theme.type.body, color: theme.colors.textSecondary, marginTop: Spacing.xs },

    advToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    advLabel: { ...theme.type.label, color: theme.colors.textSecondary },

    // Bento grid
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    metricBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      flexGrow: 1,
      flexBasis: '46%',
    },
    metricTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    metricLabel: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    metricValue: {
      fontFamily: Fonts.displayBlack,
      fontSize: 32,
      fontWeight: FontWeight.extrabold,
      fontVariant: ['tabular-nums'],
    },
    metricUnit: { fontFamily: Fonts.display, fontSize: FontSize.sm, color: theme.colors.textMuted },
    metricStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.xs },
    statusDot: { width: 7, height: 7, borderRadius: Radii.full },
    statusText: { fontFamily: Fonts.data, fontSize: FontSize.xs },
    metricDesc: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: Spacing.sm,
    },

    // Chart
    chartBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    chartTitle: { ...theme.type.label, color: theme.colors.textSecondary, marginBottom: Spacing.md },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 88 },
    barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 2, backgroundColor: theme.colors.primary },
    weekDivider: { position: 'absolute', right: -1, top: 0, bottom: 0, width: 1, backgroundColor: theme.colors.border },
    chartLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    legendText: { fontFamily: Fonts.data, fontSize: FontSize.xs, color: theme.colors.textMuted },

    // Empty
    noData: { ...theme.type.body, color: theme.colors.textMuted, textAlign: 'center' },
    emptyWrap: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
