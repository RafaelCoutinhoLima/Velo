import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { ZoneResult } from '../lib/api';

type Props = {
  zones: ZoneResult;
  fcMax?: number;
  fcRest?: number;
  settingsMode?: boolean;
  onConfirm: () => void;
  onBack: () => void;
};

const HR_ZONE_COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffedd5', '#fee2e2'];

const ZONE_INFO = [
  {
    name: 'Z1 — Recuperação',
    description: 'Muito leve. Ideal para dias de recuperação ativa e aquecimento.',
  },
  {
    name: 'Z2 — Base aeróbica',
    description: 'Ritmo confortável. Aqui acontece 80% dos seus treinos — constrói resistência e queima gordura.',
  },
  {
    name: 'Z3 — Aeróbico moderado',
    description: 'Esforço médio. Use com moderação — aumenta fadiga sem o estímulo de Z4/Z5.',
  },
  {
    name: 'Z4 — Limiar anaeróbico',
    description: 'Ritmo forte e controlado. Treinos tempo run e intervalados longos. Eleva o limiar de lactato.',
  },
  {
    name: 'Z5 — VO2max',
    description: 'Máximo esforço. Intervalados curtos e rápidos. Melhora capacidade aeróbica máxima.',
  },
];

function formatPace(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

function vo2maxCategory(vo2: number): { label: string; color: string } {
  if (vo2 >= 55) return { label: 'Excelente', color: '#16a34a' };
  if (vo2 >= 47) return { label: 'Bom', color: '#2563eb' };
  if (vo2 >= 38) return { label: 'Moderado', color: '#d97706' };
  return { label: 'A desenvolver', color: '#dc2626' };
}

export default function ZoneDisplay({ zones, fcMax, fcRest, settingsMode, onConfirm, onBack }: Props) {
  const vo2max = fcMax && fcRest ? Math.round(15 * (fcMax / fcRest) * 10) / 10 : null;
  const vo2cat = vo2max ? vo2maxCategory(vo2max) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Suas Zonas de Treino</Text>
      <Text style={styles.subtitle}>
        Calculadas a partir do seu Teste de Cooper. Use estas referências em todos os treinos.
      </Text>

      {vo2max && vo2cat && (
        <View style={[styles.vo2Box, { borderColor: vo2cat.color }]}>
          <Text style={styles.vo2Label}>VO2max estimado</Text>
          <Text style={[styles.vo2Value, { color: vo2cat.color }]}>{vo2max} ml/kg/min</Text>
          <Text style={[styles.vo2Cat, { color: vo2cat.color }]}>{vo2cat.label}</Text>
          <Text style={styles.vo2Hint}>
            Capacidade aeróbica máxima — quanto maior, mais eficiente é seu coração ao transportar oxigênio.
          </Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Zonas de Frequência Cardíaca</Text>
      {zones.hr_zones.map((z, i) => (
        <View key={z.zone} style={[styles.zoneCard, { backgroundColor: HR_ZONE_COLORS[z.zone - 1] }]}>
          <View style={styles.zoneHeader}>
            <Text style={styles.zoneName}>{ZONE_INFO[i]?.name ?? `Zona ${z.zone}`}</Text>
            <Text style={styles.zoneRange}>{z.min_bpm} – {z.max_bpm} bpm</Text>
          </View>
          {settingsMode && (
            <Text style={styles.zoneDesc}>{ZONE_INFO[i]?.description}</Text>
          )}
        </View>
      ))}

      {zones.pace_zones.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Zonas de Pace</Text>
          {zones.pace_zones.map((z, i) => (
            <View key={z.zone} style={[styles.zoneCard, { backgroundColor: HR_ZONE_COLORS[i] }]}>
              <View style={styles.zoneHeader}>
                <Text style={styles.zoneName}>Z{z.zone}</Text>
                <Text style={styles.zoneRange}>
                  {formatPace(z.min_sec)} – {formatPace(z.max_sec)}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={onConfirm}>
        <Text style={styles.buttonText}>
          {settingsMode ? 'Salvar zonas →' : 'Confirmar e definir objetivo →'}
        </Text>
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
  subtitle: { color: '#6b7280', marginBottom: 20, lineHeight: 20 },
  vo2Box: {
    borderWidth: 1.5, borderRadius: 12, padding: 16,
    marginBottom: 20, backgroundColor: '#fff',
  },
  vo2Label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 },
  vo2Value: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  vo2Cat: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  vo2Hint: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  zoneCard: { borderRadius: 10, padding: 14, marginBottom: 8 },
  zoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  zoneName: { fontWeight: '600', fontSize: 15, flex: 1, marginRight: 8 },
  zoneRange: { color: '#374151', fontSize: 14 },
  zoneDesc: { color: '#4b5563', fontSize: 13, marginTop: 6, lineHeight: 18 },
  button: {
    backgroundColor: '#2563eb', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
