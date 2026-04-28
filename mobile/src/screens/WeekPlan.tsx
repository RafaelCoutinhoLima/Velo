import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

type TrainingDay = {
  day_of_week: number;
  workout_type: string;
  duration_minutes: number;
  target_zone: number | null;
  instruction: string;
};

type TrainingWeek = {
  week_number: number;
  total_km: number;
  days: TrainingDay[];
};

const DAY_NAMES = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const WORKOUT_COLORS: Record<string, string> = {
  easy_run: '#dbeafe',
  long_run: '#dcfce7',
  intervals: '#fef9c3',
  tempo_run: '#ffedd5',
  recovery_run: '#f3e8ff',
  rest: '#f1f5f9',
};

const WORKOUT_LABELS: Record<string, string> = {
  easy_run: 'Corrida Leve',
  long_run: 'Longão',
  intervals: 'Intervalado',
  tempo_run: 'Tempo',
  recovery_run: 'Recuperação',
  rest: 'Descanso',
};

type Props = { plan: { weeks: TrainingWeek[] } | null; loading: boolean };

export default function WeekPlan({ plan, loading }: Props) {
  const [currentWeek, setCurrentWeek] = useState(0);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!plan) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum plano gerado ainda.</Text>
        <Text style={styles.emptyHint}>
          Complete o teste de 3 km e defina seu objetivo para gerar um plano.
        </Text>
      </View>
    );
  }

  const weeks = plan.weeks;
  const week = weeks[currentWeek];

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity
          onPress={() => setCurrentWeek((w) => Math.max(0, w - 1))}
          disabled={currentWeek === 0}
        >
          <Text style={[styles.navBtn, currentWeek === 0 && styles.navDisabled]}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>
          Semana {week.week_number} de {weeks.length}
        </Text>
        <TouchableOpacity
          onPress={() => setCurrentWeek((w) => Math.min(weeks.length - 1, w + 1))}
          disabled={currentWeek === weeks.length - 1}
        >
          <Text style={[styles.navBtn, currentWeek === weeks.length - 1 && styles.navDisabled]}>
            {'›'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.totalKm}>{week.total_km} km esta semana</Text>

      <ScrollView>
        {week.days.map((day) => (
          <View
            key={day.day_of_week}
            style={[styles.dayCard, { backgroundColor: WORKOUT_COLORS[day.workout_type] ?? '#fff' }]}
          >
            <Text style={styles.dayName}>{DAY_NAMES[day.day_of_week]}</Text>
            <Text style={styles.workoutType}>{WORKOUT_LABELS[day.workout_type] ?? day.workout_type}</Text>
            {day.workout_type !== 'rest' && (
              <Text style={styles.detail}>
                {day.duration_minutes} min · Z{day.target_zone}
              </Text>
            )}
            <Text style={styles.instruction}>{day.instruction}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  navBtn: { fontSize: 32, color: '#2563eb', paddingHorizontal: 12 },
  navDisabled: { color: '#d1d5db' },
  weekLabel: { fontSize: 18, fontWeight: '600' },
  totalKm: { color: '#6b7280', marginBottom: 16 },
  dayCard: {
    borderRadius: 10, padding: 14, marginBottom: 8,
  },
  dayName: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 2 },
  workoutType: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  detail: { color: '#4b5563', marginTop: 2 },
  instruction: { color: '#374151', marginTop: 4, fontSize: 13 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyHint: { color: '#6b7280', textAlign: 'center' },
});
