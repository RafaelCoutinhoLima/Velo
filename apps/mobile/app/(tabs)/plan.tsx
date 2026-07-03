import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';

type WorkoutType = 'easy' | 'interval' | 'tempo' | 'long' | 'rest' | 'cross';
type WorkoutStatus = 'done' | 'today' | 'future' | 'rest';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, FontWeight, Radii, Spacing, Tracking, useTheme, type Theme } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Button } from '../../components/Button';
import { TopBar } from '../../components/TopBar';
import { type WorkoutStructureData } from '../../components/WorkoutStructure';
import {
  WorkoutProfile,
  ZONE_NAMES,
  segmentsFromStructure,
} from '../../components/WorkoutProfile';
import type { ZoneCode } from '../../lib/theme';
import { CoachInsights } from '../../components/plan/CoachInsights';
import { MetricChip } from '../../components/plan/MetricChip';
import { CalibrationBanner } from '../../components/plan/CalibrationBanner';
import { FallbackPlanBanner } from '../../components/plan/FallbackPlanBanner';
import { CalibrationDoneNotice } from '../../components/plan/CalibrationDoneNotice';
import { WeeklyGoalRing } from '../../components/plan/WeeklyGoalRing';
import { EmptyPlan } from '../../components/plan/EmptyPlan';
import { SendToWatch } from '../../components/plan/SendToWatch';

// Indexado por Date.getDay() (0 = domingo … 6 = sábado).
const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PT_WEEKDAYS_FULL = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

const TYPE_LABELS: Record<WorkoutType, string> = {
  easy: 'Rodagem Leve',
  interval: 'Treino Intervalado',
  tempo: 'Treino de Tempo',
  long: 'Treino Longo',
  rest: 'Descanso',
  cross: 'Cross Training',
};

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

interface PlanResponse {
  plan: Plan | null;
  calibration_mode?: boolean;
  used_fallback?: boolean;
}

// Data real do dia N do plano = week_start + (N-1). Meio-dia evita
// problemas de DST/fuso ao somar dias.
function planDayDate(weekStart: string, dayNumber: number): Date {
  const start = new Date(`${weekStart}T12:00:00`);
  const d = new Date(start);
  d.setDate(start.getDate() + (dayNumber - 1));
  return d;
}

function getDayLabel(weekStart: string, dayNumber: number): string {
  return PT_WEEKDAYS[planDayDate(weekStart, dayNumber).getDay()];
}

function getDayLabelFull(weekStart: string, dayNumber: number): string {
  return PT_WEEKDAYS_FULL[planDayDate(weekStart, dayNumber).getDay()];
}

function getTodayDayNumber(weekStart: string): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${weekStart}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return i + 1;
  }
  return null;
}

function computeStatus(weekStart: string, dayNumber: number, type: WorkoutType): WorkoutStatus {
  if (type === 'rest') return 'rest';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${weekStart}T12:00:00`);
  const dayDate = new Date(start);
  dayDate.setDate(start.getDate() + (dayNumber - 1));
  dayDate.setHours(0, 0, 0, 0);
  if (dayDate.getTime() === today.getTime()) return 'today';
  if (dayDate < today) return 'done';
  return 'future';
}

function zoneLabel(zones: number[]): string | null {
  if (!zones || zones.length === 0) return null;
  const min = Math.min(...zones);
  const max = Math.max(...zones);
  return min === max ? `Z${min}` : `Z${min}-Z${max}`;
}

// Zona dominante do treino — usada no kicker do hero (ponto + nome da zona).
// Prioriza a zona-alvo da parte principal; senão, a mais alta do dia.
function mainZone(w: WorkoutDay): ZoneCode | null {
  if (w.parte_principal?.zona_alvo) return w.parte_principal.zona_alvo;
  if (w.zones && w.zones.length > 0) {
    const z = Math.min(Math.max(Math.max(...w.zones), 1), 5);
    return `Z${z}` as ZoneCode;
  }
  return null;
}

function usePlan(athleteId: string) {
  const { get } = useApi();
  return useQuery({
    queryKey: ['plan', athleteId],
    queryFn: () => get<PlanResponse>(`/plan/current?athlete_id=${athleteId}`),
    enabled: !!athleteId,
    staleTime: 1000 * 60 * 5,
  });
}

function useMoveMutation(planId: string) {
  const qc = useQueryClient();
  const { patch } = useApi();
  return useMutation({
    mutationFn: (args: { workout_day: number; target_day: number; force?: boolean }) =>
      patch<{ ok: boolean; requires_confirmation?: boolean; warning?: string }>(
        '/plan/move',
        { plan_id: planId, ...args },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan'] }),
  });
}

export default function PlanScreen() {
  const session = useAuthStore((s) => s.session);
  const lastSeenCalibrationMode = useAuthStore((s) => s.lastSeenCalibrationMode);
  const setLastSeenCalibrationMode = useAuthStore((s) => s.setLastSeenCalibrationMode);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { data, isLoading, refetch, isRefetching } = usePlan(session?.athlete_id ?? '');

  const TYPE_COLORS: Record<WorkoutType, string> = {
    easy: theme.colors.workoutEasy,
    interval: theme.colors.workoutInterval,
    tempo: theme.colors.workoutTempo,
    long: theme.colors.workoutLong,
    rest: theme.colors.workoutRest,
    cross: theme.colors.workoutCross,
  };

  const plan = data?.plan;
  const calibrationMode = data?.calibration_mode ?? lastSeenCalibrationMode ?? false;
  const [showCalibDone, setShowCalibDone] = useState(false);

  // US-017: detecta a transição calibração → concluída uma única vez,
  // comparando o valor do servidor com o último visto (persistido no
  // store — independe de `profile`, que pode estar null).
  useEffect(() => {
    const serverMode = data?.calibration_mode;
    if (serverMode === undefined) return;
    if (lastSeenCalibrationMode === serverMode) return;
    if (lastSeenCalibrationMode === true && serverMode === false) {
      setShowCalibDone(true);
    }
    setLastSeenCalibrationMode(serverMode);
  }, [data?.calibration_mode, lastSeenCalibrationMode, setLastSeenCalibrationMode]);
  const planId = plan?.id ?? '';
  const moveMutation = useMoveMutation(planId);

  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: number; to: number; warning: string } | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const planDays = plan?.plan_json?.weeks?.[0]?.days ?? [];
    setDays([...planDays].sort((a, b) => a.day - b.day));
  }, [plan]);

  useEffect(() => {
    if (selectedDay !== null) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseRef.current?.stop(); };
  }, [selectedDay, pulseAnim]);

  const handleLongPress = useCallback((dayNumber: number) => {
    setSelectedDay((prev) => (prev === dayNumber ? null : dayNumber));
  }, []);

  const handleMoveTo = useCallback(
    (targetDayNumber: number) => {
      if (selectedDay === null) return;
      moveMutation
        .mutateAsync({ workout_day: selectedDay, target_day: targetDayNumber })
        .then((result) => {
          if (result.ok) {
            setSelectedDay(null);
          } else if (result.requires_confirmation) {
            setPendingMove({
              from: selectedDay,
              to: targetDayNumber,
              warning: result.warning ?? 'Esse arranjo pode comprometer sua recuperação.',
            });
            setSelectedDay(null);
          }
        })
        .catch(() => setSelectedDay(null));
    },
    [selectedDay, moveMutation],
  );

  function confirmMove() {
    if (!pendingMove) return;
    moveMutation
      .mutateAsync({ workout_day: pendingMove.from, target_day: pendingMove.to, force: true })
      .finally(() => setPendingMove(null));
  }

  function handleDayPress(dayNumber: number, type: WorkoutType) {
    if (selectedDay !== null && selectedDay !== dayNumber) {
      handleMoveTo(dayNumber);
    } else if (selectedDay === dayNumber) {
      setSelectedDay(null);
    } else if (type !== 'rest') {
      router.push(`/plan/workout/${dayNumber}` as never);
    }
  }

  if (!session) return null;
  if (isLoading) {
    return (
      <View style={styles.screen}>
        <TopBar />
        <LoadingScreen message="Carregando seu plano..." />
      </View>
    );
  }
  if (!plan) {
    return (
      <View style={styles.screen}>
        <TopBar />
        <EmptyPlan athleteId={session.athlete_id} onPlanReady={refetch} />
      </View>
    );
  }

  const todayDayNumber = getTodayDayNumber(plan.week_start);
  const todayWorkout = todayDayNumber ? days.find((d) => d.day === todayDayNumber) : null;
  const restOfWeek = days.filter((d) => d.day !== todayDayNumber);

  const trainingDays = days.filter((d) => d.type !== 'rest');
  const doneCount = trainingDays.filter(
    (d) => computeStatus(plan.week_start, d.day, d.type) === 'done',
  ).length;

  return (
    <View style={styles.screen}>
      <TopBar />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
      >
        <WeeklyGoalRing done={doneCount} total={trainingDays.length} />

        {showCalibDone ? (
          <CalibrationDoneNotice onDismiss={() => setShowCalibDone(false)} />
        ) : null}
        {data?.used_fallback ? <FallbackPlanBanner /> : null}
        {calibrationMode ? <CalibrationBanner /> : null}

        {/* ── Hero: treino de hoje ── */}
        {todayWorkout ? (
          <Animated.View
            style={selectedDay === todayWorkout.day ? { transform: [{ scale: pulseAnim }] } : undefined}
          >
            <TouchableOpacity
              activeOpacity={0.95}
              delayLongPress={400}
              onLongPress={() => handleLongPress(todayWorkout.day)}
              onPress={() => {
                if (selectedDay !== null && selectedDay !== todayWorkout.day) {
                  handleMoveTo(todayWorkout.day);
                } else if (selectedDay === todayWorkout.day) {
                  setSelectedDay(null);
                }
              }}
              style={[
                styles.heroCard,
                selectedDay !== null && selectedDay !== todayWorkout.day && styles.cardTarget,
              ]}
              accessibilityLabel={`Treino de hoje: ${TYPE_LABELS[todayWorkout.type]}, ${todayWorkout.duration_min} minutos`}
              accessibilityHint="Segure para mover de dia"
            >
              <View style={styles.heroEyebrowRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Treino de Hoje</Text>
                </View>
                <Text style={styles.heroWeekday}>
                  {getDayLabelFull(plan.week_start, todayWorkout.day)}
                </Text>
              </View>

              {(() => {
                const zone = mainZone(todayWorkout);
                if (!zone || todayWorkout.type === 'rest') return null;
                const zoneColor = theme.colors.zones[zone].color;
                return (
                  <View style={styles.heroZoneRow}>
                    <View style={[styles.heroZoneDot, { backgroundColor: zoneColor }]} />
                    <Text style={[styles.heroZoneLabel, { color: zoneColor }]}>
                      {ZONE_NAMES[zone]}
                    </Text>
                  </View>
                );
              })()}

              <Text style={styles.heroTitle}>{TYPE_LABELS[todayWorkout.type]}</Text>

              <View style={styles.chipRow}>
                <MetricChip icon="timer-outline" value={`${todayWorkout.duration_min} min`} />
                {zoneLabel(todayWorkout.zones) ? (
                  <MetricChip
                    icon="heart-outline"
                    value={zoneLabel(todayWorkout.zones)!}
                    tint={theme.colors.accent}
                  />
                ) : null}
                {todayWorkout.parte_principal?.pace_alvo ? (
                  <MetricChip
                    icon="speedometer-outline"
                    value={`Pace ${todayWorkout.parte_principal.pace_alvo}`}
                  />
                ) : todayWorkout.distance_km > 0 ? (
                  <MetricChip icon="map-outline" value={`${todayWorkout.distance_km} km`} />
                ) : null}
              </View>

              {todayWorkout.type !== 'rest' ? (
                <WorkoutProfile segments={segmentsFromStructure(todayWorkout)} variant="mini" />
              ) : null}

              {todayWorkout.type !== 'rest' ? (
                <Button
                  label="Ver treino de hoje"
                  onPress={() => router.push(`/plan/workout/${todayWorkout.day}` as never)}
                  icon={<Ionicons name="play" size={20} color={theme.colors.onAccent} />}
                  accessibilityLabel="Ver detalhe do treino de hoje"
                />
              ) : null}
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {plan.why_text ? <CoachInsights text={plan.why_text} /> : null}

        {selectedDay !== null ? (
          <View style={styles.moveBanner}>
            <Text style={styles.moveBannerText}>
              Segurando {getDayLabel(plan.week_start, selectedDay)} — toque em outro dia para mover
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedDay(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancelar mover treino"
            >
              <Text style={styles.moveBannerCancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.dragHint}>⠿  Segure um treino para mover de dia</Text>
        )}

        {/* ── Timeline do restante da semana ── */}
        {restOfWeek.length > 0 ? (
          <View style={styles.timeline}>
            <View style={styles.timelineLine} />
            {restOfWeek.map((item) => {
              const status = computeStatus(plan.week_start, item.day, item.type);
              const isSelected = selectedDay === item.day;
              const isTarget = selectedDay !== null && selectedDay !== item.day;
              const isDone = status === 'done';
              const tint = TYPE_COLORS[item.type];
              const zl = zoneLabel(item.zones);

              return (
                <View key={item.day}>
                  <Animated.View
                    style={[
                      styles.timelineRow,
                      isSelected ? { transform: [{ scale: pulseAnim }] } : null,
                    ]}
                  >
                    <View style={styles.dotCol}>
                      {isDone ? (
                        <View style={styles.dotDone}>
                          <Ionicons name="checkmark" size={12} color={theme.colors.onAccent} />
                        </View>
                      ) : (
                        <View style={styles.dot} />
                      )}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      delayLongPress={400}
                      onLongPress={() => handleLongPress(item.day)}
                      onPress={() => handleDayPress(item.day, item.type)}
                      style={[
                        styles.dayCard,
                        isDone && styles.dayCardDone,
                        item.type === 'rest' && styles.dayCardRest,
                        isSelected && styles.cardSelected,
                        isTarget && styles.cardTarget,
                      ]}
                      accessibilityLabel={`${getDayLabel(plan.week_start, item.day)}: ${TYPE_LABELS[item.type]}, ${item.duration_min} minutos`}
                      accessibilityHint="Segure para mover de dia"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayEyebrow}>
                          {getDayLabel(plan.week_start, item.day)}
                          {isDone ? ' • Feito' : ''}
                        </Text>
                        <Text
                          style={[
                            styles.dayName,
                            (isDone || item.type === 'rest') && styles.dayNameMuted,
                          ]}
                        >
                          {TYPE_LABELS[item.type]}
                        </Text>
                      </View>
                      {item.type !== 'rest' ? (
                        <View style={styles.dayBadges}>
                          <Text style={styles.dayBadge}>{item.duration_min}m</Text>
                          {zl ? (
                            <Text style={[styles.dayBadge, styles.dayBadgeZone, { color: tint, borderColor: `${tint}55` }]}>
                              {zl}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── Ações ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/metrics' as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver métricas e detalhes"
          >
            <Ionicons name="analytics-outline" size={18} color={theme.colors.textPrimary} />
            <Text style={styles.actionBtnText}>Métricas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/plan/new' as never)}
            accessibilityRole="button"
            accessibilityLabel="Pedir um novo plano"
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.accent} />
            <Text style={[styles.actionBtnText, { color: theme.colors.accent }]}>Novo Plano</Text>
          </TouchableOpacity>
        </View>

        <SendToWatch athleteId={session.athlete_id} />

        <Text style={styles.disclaimerFooter}>
          A Velo não substitui acompanhamento médico ou profissional.
        </Text>
      </ScrollView>

      <ConfirmModal
        visible={pendingMove !== null}
        title="Atenção"
        message={pendingMove?.warning ?? ''}
        confirmLabel="Confirmar mesmo assim"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        onConfirm={confirmMove}
        onCancel={() => setPendingMove(null)}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.bg },
    container: { flex: 1 },
    content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },

    // Hero card
    heroCard: {
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      ...theme.shadow.elevated,
    },
    heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    heroPill: {
      backgroundColor: theme.colors.primary,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 4,
    },
    heroPillText: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: theme.colors.onAccent,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    heroWeekday: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    heroZoneRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    heroZoneDot: { width: 8, height: 8, borderRadius: Radii.full },
    heroZoneLabel: {
      fontFamily: Fonts.dataSemiBold,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    heroTitle: { ...theme.type.display, color: theme.colors.textPrimary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

    // Move banner / drag hint
    dragHint: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    moveBanner: {
      backgroundColor: theme.colors.primary,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...theme.shadow.glow,
    },
    moveBannerText: { ...theme.type.bodyStrong, color: theme.colors.onAccent, flex: 1 },
    moveBannerCancel: {
      ...theme.type.bodyStrong,
      color: theme.colors.onAccent,
      marginLeft: Spacing.sm,
      textDecorationLine: 'underline',
    },

    // Timeline
    timeline: { position: 'relative' },
    timelineLine: {
      position: 'absolute',
      left: 11,
      top: 16,
      bottom: 16,
      width: 1.5,
      backgroundColor: theme.colors.border,
    },
    timelineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: 4 },
    dotCol: { width: 24, alignItems: 'center' },
    dot: {
      width: 12,
      height: 12,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.borderStrong,
      borderWidth: 3,
      borderColor: theme.colors.bg,
    },
    dotDone: {
      width: 22,
      height: 22,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.md,
    },
    dayCardDone: { opacity: 0.6 },
    dayCardRest: { borderStyle: 'dashed', backgroundColor: 'transparent' },
    dayEyebrow: {
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
      marginBottom: 2,
    },
    dayName: { ...theme.type.subtitle, fontSize: FontSize.md, color: theme.colors.textPrimary },
    dayNameMuted: { color: theme.colors.textSecondary },
    dayBadges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    dayBadge: {
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: Radii.sm,
      overflow: 'hidden',
    },
    dayBadgeZone: {
      backgroundColor: 'transparent',
      borderWidth: 1,
    },
    cardSelected: { borderWidth: 2, borderColor: theme.colors.primary },
    cardTarget: { opacity: 0.55 },

    // Actions
    actionRow: { flexDirection: 'row', gap: Spacing.sm },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.md,
      paddingVertical: Spacing.md - 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionBtnText: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },

    disclaimerFooter: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
  });
