/**
 * US-04: exibe as zonas calculadas a partir do teste de 3 km.
 * Nenhuma chamada de rede — recebe dados prontos via props.
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { ZoneResult } from './ThreeKmTest';

type Props = {
  zones: ZoneResult;
  onConfirm: () => void;
  onBack: () => void;
};

const HR_ZONE_COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffedd5', '#fee2e2'];
const PACE_ZONE_LABELS = ['Z1 — Leve', 'Z2 — Base aeróbica', 'Z3 — Limiar+'];

function formatPace(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

export default function ZoneDisplay({ zones, onConfirm, onBack }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Suas Zonas de Treino</Text>
      <Text style={styles.subtitle}>
        Calculadas a partir do seu teste de 3 km. Confirme para salvar.
      </Text>

      <Text style={styles.sectionLabel}>Zonas de Frequência Cardíaca</Text>
      {zones.hr_zones.map((z) => (
        <View key={z.zone} style={[styles.zoneCard, { backgroundColor: HR_ZONE_COLORS[z.zone - 1] }]}>
          <Text style={styles.zoneName}>Zona {z.zone}</Text>
          <Text style={styles.zoneRange}>{z.min_bpm} – {z.max_bpm} bpm</Text>
        </View>
      ))}

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Zonas de Pace</Text>
      {zones.pace_zones.map((z, i) => (
        <View key={z.zone} style={[styles.zoneCard, { backgroundColor: HR_ZONE_COLORS[i] }]}>
          <Text style={styles.zoneName}>{PACE_ZONE_LABELS[i]}</Text>
          <Text style={styles.zoneRange}>
            {formatPace(z.min_sec)} – {formatPace(z.max_sec)}
          </Text>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={onConfirm}>
        <Text style={styles.buttonText}>Confirmar e definir objetivo →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  back: { marginBottom: 12 },
  backText: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  subtitle: { color: '#6b7280', marginBottom: 24, lineHeight: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  zoneCard: {
    borderRadius: 10, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  zoneName: { fontWeight: '600', fontSize: 15 },
  zoneRange: { color: '#374151', fontSize: 14 },
  button: {
    backgroundColor: '#2563eb', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
