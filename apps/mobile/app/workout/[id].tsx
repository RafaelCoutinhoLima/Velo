// Detalhe de um workout — acessado de plan.tsx e history.tsx
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  easy:     { label: 'Regenerativo', color: '#22c55e', icon: '🟢' },
  interval: { label: 'Intervalado',  color: '#ef4444', icon: '🔴' },
  tempo:    { label: 'Tempo',        color: '#f97316', icon: '🟠' },
  long:     { label: 'Longo',        color: '#3b82f6', icon: '🔵' },
  rest:     { label: 'Descanso',     color: '#9ca3af', icon: '💤' },
  cross:    { label: 'Cross',        color: '#8b5cf6', icon: '⚪' },
};

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const [rpe, setRpe] = useState<number | null>(null);
  const [savingRpe, setSavingRpe] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workout', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/workouts/${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Falha ao buscar treino');
      return res.json();
    },
    enabled: !!id && !!session,
  });

  async function saveRpe(value: number) {
    setRpe(value);
    setSavingRpe(true);
    try {
      // Sprint 3: PATCH /workouts/:id com { rpe: value }
      await fetch(`${API_URL}/workouts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ rpe: value }),
      });
    } catch {
      Alert.alert('Erro', 'Não conseguimos salvar o RPE. Tente novamente.');
    } finally {
      setSavingRpe(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const workout = data?.workout;
  const typeConfig = TYPE_CONFIG[workout?.type ?? 'easy'];

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      {workout ? (
        <>
          <View style={[styles.header, { borderLeftColor: typeConfig.color }]}>
            <Text style={styles.headerIcon}>{typeConfig.icon}</Text>
            <View>
              <Text style={styles.headerType}>{typeConfig.label.toUpperCase()}</Text>
              <Text style={styles.headerDate}>{workout.date}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{(workout.distance_m / 1000).toFixed(1)}</Text>
              <Text style={styles.metricLabel}>km</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{Math.floor(workout.duration_s / 60)}</Text>
              <Text style={styles.metricLabel}>min</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{workout.avg_hr ?? '—'}</Text>
              <Text style={styles.metricLabel}>bpm</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{workout.rtss?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.metricLabel}>rTSS</Text>
            </View>
          </View>

          {workout.description && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Treino prescrito</Text>
              <Text style={styles.cardText}>{workout.description}</Text>
            </View>
          )}

          {/* Sprint 3: US-015 — captura de RPE */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Como foi o esforço? (RPE)</Text>
            <View style={styles.rpeRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.rpeBtn, rpe === n && styles.rpeBtnActive]}
                  onPress={() => saveRpe(n)}
                >
                  <Text style={[styles.rpeBtnText, rpe === n && styles.rpeBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {savingRpe && <Text style={styles.rpeStatus}>Salvando...</Text>}
            {rpe && !savingRpe && (
              <Text style={styles.rpeStatus}>RPE {rpe} salvo ✓</Text>
            )}
          </View>

          {workout.feedback_md && (
            <TouchableOpacity
              style={styles.feedbackBtn}
              onPress={() => router.push(`/feedback?workoutId=${id}`)}
            >
              <Text style={styles.feedbackBtnText}>Ver feedback do treino →</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Treino não encontrado.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  headerIcon: { fontSize: 32 },
  headerType: { fontSize: 18, fontWeight: '700', color: '#111' },
  headerDate: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metric: { alignItems: 'center' },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#111' },
  metricLabel: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  metricDivider: { width: 1, height: 32, backgroundColor: '#e5e7eb' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  rpeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  rpeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  rpeBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  rpeBtnText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  rpeBtnTextActive: { color: '#fff' },
  rpeStatus: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  feedbackBtn: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  feedbackBtnText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#9ca3af', fontSize: 16 },
});
