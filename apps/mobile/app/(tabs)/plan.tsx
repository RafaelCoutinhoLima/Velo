import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkoutCard, type WorkoutStatus, type WorkoutType } from '@fitsync/ui';
import { useAuthStore } from '../../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const PT_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface WorkoutDay {
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

function getDayLabel(dayNumber: number): string {
  return PT_DAYS[(dayNumber - 1) % 7];
}

function getDayDateLabel(weekStart: string, dayNumber: number): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const d = new Date(start);
  d.setDate(start.getDate() + (dayNumber - 1));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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
  return useQuery({
    queryKey: ['plan', athleteId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/plan/current?athlete_id=${athleteId}`);
      if (!res.ok) throw new Error('Falha ao buscar plano');
      return res.json() as Promise<{ plan: Plan | null }>;
    },
    enabled: !!athleteId,
    staleTime: 1000 * 60 * 5,
  });
}

function useMoveMutation(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workout_day,
      target_day,
      force,
    }: {
      workout_day: number;
      target_day: number;
      force?: boolean;
    }) => {
      const res = await fetch(`${API_URL}/plan/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, workout_day, target_day, force }),
      });
      if (!res.ok) throw new Error('Falha ao mover treino');
      return res.json() as Promise<{
        ok: boolean;
        requires_confirmation?: boolean;
        warning?: string;
      }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan'] }),
  });
}

function EmptyPlan({ athleteId, onPlanReady }: { athleteId: string; onPlanReady: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: athleteId }),
      });
      const text = await res.text();
      let body: { job_id?: string; error?: string } = {};
      try { body = JSON.parse(text); } catch { /* resposta não-JSON */ }

      if (res.status === 202 && body.job_id) {
        setJobId(body.job_id);
        pollJob(body.job_id);
      } else if (res.ok) {
        onPlanReady();
      } else {
        Alert.alert('Erro', body.error ?? `Falha ao gerar plano (HTTP ${res.status})`);
        setGenerating(false);
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não conseguimos conectar ao servidor.');
      setGenerating(false);
    }
  }

  function pollJob(id: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API_URL}/jobs/${id}`);
        const body = await res.json();
        if (body.status === 'done') {
          clearInterval(interval);
          onPlanReady();
        } else if (body.status === 'failed' || attempts > 60) {
          clearInterval(interval);
          Alert.alert('Erro', 'Tive um problema técnico, já avisamos a equipe.');
          setGenerating(false);
          setJobId(null);
        }
      } catch {
        // continua tentando
      }
    }, 5000);
  }

  return (
    <View style={styles.center}>
      {generating ? (
        <>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>
            {jobId ? 'Processando seu plano...' : 'Gerando seu plano com IA...'}
          </Text>
          <Text style={styles.loadingSubtext}>Isso pode levar até 1 minuto</Text>
        </>
      ) : (
        <>
          <Text style={styles.emptyTitle}>Nenhum plano ativo</Text>
          <Text style={styles.emptyText}>
            Gere seu primeiro plano semanal personalizado com base no seu perfil.
          </Text>
          <TouchableOpacity style={styles.generateBtn} onPress={generate}>
            <Text style={styles.generateBtnText}>Gerar meu plano</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function PlanScreen() {
  const session = useAuthStore((s) => s.session);
  const advancedMode = useAuthStore((s) => s.profile?.advancedMode ?? false);
  const { data, isLoading, refetch, isRefetching } = usePlan(session?.athlete_id ?? '');

  const plan = data?.plan;
  const planId = plan?.id ?? '';
  const moveMutation = useMoveMutation(planId);

  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    from: number;
    to: number;
    warning: string;
  } | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  // Pulse animation for selected card
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const planDays = plan?.plan_json?.weeks?.[0]?.days ?? [];
    setDays([...planDays].sort((a, b) => a.day - b.day));
  }, [plan]);

  useEffect(() => {
    if (selectedDay !== null) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
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
            setShowWarning(true);
          }
        })
        .catch(() => {
          setSelectedDay(null);
          Alert.alert('Erro', 'Não conseguimos mover o treino.');
        });
    },
    [selectedDay, moveMutation],
  );

  function confirmMove() {
    if (!pendingMove) return;
    moveMutation
      .mutateAsync({ workout_day: pendingMove.from, target_day: pendingMove.to, force: true })
      .then(() => {
        setPendingMove(null);
        setShowWarning(false);
      })
      .catch(() => Alert.alert('Erro', 'Não conseguimos salvar a alteração.'));
  }

  function cancelMove() {
    setPendingMove(null);
    setShowWarning(false);
  }

  if (!session) return null;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Carregando seu plano...</Text>
      </View>
    );
  }

  if (!plan) {
    return <EmptyPlan athleteId={session.athlete_id} onPlanReady={refetch} />;
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {plan.why_text ? (
          <View style={styles.whyCard}>
            <Text style={styles.whyLabel}>Por que esses treinos</Text>
            <Text style={styles.whyText}>{plan.why_text}</Text>
          </View>
        ) : null}

        {selectedDay !== null ? (
          <View style={styles.moveBanner}>
            <Text style={styles.moveBannerText}>
              Segurando {getDayLabel(selectedDay)} — toque em outro dia para mover
            </Text>
            <TouchableOpacity onPress={() => setSelectedDay(null)}>
              <Text style={styles.moveBannerCancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.dragHint}>Segure um treino para movê-lo de dia</Text>
        )}

        {days.map((item) => {
          const isSelected = selectedDay === item.day;
          const isTarget = selectedDay !== null && selectedDay !== item.day;

          return (
            <View key={item.day}>
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
                >
                  <WorkoutCard
                    dayLabel={getDayLabel(item.day)}
                    dateLabel={getDayDateLabel(plan.week_start, item.day)}
                    type={item.type}
                    duration_min={item.duration_min}
                    distance_km={item.distance_km}
                    zones={item.zones}
                    description={item.description}
                    status={computeStatus(plan.week_start, item.day, item.type)}
                    isDragging={isSelected}
                    style={[
                      isSelected && styles.cardSelected,
                      isTarget && styles.cardTarget,
                    ]}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
          );
        })}

        {advancedMode ? (
          <TouchableOpacity style={styles.advancedLink} onPress={() => router.push('/metrics')}>
            <Text style={styles.advancedLinkText}>Ver detalhes técnicos →</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.disclaimerFooter}>
          FitSync não substitui acompanhamento médico ou profissional.
        </Text>
      </ScrollView>

      <Modal visible={showWarning} transparent animationType="fade" onRequestClose={cancelMove}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Atenção</Text>
            <Text style={styles.modalText}>{pendingMove?.warning}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={cancelMove}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={confirmMove}>
                <Text style={styles.btnConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 16 },
  emptyText: { color: '#666', fontSize: 16, textAlign: 'center' },
  whyCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  whyLabel: { fontSize: 12, fontWeight: '600', color: '#2563eb', marginBottom: 4 },
  whyText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  dragHint: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 12 },
  moveBanner: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moveBannerText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  moveBannerCancel: { color: '#93c5fd', fontSize: 13, fontWeight: '700', marginLeft: 8 },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 13,
  },
  cardTarget: {
    opacity: 0.7,
  },
  advancedLink: { alignItems: 'center', paddingVertical: 12 },
  advancedLinkText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  disclaimerFooter: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 12 },
  modalText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  btnConfirm: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
