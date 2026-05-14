import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { sendWeekToGarmin } from '../lib/api';
import type { TrainingPlan, TrainingDay } from '../lib/api';

const DAY_NAMES = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const WORKOUT_COLORS: Record<string, string> = {
  easy:     '#dbeafe',
  long:     '#dcfce7',
  interval: '#fef9c3',
  tempo:    '#ffedd5',
  cross:    '#f3e8ff',
  rest:     '#f1f5f9',
};

const WORKOUT_LABELS: Record<string, string> = {
  easy:     'Corrida Leve',
  long:     'Longão',
  interval: 'Intervalado',
  tempo:    'Tempo',
  cross:    'Cross-training',
  rest:     'Descanso',
};

type Props = { plan: TrainingPlan | null; loading: boolean; garminConnected?: boolean; onGeneratePlan?: () => void };

export default function WeekPlan({ plan, loading, garminConnected, onGeneratePlan }: Props) {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [sendingToGarmin, setSendingToGarmin] = useState(false);

  if (loading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginBottom: 16 }} />
        <Text style={styles.emptyText}>Preparando seu plano...</Text>
        <Text style={styles.emptyHint}>Isso pode levar até 30 segundos.</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🎯</Text>
        <Text style={styles.emptyText}>Nenhum plano gerado ainda.</Text>
        <Text style={styles.emptyHint}>
          Defina seu objetivo de corrida e geramos um plano semanal personalizado para você.
        </Text>
        {onGeneratePlan && (
          <TouchableOpacity style={styles.generateBtn} onPress={onGeneratePlan}>
            <Text style={styles.generateBtnText}>Definir Objetivo e Gerar Plano →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const weeks = plan.weeks;
  const week = weeks[currentWeek];

  async function handleSendToGarmin() {
    setSendingToGarmin(true);
    try {
      const result = await sendWeekToGarmin(week.week_number);
      Alert.alert('Enviado!', `${result.sent} treino(s) agendado(s) no relógio para a próxima semana.`);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar para o Garmin.');
    } finally {
      setSendingToGarmin(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Navegação de semanas */}
      <View style={styles.nav}>
        <TouchableOpacity
          onPress={() => setCurrentWeek((w) => Math.max(0, w - 1))}
          disabled={currentWeek === 0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.navBtn, currentWeek === 0 && styles.navDisabled]}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>
          Semana {week.week_number} de {weeks.length}
        </Text>
        <TouchableOpacity
          onPress={() => setCurrentWeek((w) => Math.min(weeks.length - 1, w + 1))}
          disabled={currentWeek === weeks.length - 1}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.navBtn, currentWeek === weeks.length - 1 && styles.navDisabled]}>
            {'›'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.kmRow}>
        <Text style={styles.totalKm}>{week.total_km} km esta semana</Text>
        {garminConnected && (
          <TouchableOpacity
            style={[styles.garminBtn, sendingToGarmin && styles.btnDisabled]}
            onPress={handleSendToGarmin}
            disabled={sendingToGarmin}
          >
            {sendingToGarmin
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.garminBtnText}>⌚ Enviar pro relógio</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Banner "por que essa semana" */}
      {week.why_text ? (
        <View style={styles.whyBanner}>
          <Text style={styles.whyText}>{week.why_text}</Text>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        {week.days.map((day) => (
          <DayCard key={day.day} day={day} />
        ))}

        {currentWeek === 0 && plan.summary ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Sobre o seu plano</Text>
            <Text style={styles.summaryText}>{plan.summary}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DayCard({ day }: { day: TrainingDay }) {
  const bgColor = WORKOUT_COLORS[day.type] ?? '#fff';
  const label = WORKOUT_LABELS[day.type] ?? day.type;
  const zoneText = day.zones.length > 0 ? `Z${day.zones.join('+')}` : null;

  return (
    <View style={[styles.dayCard, { backgroundColor: bgColor }]}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayName}>{DAY_NAMES[day.day] ?? `Dia ${day.day}`}</Text>
        {zoneText && <Text style={styles.zoneTag}>{zoneText}</Text>}
      </View>
      <Text style={styles.workoutType}>{label}</Text>
      {day.type !== 'rest' && (
        <View style={styles.dayMeta}>
          {day.duration_min > 0 && (
            <Text style={styles.metaText}>{day.duration_min} min</Text>
          )}
          {day.distance_km > 0 && (
            <Text style={styles.metaText}>{day.distance_km.toFixed(1)} km</Text>
          )}
        </View>
      )}
      {day.description ? (
        <Text style={styles.description}>{day.description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  nav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  navBtn: { fontSize: 32, color: '#2563eb', paddingHorizontal: 12 },
  navDisabled: { color: '#d1d5db' },
  weekLabel: { fontSize: 18, fontWeight: '600' },
  kmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  totalKm: { color: '#6b7280' },
  garminBtn: { backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  garminBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  whyBanner: {
    backgroundColor: '#eff6ff', borderRadius: 10,
    padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#2563eb',
  },
  whyText: { color: '#1e40af', fontSize: 13, lineHeight: 19 },
  dayCard: { borderRadius: 10, padding: 14, marginBottom: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  dayName: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  zoneTag: {
    fontSize: 11, fontWeight: '700', color: '#4b5563',
    backgroundColor: '#e5e7eb', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  workoutType: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  dayMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaText: { color: '#4b5563', fontSize: 13 },
  description: { color: '#374151', marginTop: 6, fontSize: 13, lineHeight: 18 },
  summaryBox: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16,
    marginTop: 8, marginBottom: 24,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  summaryText: { color: '#374151', fontSize: 13, lineHeight: 19 },
  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, backgroundColor: '#f9fafb',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyHint: { color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  generateBtn: {
    backgroundColor: '#6366f1', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 8,
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
