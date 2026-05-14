import { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateZones } from '../lib/api';
import type { ZoneResult } from '../lib/api';

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
  onZonesCalculated: (zones: ZoneResult, sourceActivityId: string, fcMax: number, fcRest: number) => void;
  onBack: () => void;
  onSkip: () => void;
};

const MIN_SECONDS = 600; // 10 min
const MAX_SECONDS = 840; // 14 min

const STEPS = [
  { icon: '📍', text: 'Escolha uma pista plana ou use o GPS do Garmin em terreno aberto.' },
  { icon: '🔥', text: 'Aqueça por 5–10 minutos em ritmo leve antes de iniciar.' },
  { icon: '⏱️', text: 'Configure o cronômetro para 12 minutos e corra o mais longe possível nesse tempo.' },
  { icon: '💪', text: 'Mantenha um ritmo forte e constante — duro, mas sustentável até o fim.' },
  { icon: '❤️', text: 'Use o monitor cardíaco do Garmin para capturar a FC durante o teste.' },
  { icon: '🔄', text: 'Ao terminar, sincronize o Garmin e selecione a corrida abaixo.' },
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPace(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

export default function CooperTest({ activities, resting_hr, onZonesCalculated, onBack, onSkip }: Props) {
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const insets = useSafeAreaInsets();

  const eligible = activities.filter(
    (a) => a.duration_seconds >= MIN_SECONDS && a.duration_seconds <= MAX_SECONDS,
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
      onZonesCalculated(zones, activity.garmin_id, activity.max_hr, resting_hr);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backText}>‹ Sair</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skipText}>Fazer depois</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Teste de Cooper</Text>
        <Text style={styles.subtitle}>
          Corra por 12 minutos no ritmo mais forte que conseguir sustentar. A distância percorrida
          define suas zonas de treino personalizadas.
        </Text>

        <TouchableOpacity
          style={styles.guideToggle}
          onPress={() => setShowGuide((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.guideToggleText}>
            {showGuide ? 'Ocultar instruções ▲' : 'Como realizar o teste ▼'}
          </Text>
        </TouchableOpacity>

        {showGuide && (
          <View style={styles.guideBox}>
            {STEPS.map((step, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepIcon}>{step.icon}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
            <View style={styles.tip}>
              <Text style={styles.tipText}>
                Dica: realize o teste descansado, de preferência pela manhã e sem treino pesado no dia anterior.
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>
          {eligible.length > 0
            ? `${eligible.length} corrida${eligible.length > 1 ? 's' : ''} elegível${eligible.length > 1 ? 'is' : ''} (10–14 min)`
            : 'Corridas elegíveis (10–14 min)'}
        </Text>

        {eligible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma corrida de ~12 minutos encontrada.</Text>
            <Text style={styles.emptyHint}>
              Realize o teste seguindo as instruções acima, sincronize o Garmin e volte aqui.
            </Text>
          </View>
        ) : (
          eligible.map((item) => (
            <TouchableOpacity key={item.garmin_id} style={styles.card} onPress={() => handleSelect(item)}>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.duration}>{formatDuration(item.duration_seconds)} min</Text>
              <View style={styles.row}>
                <Text style={styles.meta}>{item.distance_km.toFixed(2)} km</Text>
                <Text style={styles.meta}>{formatPace(item.avg_pace_sec)}</Text>
                {item.avg_hr > 0 && <Text style={styles.meta}>{item.avg_hr} bpm med</Text>}
                {item.max_hr > 0 && <Text style={styles.meta}>{item.max_hr} bpm máx</Text>}
              </View>
              <Text style={styles.cta}>Usar esta →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText: { color: '#ef4444', fontSize: 16 },
  skipText: { color: '#6b7280', fontSize: 15 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  subtitle: { color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  guideToggle: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 12,
  },
  guideToggleText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  guideBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  stepIcon: { fontSize: 18, width: 24 },
  stepText: { flex: 1, color: '#374151', fontSize: 14, lineHeight: 20 },
  tip: {
    backgroundColor: '#fefce8',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  tipText: { color: '#854d0e', fontSize: 13, lineHeight: 18 },
  sectionLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16,
    marginBottom: 10, elevation: 2,
  },
  date: { color: '#6b7280', fontSize: 12 },
  duration: { fontSize: 22, fontWeight: 'bold', marginVertical: 4 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  meta: { color: '#4b5563', fontSize: 13 },
  cta: { color: '#2563eb', marginTop: 8, fontWeight: '600' },
  empty: { paddingVertical: 40, alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 17, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyHint: { color: '#6b7280', textAlign: 'center', lineHeight: 20 },
});
