import { useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchActivities } from '../lib/api';

type Activity = {
  garmin_id: string;
  date: string;
  distance_km: number;
  duration_seconds: number;
  avg_pace_sec: number;
  avg_hr: number;
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

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Minhas Corridas</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={activities}
        keyExtractor={(item) => item.garmin_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.distance}>{item.distance_km.toFixed(1)} km</Text>
            <View style={styles.row}>
              <Text style={styles.meta}>{formatDuration(item.duration_seconds)}</Text>
              <Text style={styles.meta}>{formatPace(item.avg_pace_sec)}</Text>
              <Text style={styles.meta}>{item.avg_hr} bpm</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma corrida importada ainda.</Text>}
      />
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
  error: { color: '#dc2626', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
