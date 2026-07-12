// Tela 05 — Treino de hoje (detalhe do treino planejado).
// Referência funcional: design_handoff_velo_identidade/Treino de Hoje.dc.html
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../lib/store';
import { useApi } from '../../../lib/api';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme, type ZoneCode } from '../../../lib/theme';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorCard } from '../../../components/ErrorCard';
import { BackHeader } from '../../../components/BackHeader';
import { SendToWatch } from '../../../components/plan/SendToWatch';
import {
  WorkoutProfile,
  ZONE_NAMES,
  segmentsFromStructure,
} from '../../../components/WorkoutProfile';
import type { WorkoutStructureData, WarmCool } from '../../../components/WorkoutStructure';

type WorkoutType = 'easy' | 'interval' | 'tempo' | 'long' | 'rest' | 'cross';

const TYPE_LABELS: Record<WorkoutType, string> = {
  easy: 'Rodagem Leve',
  interval: 'Treino Intervalado',
  tempo: 'Treino de Tempo',
  long: 'Treino Longo',
  rest: 'Descanso',
  cross: 'Cross Training',
};

// Nome curto da zona para o badge "Z2 · Base" dos segmentos.
const ZONE_SHORT: Record<ZoneCode, string> = {
  Z1: 'Recup.',
  Z2: 'Base',
  Z3: 'Tempo',
  Z4: 'Limiar',
  Z5: 'VO₂máx',
};

const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface WorkoutDay extends WorkoutStructureData {
  day: number;
  type: WorkoutType;
  duration_min: number;
  distance_km: number;
  zones: number[];
  description: string;
}

interface Plan {
  id: string;
  week_start: string;
  why_text: string;
  plan_json: { weeks: { days: WorkoutDay[]; why_text: string }[] };
}

function dateLabel(weekStart: string, dayNumber: number): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const d = new Date(start);
  d.setDate(start.getDate() + (dayNumber - 1));
  return `${PT_WEEKDAYS[d.getDay()]} · ${String(d.getDate()).padStart(2, '0')} ${PT_MONTHS[d.getMonth()]}`;
}

// Zona dominante — mesma regra do hero da home.
function mainZone(w: WorkoutDay): ZoneCode | null {
  if (w.parte_principal?.zona_alvo) return w.parte_principal.zona_alvo;
  if (w.zones && w.zones.length > 0) {
    const z = Math.min(Math.max(Math.max(...w.zones), 1), 5);
    return `Z${z}` as ZoneCode;
  }
  return null;
}

export default function PlannedWorkoutScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const session = useAuthStore((s) => s.session);
  const advancedMode = useAuthStore((s) => s.advancedMode);
  const { get } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Toggle Básico/Avançado da tela — começa no modo global do atleta.
  const [advanced, setAdvanced] = useState(advancedMode);

  const athleteId = session?.athlete_id ?? '';
  const { data, isLoading } = useQuery({
    queryKey: ['plan', athleteId],
    queryFn: () => get<{ plan: Plan | null }>(`/plan/current?athlete_id=${athleteId}`),
    enabled: !!athleteId,
    staleTime: 1000 * 60 * 5,
  });

  const plan = data?.plan;
  const dayNumber = Number(day);
  const workout = plan?.plan_json?.weeks?.[0]?.days?.find((d) => d.day === dayNumber);

  if (isLoading) return <LoadingScreen message="Carregando treino..." />;

  if (!plan || !workout) {
    return (
      <View style={styles.screen}>
        <BackHeader />
        <View style={{ padding: Spacing.md }}>
          <ErrorCard message="Treino não encontrado no plano atual." />
        </View>
      </View>
    );
  }

  const zone = mainZone(workout);
  const zoneColor = zone ? theme.colors.zones[zone].color : theme.colors.textSecondary;
  const segments = segmentsFromStructure(workout);
  const main = workout.parte_principal;
  const hasReps = !!main && typeof main.repeticoes === 'number' && main.repeticoes > 1;
  const keySession = zone === 'Z4' || zone === 'Z5';

  return (
    <View style={styles.screen}>
      <BackHeader
        right={<Text style={styles.headerDate}>{dateLabel(plan.week_start, workout.day)}</Text>}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: kicker de zona + título + descrição ── */}
        <View style={styles.hero}>
          {zone ? (
            <View style={styles.kickerRow}>
              <View style={[styles.kickerDot, { backgroundColor: zoneColor }]} />
              <Text style={[styles.kickerZone, { color: zoneColor }]}>{ZONE_NAMES[zone]}</Text>
              {keySession ? (
                <Text style={styles.kickerNote}>· Sessão-chave da semana</Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.heroTitle}>{TYPE_LABELS[workout.type]}</Text>
          {workout.description ? (
            <Text style={styles.heroDesc}>{workout.description}</Text>
          ) : null}
        </View>

        {/* ── Faixa de metas: duração · distância · carga ── */}
        <View style={styles.targetStrip}>
          <TargetCell value={`${workout.duration_min}`} unit="min" label="Duração" styles={styles} />
          {workout.distance_km > 0 ? (
            <>
              <View style={styles.targetDivider} />
              <TargetCell value={`${workout.distance_km}`} unit="km" label="Distância" styles={styles} />
            </>
          ) : null}
          {typeof workout.rtss_estimado === 'number' ? (
            <>
              <View style={styles.targetDivider} />
              <TargetCell
                value={`${Math.round(workout.rtss_estimado)}`}
                unit="rTSS"
                label="Carga"
                styles={styles}
              />
            </>
          ) : null}
        </View>

        {/* ── Perfil do treino ── */}
        {segments.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeadRow}>
              <Text style={styles.cardHeadLabel}>Perfil do treino</Text>
              <Text style={styles.cardHeadHint}>intensidade × tempo</Text>
            </View>
            <WorkoutProfile segments={segments} variant="detail" />
          </View>
        ) : null}

        {/* ── Estrutura + toggle Básico/Avançado ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Estrutura</Text>
          <View style={styles.toggle}>
            {(['Básico', 'Avançado'] as const).map((label, i) => {
              const active = (i === 1) === advanced;
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                  onPress={() => setAdvanced(i === 1)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Modo ${label}`}
                >
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.segments}>
          {workout.aquecimento ? (
            <WarmCoolCard
              label="Aquecimento"
              block={workout.aquecimento}
              styles={styles}
              theme={theme}
            />
          ) : null}

          {main ? (
            <View
              style={[
                styles.segmentCard,
                styles.mainCard,
                { borderColor: theme.colors.zones[main.zona_alvo].color, shadowColor: theme.colors.zones[main.zona_alvo].color },
              ]}
            >
              <View style={[styles.segmentRail, { backgroundColor: theme.colors.zones[main.zona_alvo].color }]} />
              <View style={styles.segmentBody}>
                <View style={styles.segmentHead}>
                  <View style={styles.segmentHeadLeft}>
                    <Text style={[styles.segmentLabel, { color: theme.colors.zones[main.zona_alvo].color }]}>
                      Bloco principal
                    </Text>
                    <View style={[styles.zoneBadge, { backgroundColor: theme.colors.zones[main.zona_alvo].soft }]}>
                      <Text style={[styles.zoneBadgeText, { color: theme.colors.zones[main.zona_alvo].color }]}>
                        {main.zona_alvo} · {ZONE_SHORT[main.zona_alvo]}
                      </Text>
                    </View>
                  </View>
                  {hasReps ? (
                    <Text style={[styles.repsCount, { color: theme.colors.zones[main.zona_alvo].color }]}>
                      {main.repeticoes}×
                    </Text>
                  ) : null}
                </View>

                {hasReps && main.duracao_repeticao_min ? (
                  <>
                    {/* Repetição: esforço */}
                    <View style={[styles.repWork, { backgroundColor: theme.colors.zones[main.zona_alvo].soft }]}>
                      <Text style={styles.repMin}>
                        {main.duracao_repeticao_min}
                        <Text style={styles.repMinUnit}>min</Text>
                      </Text>
                      <View style={styles.repDivider} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={styles.repDesc}>{main.descricao}</Text>
                        <Text style={[styles.repPace, { color: theme.colors.zones[main.zona_alvo].color }]}>
                          {main.pace_alvo ?? main.zona_alvo}
                          {advanced && main.fc_alvo_bpm ? (
                            <Text style={styles.repPaceMuted}>
                              {'  ·  '}
                              {main.fc_alvo_bpm.min}–{main.fc_alvo_bpm.max} bpm
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                    </View>

                    {/* Repetição: recuperação */}
                    {typeof main.recuperacao_min === 'number' ? (
                      <View style={styles.repRecovery}>
                        <Text style={styles.repRecoveryMin}>
                          {main.recuperacao_min}
                          <Text style={styles.repRecoveryUnit}>min</Text>
                        </Text>
                        <View style={styles.repDividerSm} />
                        <Text style={styles.repRecoveryText}>
                          Trote de recuperação{' '}
                          <Text style={styles.repRecoveryZone}>
                            {main.recuperacao_zona ?? 'Z1'}
                          </Text>
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.mainDesc}>{main.descricao}</Text>
                )}

                {advanced && workout.notas_tecnicas ? (
                  <View style={styles.advBlock}>
                    <Text style={styles.advText}>{workout.notas_tecnicas}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {workout.desaquecimento ? (
            <WarmCoolCard
              label="Desaquecimento"
              block={workout.desaquecimento}
              styles={styles}
              theme={theme}
            />
          ) : null}
        </View>

        {/* ── Por que este treino ── */}
        {plan.why_text ? (
          <View style={styles.whyCard}>
            <View style={styles.whyHead}>
              <Ionicons name="sunny-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.whyLabel}>Por que este treino</Text>
            </View>
            <Text style={styles.whyText}>{plan.why_text}</Text>
          </View>
        ) : null}

        {/* ── Ações ── */}
        <SendToWatch athleteId={athleteId} />
      </ScrollView>
    </View>
  );
}

function TargetCell({
  value,
  unit,
  label,
  styles,
}: {
  value: string;
  unit: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.targetCell}>
      <Text style={styles.targetValue}>
        {value}
        <Text style={styles.targetUnit}>{unit}</Text>
      </Text>
      <Text style={styles.targetLabel}>{label}</Text>
    </View>
  );
}

function WarmCoolCard({
  label,
  block,
  styles,
  theme,
}: {
  label: string;
  block: WarmCool;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  const palette = theme.colors.zones[block.zona];
  return (
    <View style={styles.segmentCard}>
      <View style={[styles.segmentRail, { backgroundColor: palette.color }]} />
      <View style={styles.segmentBody}>
        <View style={styles.segmentHead}>
          <View style={styles.segmentHeadLeft}>
            <Text style={styles.segmentLabel}>{label}</Text>
            <View style={[styles.zoneBadge, { backgroundColor: palette.soft }]}>
              <Text style={[styles.zoneBadgeText, { color: palette.color }]}>
                {block.zona} · {ZONE_SHORT[block.zona]}
              </Text>
            </View>
          </View>
          <Text style={styles.segmentMin}>
            {block.duracao_min}
            <Text style={styles.segmentMinUnit}>min</Text>
          </Text>
        </View>
        {block.pace_alvo ? (
          <View style={styles.paceCol}>
            <Text style={styles.paceLabel}>Pace</Text>
            <Text style={styles.paceValue}>{block.pace_alvo}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.bg },

    headerDate: {
      fontFamily: Fonts.data,
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
    },

    content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },

    // Hero
    hero: { gap: Spacing.sm },
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    kickerDot: { width: 9, height: 9, borderRadius: Radii.full },
    kickerZone: {
      fontFamily: Fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    kickerNote: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
    },
    heroTitle: {
      fontFamily: Fonts.displayBlack,
      fontSize: 33,
      lineHeight: 35,
      letterSpacing: -0.8,
      color: theme.colors.textPrimary,
    },
    heroDesc: {
      fontFamily: Fonts.body,
      fontSize: 13.5,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },

    // Target strip
    targetStrip: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: Radii.lg,
      overflow: 'hidden',
    },
    targetCell: {
      flex: 1,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      gap: 3,
    },
    targetDivider: { width: 1, backgroundColor: theme.colors.divider },
    targetValue: {
      fontFamily: Fonts.dataBold,
      fontSize: 23,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    targetUnit: { fontFamily: Fonts.data, fontSize: 12, color: theme.colors.textSecondary },
    targetLabel: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
    },

    // Card genérico (perfil)
    card: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
    },
    cardHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    cardHeadLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
    },
    cardHeadHint: {
      fontFamily: Fonts.data,
      fontSize: 11,
      color: theme.colors.textMuted,
    },

    // Section header + toggle
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    sectionTitle: {
      fontFamily: Fonts.display,
      fontSize: 17,
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    toggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: Radii.full,
      padding: 3,
      gap: 2,
    },
    toggleBtn: {
      paddingHorizontal: Spacing.md - 2,
      paddingVertical: 6,
      borderRadius: Radii.full,
    },
    toggleBtnActive: {
      backgroundColor: theme.colors.surface,
      // No escuro a elevação vira superfície (sem sombra), como o resto do tema.
      ...(theme.name === 'veloDark'
        ? null
        : {
            shadowColor: theme.colors.textPrimary,
            shadowOpacity: 0.12,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }),
    },
    toggleText: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    toggleTextActive: { color: theme.colors.primary },

    // Segmentos
    segments: { gap: 10 },
    segmentCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: Radii.lg,
      overflow: 'hidden',
    },
    mainCard: {
      borderWidth: 1.5,
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    segmentRail: { width: 5 },
    segmentBody: { flex: 1, padding: Spacing.md - 1, gap: Spacing.sm },
    segmentHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    segmentHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    segmentLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
    },
    zoneBadge: {
      borderRadius: Radii.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    zoneBadgeText: {
      fontFamily: Fonts.dataBold,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    segmentMin: {
      fontFamily: Fonts.dataBold,
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    segmentMinUnit: { fontSize: 11, color: theme.colors.textMuted, fontFamily: Fonts.data },
    paceCol: { gap: 1 },
    paceLabel: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 9.5,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
    },
    paceValue: {
      fontFamily: Fonts.dataSemiBold,
      fontSize: 13,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    // Bloco principal — repetições
    repsCount: { fontFamily: Fonts.displayBlack, fontSize: 19 },
    repWork: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 13,
    },
    repMin: {
      fontFamily: Fonts.dataBold,
      fontSize: 18,
      color: theme.colors.textPrimary,
      minWidth: 52,
      fontVariant: ['tabular-nums'],
    },
    repMinUnit: { fontSize: 11, color: theme.colors.textMuted, fontFamily: Fonts.data },
    repDivider: { width: 1, height: 26, backgroundColor: theme.colors.divider },
    repDividerSm: { width: 1, height: 18, backgroundColor: theme.colors.divider },
    repDesc: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: 12.5,
      color: theme.colors.textPrimary,
    },
    repPace: {
      fontFamily: Fonts.dataSemiBold,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    repPaceMuted: { color: theme.colors.textMuted },
    repRecovery: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 13,
    },
    repRecoveryMin: {
      fontFamily: Fonts.dataBold,
      fontSize: 14,
      color: theme.colors.zones.Z1.color,
      minWidth: 52,
      fontVariant: ['tabular-nums'],
    },
    repRecoveryUnit: { fontSize: 10, fontFamily: Fonts.data },
    repRecoveryText: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    repRecoveryZone: {
      fontFamily: Fonts.dataSemiBold,
      color: theme.colors.zones.Z1.color,
    },
    mainDesc: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      lineHeight: 19,
      color: theme.colors.textPrimary,
    },
    advBlock: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
      paddingTop: 9,
      gap: 7,
    },
    advText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textSecondary,
    },

    // Por que este treino
    whyCard: {
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}4D`,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    whyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    whyLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.primary,
    },
    whyText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      lineHeight: 20,
      color: theme.colors.textPrimary,
    },
  });
