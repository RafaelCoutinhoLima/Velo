// US-016 — Feedback humanizado pós-treino gerado pelo Claude
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function FeedbackScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const session = useAuthStore((s) => s.session);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feedback', workoutId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/feedback?workout_id=${workoutId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Falha ao buscar feedback');
      return res.json();
    },
    enabled: !!workoutId && !!session,
  });

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Feedback do treino</Text>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Gerando análise...</Text>
        </View>
      )}

      {isError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            Tive um problema técnico. Já registramos e vamos resolver em breve.
          </Text>
        </View>
      )}

      {data?.feedback && (
        <>
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>{data.feedback.feedback_md}</Text>
          </View>

          {data.feedback.metrics && (
            <View style={styles.metricsCard}>
              <Text style={styles.metricsTitle}>Métricas do treino</Text>
              {data.feedback.metrics.acwr && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>ACWR (carga aguda/crônica)</Text>
                  <Text style={styles.metricValue}>{data.feedback.metrics.acwr.toFixed(2)}</Text>
                </View>
              )}
              {data.feedback.metrics.rtss && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>rTSS do treino</Text>
                  <Text style={styles.metricValue}>{data.feedback.metrics.rtss.toFixed(1)}</Text>
                </View>
              )}
              {data.feedback.metrics.ctl && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Forma (CTL)</Text>
                  <Text style={styles.metricValue}>{data.feedback.metrics.ctl.toFixed(1)}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.disclaimer}>
            FitSync não substitui acompanhamento médico ou profissional.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 20 },
  centered: { alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 15 },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#dc2626', fontSize: 14, lineHeight: 20 },
  feedbackCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  feedbackText: { fontSize: 15, color: '#1f2937', lineHeight: 24 },
  metricsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  metricsTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  metricLabel: { fontSize: 14, color: '#4b5563' },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  disclaimer: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8, marginBottom: 40 },
});
