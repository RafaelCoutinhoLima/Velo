import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function usePlan(athleteId: string) {
  return useQuery({
    queryKey: ['plan', athleteId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/plan/current?athlete_id=${athleteId}`);
      if (!res.ok) throw new Error('Falha ao buscar plano');
      return res.json();
    },
    enabled: !!athleteId,
    staleTime: 1000 * 60 * 5,
  });
}

const WORKOUT_ICONS: Record<string, string> = {
  easy: '🟢',
  interval: '🔴',
  tempo: '🟠',
  long: '🔵',
  rest: '💤',
  cross: '⚪',
};

export default function PlanScreen() {
  const session = useAuthStore((s) => s.session);
  const { data, isLoading, refetch, isRefetching } = usePlan(session?.athlete_id ?? '');

  if (!session) return null;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Carregando seu plano...</Text>
      </View>
    );
  }

  const plan = data?.plan;

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Seu plano ainda está sendo preparado.</Text>
      </View>
    );
  }

  const currentWeek = plan.plan_json?.weeks?.[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {plan.why_text && (
        <View style={styles.whyCard}>
          <Text style={styles.whyLabel}>Por que esses treinos</Text>
          <Text style={styles.whyText}>{plan.why_text}</Text>
        </View>
      )}

      {currentWeek?.days?.map(
        (day: { day: number; type: string; duration_min: number; distance_km: number; description: string }) => (
          <View key={day.day} style={styles.workoutCard}>
            <Text style={styles.dayLabel}>
              {WORKOUT_ICONS[day.type] ?? '⚪'} Dia {day.day}
            </Text>
            <Text style={styles.workoutType}>{day.type.toUpperCase()}</Text>
            <Text style={styles.workoutDetail}>
              {day.duration_min}min · {day.distance_km}km
            </Text>
            <Text style={styles.workoutDesc}>{day.description}</Text>
          </View>
        ),
      )}

      <Text style={styles.disclaimerFooter}>
        FitSync não substitui acompanhamento médico ou profissional.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 16 },
  emptyText: { color: '#666', fontSize: 16, textAlign: 'center' },
  whyCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  whyLabel: { fontSize: 12, fontWeight: '600', color: '#2563eb', marginBottom: 4 },
  whyText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  workoutCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dayLabel: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  workoutType: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
  workoutDetail: { fontSize: 14, color: '#374151', marginBottom: 8 },
  workoutDesc: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  disclaimerFooter: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
});
