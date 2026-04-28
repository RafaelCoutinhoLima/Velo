/**
 * US-04: seleciona uma atividade da lista e a marca como teste de 3 km.
 * Valida distância (2.8–3.2 km), extrai métricas e calcula zonas via API.
 */
import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { calculateZones } from '../lib/api';

export type ZoneResult = {
  hr_zones: { zone: number; min_bpm: number; max_bpm: number }[];
  pace_zones: { zone: number; min_sec: number; max_sec: number }[];
};

type Activity = {
  garmin_id: string;
  date: string;
  distance_km: number;
  duration_seconds: number;
  avg_pace_sec: number;
  avg_hr: number;
  max_hr: number;
};

type Props = {
  activities: Activity[];
  resting_hr: number;
  onZonesCalculated: (zones: ZoneResult, sourceActivityId: string) => void;
  onBack: () => void;
};

const MIN_KM = 2.8;
const MAX_KM = 3.2;

function formatKm(km: number) {
  return `${km.toFixed(2)} km`;
}

function formatPace(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

export default function ThreeKmTest({ activities, resting_hr, onZonesCalculated, onBack }: Props) {
  const [loading, setLoading] = useState(false);

  const eligible = activities.filter(
    (a) => a.distance_km >= MIN_KM && a.distance_km <= MAX_KM,
  );

  async function handleSelect(activity: Activity) {
    if (activity.max_hr === 0) {
      Alert.alert(
        'Dados insuficientes',
        'Esta atividade não tem frequência cardíaca. Use uma corrida com monitor cardíaco.',
      );
      return;
    }

    setLoading(true);
    try {
      const zones = await calculateZones({
        max_hr: activity.max_hr,
        resting_hr,
        threshold_pace_sec: activity.avg_pace_sec,
      });
      onZonesCalculated(zones, activity.garmin_id);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Teste de 3 km</Text>
      <Text style={styles.subtitle}>
        Selecione uma corrida entre {MIN_KM} km e {MAX_KM} km para usar como referência de zonas.
      </Text>

      {eligible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhuma corrida de 3 km encontrada.</Text>
          <Text style={styles.emptyHint}>
            Faça um teste de 3 km no ritmo mais forte que conseguir sustentar e sincronize aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={eligible}
          keyExtractor={(item) => item.garmin_id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.distance}>{formatKm(item.distance_km)}</Text>
              <View style={styles.row}>
                <Text style={styles.meta}>{formatPace(item.avg_pace_sec)}</Text>
                {item.avg_hr > 0 && <Text style={styles.meta}>{item.avg_hr} bpm med</Text>}
                {item.max_hr > 0 && <Text style={styles.meta}>{item.max_hr} bpm máx</Text>}
              </View>
              <Text style={styles.cta}>Usar esta →</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  back: { marginBottom: 12 },
  backText: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  subtitle: { color: '#6b7280', marginBottom: 20, lineHeight: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16,
    marginBottom: 10, elevation: 2,
  },
  date: { color: '#6b7280', fontSize: 12 },
  distance: { fontSize: 22, fontWeight: 'bold', marginVertical: 4 },
  row: { flexDirection: 'row', gap: 12 },
  meta: { color: '#4b5563', fontSize: 13 },
  cta: { color: '#2563eb', marginTop: 8, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptyHint: { color: '#6b7280', textAlign: 'center', lineHeight: 20 },
});
