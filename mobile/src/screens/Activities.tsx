import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { fetchActivities, requestFeedback } from '../lib/api';

type Activity = {
  id: string;
  date: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
};

type FeedbackResult = {
  texto_principal: string;
  destaque_positivo?: string;
  sugestao?: string;
  emoji_resumo?: string;
};

function formatPace(sec: number): string {
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}:${s.toString().padStart(2, '0')}/km`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Activity | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchActivities();
      setActivities(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openActivity(activity: Activity) {
    setSelected(activity);
    setFeedback(null);
    setFeedbackError(null);
    setFeedbackLoading(true);
    try {
      const result = await requestFeedback(activity.id);
      setFeedback(result);
    } catch (e: any) {
      setFeedbackError(e.message ?? 'Não foi possível gerar o feedback.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  function closeModal() {
    setSelected(null);
    setFeedback(null);
    setFeedbackError(null);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Minhas Corridas</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => {
          const distKm = (item.distance_m ?? 0) / 1000;
          const paceSec = distKm > 0 ? Math.round(item.duration_s / distKm) : 0;
          return (
            <TouchableOpacity style={styles.card} onPress={() => openActivity(item)} activeOpacity={0.7}>
              <Text style={styles.date}>{formatDate(item.date)}</Text>
              <Text style={styles.distance}>{distKm.toFixed(1)} km</Text>
              <View style={styles.row}>
                <Text style={styles.meta}>{formatDuration(item.duration_s)}</Text>
                {paceSec > 0 && <Text style={styles.meta}>{formatPace(paceSec)}</Text>}
                {item.avg_hr != null && <Text style={styles.meta}>{item.avg_hr} bpm</Text>}
              </View>
              <Text style={styles.tapHint}>Toque para ver feedback do treinador →</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma corrida importada ainda.</Text>}
      />

      <Modal visible={selected != null} animationType="slide" transparent onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {selected && (
            <>
              <Text style={styles.sheetTitle}>
                {((selected.distance_m ?? 0) / 1000).toFixed(1)} km — {formatDate(selected.date)}
              </Text>
              <View style={styles.sheetMeta}>
                <Text style={styles.metaChip}>{formatDuration(selected.duration_s)}</Text>
                {selected.avg_hr != null && (
                  <Text style={styles.metaChip}>{selected.avg_hr} bpm médio</Text>
                )}
              </View>
            </>
          )}

          <ScrollView style={styles.feedbackScroll} showsVerticalScrollIndicator={false}>
            {feedbackLoading && (
              <View style={styles.feedbackLoading}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.feedbackLoadingText}>Analisando seu treino...</Text>
              </View>
            )}

            {feedbackError && (
              <Text style={styles.feedbackError}>{feedbackError}</Text>
            )}

            {feedback && !feedbackLoading && (
              <View>
                {feedback.emoji_resumo && (
                  <Text style={styles.emoji}>{feedback.emoji_resumo}</Text>
                )}
                <Text style={styles.feedbackText}>{feedback.texto_principal}</Text>

                {feedback.destaque_positivo && (
                  <View style={styles.highlight}>
                    <Text style={styles.highlightLabel}>Ponto forte</Text>
                    <Text style={styles.highlightText}>{feedback.destaque_positivo}</Text>
                  </View>
                )}

                {feedback.sugestao && (
                  <View style={styles.suggestion}>
                    <Text style={styles.suggestionLabel}>Para o próximo treino</Text>
                    <Text style={styles.suggestionText}>{feedback.sugestao}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  date: { color: '#6b7280', fontSize: 12, marginBottom: 4 },
  distance: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  row: { flexDirection: 'row', gap: 16, marginTop: 6 },
  meta: { color: '#6b7280', fontSize: 13 },
  tapHint: { color: '#a5b4fc', fontSize: 11, marginTop: 8 },
  error: { color: '#dc2626', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36, maxHeight: '85%',
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#e5e7eb',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  sheetMeta: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metaChip: {
    backgroundColor: '#f3f4f6', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, color: '#374151',
  },

  feedbackScroll: { flex: 1 },
  feedbackLoading: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  feedbackLoadingText: { color: '#6b7280', fontSize: 14 },
  feedbackError: { color: '#dc2626', fontSize: 14, textAlign: 'center', padding: 16 },

  emoji: { fontSize: 36, textAlign: 'center', marginBottom: 12 },
  feedbackText: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 16 },
  highlight: {
    backgroundColor: '#f0fdf4', borderLeftWidth: 3, borderLeftColor: '#22c55e',
    padding: 12, borderRadius: 8, marginBottom: 12,
  },
  highlightLabel: { fontSize: 11, fontWeight: '600', color: '#16a34a', marginBottom: 4, textTransform: 'uppercase' },
  highlightText: { fontSize: 14, color: '#166534' },
  suggestion: {
    backgroundColor: '#eff6ff', borderLeftWidth: 3, borderLeftColor: '#3b82f6',
    padding: 12, borderRadius: 8, marginBottom: 12,
  },
  suggestionLabel: { fontSize: 11, fontWeight: '600', color: '#2563eb', marginBottom: 4, textTransform: 'uppercase' },
  suggestionText: { fontSize: 14, color: '#1e40af' },
  closeBtn: {
    marginTop: 16, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
