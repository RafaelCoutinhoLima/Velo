import { useCallback, useEffect, useRef, useState } from 'react';
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
import { WorkoutCard, type WorkoutStatus, type WorkoutType } from '@fitsync/ui';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';
import {
  WorkoutStructure,
  type WorkoutStructureData,
} from '../../components/WorkoutStructure';

// Indexado por Date.getDay() (0 = domingo … 6 = sábado).
const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
}

// Data real do dia N do plano = week_start + (N-1). Meio-dia evita
// problemas de DST/fuso ao somar dias.
function planDayDate(weekStart: string, dayNumber: number): Date {
  const start = new Date(`${weekStart}T12:00:00`);
  const d = new Date(start);
  d.setDate(start.getDate() + (dayNumber - 1));
  return d;
}

// Nome do dia derivado da DATA real — não do índice. O dia 1 do plano
// não é necessariamente segunda-feira (depende de week_start).
function getDayLabel(weekStart: string, dayNumber: number): string {
  return PT_WEEKDAYS[planDayDate(weekStart, dayNumber).getDay()];
}

function getDayDateLabel(weekStart: string, dayNumber: number): string {
  return planDayDate(weekStart, dayNumber).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
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

function EmptyPlan({ athleteId, onPlanReady }: { athleteId: string; onPlanReady: () => void }) {
  const { post, get } = useApi();
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const res = await post<{ job_id?: string; plan?: unknown }>('/plan/generate', { athlete_id: athleteId });
      if (res?.job_id) {
        setJobId(res.job_id);
        pollJob(res.job_id);
      } else {
        onPlanReady();
      }
    } catch {
      setGenerating(false);
    }
  }

  function pollJob(id: string) {
    let attempts = 0;
    intervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const body = await get<{ status: string }>(`/jobs/${id}`);
        if (body.status === 'done') {
          clearInterval(intervalRef.current!);
          onPlanReady();
        } else if (body.status === 'failed' || attempts > 60) {
          clearInterval(intervalRef.current!);
          setGenerating(false);
          setJobId(null);
        }
      } catch { /* continua tentando */ }
    }, 5000);
  }

  return (
    <View style={styles.center}>
      {generating ? (
        <>
          <LoadingScreen
            message={jobId ? 'Processando seu plano...' : 'Gerando seu plano com IA...'}
            subMessage="Isso pode levar até 1 minuto"
          />
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Nenhum plano ativo</Text>
          <Text style={styles.emptyText}>
            Gere seu primeiro plano semanal personalizado com base no seu perfil e histórico.
          </Text>
          <Button
            label="Gerar meu plano"
            onPress={generate}
            style={styles.generateBtn}
            accessibilityLabel="Gerar plano de treino com IA"
          />
        </View>
      )}
    </View>
  );
}

function WhyCard({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.whyCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Recolher justificativa do plano' : 'Ver justificativa do plano'}
      accessibilityState={{ expanded }}
    >
      <View style={styles.whyHeader}>
        <Text style={styles.whyLabel}>Por que esses treinos</Text>
        <Text style={styles.whyChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && <Text style={styles.whyText}>{text}</Text>}
    </TouchableOpacity>
  );
}

function CalibrationBanner() {
  return (
    <View style={styles.calibBanner} accessibilityRole="alert">
      <Text style={styles.calibIcon}>🧪</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.calibTitle}>Modo calibração</Text>
        <Text style={styles.calibText}>
          Estamos aprendendo seu corpo. Daqui ~2 semanas o plano fica mais agressivo.
        </Text>
      </View>
    </View>
  );
}

function CalibrationDoneNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <TouchableOpacity
      style={styles.calibDone}
      onPress={onDismiss}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Calibração concluída. Toque para dispensar."
    >
      <Text style={styles.calibIcon}>✅</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.calibDoneTitle}>Calibração concluída</Text>
        <Text style={styles.calibText}>
          Já conhecemos seu condicionamento — seu plano agora progride normalmente.
        </Text>
      </View>
      <Text style={styles.calibDismiss}>✕</Text>
    </TouchableOpacity>
  );
}

function SendToWatch({ athleteId }: { athleteId: string }) {
  const { post } = useApi();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setStatus('sending');
    setMessage(null);
    try {
      const res = await post<{ ok: boolean; sent: number }>('/plan/send-to-garmin', {
        athlete_id: athleteId,
        week_number: 1,
      });
      setStatus('sent');
      setMessage(`${res.sent} treino${res.sent === 1 ? '' : 's'} enviado${res.sent === 1 ? '' : 's'} pro relógio.`);
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Não conseguimos enviar pro relógio.');
    }
  }

  return (
    <View style={styles.sendSection}>
      <Button
        label={status === 'sent' ? 'Enviado ✓' : 'Enviar semana pro relógio'}
        onPress={send}
        variant="secondary"
        loading={status === 'sending'}
        disabled={status === 'sending' || status === 'sent'}
        accessibilityLabel="Enviar treinos da semana para o relógio Garmin"
      />
      {status === 'error' && message ? (
        <View style={styles.sendFeedback}>
          <ErrorCard message={message} />
        </View>
      ) : null}
      {status === 'sent' && message ? (
        <Text style={styles.sendOk}>{message}</Text>
      ) : null}
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${start.toLocaleDateString('pt-BR', opts)} – ${end.toLocaleDateString('pt-BR', opts)}`;
}

function PlanHeader({ weekStart }: { weekStart: string }) {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View style={headerStyles.wrapper}>
      <View style={{ flex: 1 }}>
        <Text style={headerStyles.greeting}>{getGreeting()}</Text>
        <Text style={headerStyles.date}>{today}</Text>
      </View>
      <View style={headerStyles.badge}>
        <Text style={headerStyles.badgeText}>{formatWeekRange(weekStart)}</Text>
      </View>
    </View>
  );
}
const headerStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  greeting: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  badge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
});

export default function PlanScreen() {
  const session = useAuthStore((s) => s.session);
  const advancedMode = useAuthStore((s) => s.advancedMode);
  const lastSeenCalibrationMode = useAuthStore((s) => s.lastSeenCalibrationMode);
  const setLastSeenCalibrationMode = useAuthStore((s) => s.setLastSeenCalibrationMode);
  const { data, isLoading, refetch, isRefetching } = usePlan(session?.athlete_id ?? '');

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

  if (!session) return null;
  if (isLoading) return <LoadingScreen message="Carregando seu plano..." />;
  if (!plan) return <EmptyPlan athleteId={session.athlete_id} onPlanReady={refetch} />;

  const todayDayNumber = getTodayDayNumber(plan.week_start);
  const todayWorkout = todayDayNumber ? days.find((d) => d.day === todayDayNumber) : null;
  const restOfWeek = days.filter((d) => d.day !== todayDayNumber);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Header greeting */}
        <PlanHeader weekStart={plan.week_start} />

        {showCalibDone ? (
          <CalibrationDoneNotice onDismiss={() => setShowCalibDone(false)} />
        ) : null}
        {calibrationMode ? <CalibrationBanner /> : null}

        {/* Hero card — treino de hoje sempre no topo */}
        {todayWorkout && (
          <View style={styles.heroSection}>
            <Text style={styles.heroLabel}>HOJE</Text>
            <Animated.View style={selectedDay === todayWorkout.day ? { transform: [{ scale: pulseAnim }] } : undefined}>
              <TouchableOpacity
                onLongPress={() => handleLongPress(todayWorkout.day)}
                onPress={() => {
                  if (selectedDay !== null && selectedDay !== todayWorkout.day) {
                    handleMoveTo(todayWorkout.day);
                  } else if (selectedDay === todayWorkout.day) {
                    setSelectedDay(null);
                  }
                }}
                activeOpacity={0.9}
                delayLongPress={400}
                accessibilityLabel={`Treino de hoje: ${todayWorkout.type}, ${todayWorkout.duration_min} minutos`}
                accessibilityHint="Segure para mover de dia"
              >
                <WorkoutCard
                  dayLabel={getDayLabel(plan.week_start, todayWorkout.day)}
                  dateLabel={getDayDateLabel(plan.week_start, todayWorkout.day)}
                  type={todayWorkout.type}
                  duration_min={todayWorkout.duration_min}
                  distance_km={todayWorkout.distance_km}
                  zones={todayWorkout.zones}
                  description={todayWorkout.description}
                  status="today"
                  isDragging={selectedDay === todayWorkout.day}
                  style={[
                    styles.heroCard,
                    selectedDay === todayWorkout.day && styles.cardSelected,
                    selectedDay !== null && selectedDay !== todayWorkout.day && styles.cardTarget,
                  ]}
                />
              </TouchableOpacity>
            </Animated.View>
            <WorkoutStructure data={todayWorkout} advancedMode={advancedMode} />
            {/* Drag handle hint */}
            <Text style={styles.dragHandle}>⠿ Segure para mover de dia</Text>
          </View>
        )}

        {plan.why_text ? <WhyCard text={plan.why_text} /> : null}

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
        ) : null}

        {/* Restante da semana */}
        {restOfWeek.length > 0 && (
          <>
            <Text style={styles.weekLabel}>Esta semana</Text>
            {restOfWeek.map((item) => {
              const isSelected = selectedDay === item.day;
              const isTarget = selectedDay !== null && selectedDay !== item.day;
              return (
                <View key={item.day} style={styles.dayBlock}>
                  <Animated.View style={isSelected ? { transform: [{ scale: pulseAnim }] } : undefined}>
                    <TouchableOpacity
                      onLongPress={() => handleLongPress(item.day)}
                      onPress={() => {
                        if (selectedDay !== null && selectedDay !== item.day) {
                          handleMoveTo(item.day);
                        } else if (selectedDay === item.day) {
                          setSelectedDay(null);
                        }
                      }}
                      activeOpacity={0.85}
                      delayLongPress={400}
                      accessibilityLabel={`${getDayLabel(plan.week_start, item.day)}: ${item.type}, ${item.duration_min} minutos`}
                      accessibilityHint="Segure para mover de dia"
                    >
                      <WorkoutCard
                        dayLabel={getDayLabel(plan.week_start, item.day)}
                        dateLabel={getDayDateLabel(plan.week_start, item.day)}
                        type={item.type}
                        duration_min={item.duration_min}
                        distance_km={item.distance_km}
                        zones={item.zones}
                        description={item.description}
                        status={computeStatus(plan.week_start, item.day, item.type)}
                        isDragging={isSelected}
                        style={[isSelected && styles.cardSelected, isTarget && styles.cardTarget]}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                  <WorkoutStructure data={item} advancedMode={advancedMode} />
                </View>
              );
            })}
          </>
        )}

        <SendToWatch athleteId={session.athlete_id} />

        {advancedMode ? (
          <TouchableOpacity
            style={styles.advancedLink}
            onPress={() => router.push('/metrics' as never)}
            accessibilityRole="link"
            accessibilityLabel="Ver métricas técnicas ACWR, CTL e TSB"
          >
            <Text style={styles.advancedLinkText}>Ver métricas técnicas →</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.disclaimerFooter}>
          FitSync não substitui acompanhamento médico ou profissional.
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingTop: Spacing.xxl + Spacing.md, paddingBottom: Spacing.xl },
  center: { flex: 1 },
  heroSection: { marginBottom: Spacing.md },
  heroLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  // O destaque do "hoje" vem do glow lime do próprio WorkoutCard
  // (todayCard). NÃO empilhar Shadow.elevated aqui: a sombra preta de
  // raio 20 vazava por cima do card "Estrutura do treino" logo abaixo.
  heroCard: {
    borderRadius: Radii.lg,
  },
  dayBlock: {
    marginBottom: Spacing.md,
  },
  dragHandle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    letterSpacing: 0.3,
  },
  calibBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  calibDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  calibIcon: { fontSize: FontSize.xl },
  calibTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accent },
  calibDoneTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success },
  calibText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17, marginTop: 2 },
  calibDismiss: { fontSize: FontSize.md, color: Colors.textMuted, paddingHorizontal: Spacing.xs },
  whyCard: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  whyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whyLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  whyChevron: { fontSize: FontSize.xs, color: Colors.primary },
  whyText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.sm },
  moveBanner: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadow.card,
  },
  moveBannerText: { color: Colors.surface, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1 },
  moveBannerCancel: { color: Colors.primaryMuted, fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginLeft: Spacing.sm },
  weekLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cardSelected: { borderWidth: 2, borderColor: Colors.primary, borderRadius: Radii.lg },
  cardTarget: { opacity: 0.6 },
  sendSection: { marginTop: Spacing.md },
  sendFeedback: { marginTop: Spacing.sm },
  sendOk: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  advancedLink: { alignItems: 'center', paddingVertical: Spacing.md },
  advancedLinkText: { fontSize: FontSize.sm, color: Colors.accent, fontWeight: FontWeight.semibold },
  disclaimerFooter: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyIcon: { fontSize: 56, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  generateBtn: { width: '100%' },
});
