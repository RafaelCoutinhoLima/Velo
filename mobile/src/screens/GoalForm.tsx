import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { generatePlan } from '../lib/api';
import type { TrainingPlan } from '../lib/api';

const DISTANCE_OPTIONS = [
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: 'Meia (21 km)', value: 21 },
  { label: 'Maratona (42 km)', value: 42 },
];

const DAYS_OPTIONS = [3, 4, 5];

interface Props {
  onPlanGenerated: (plan: TrainingPlan) => void;
  onBack: () => void;
}

export default function GoalForm({ onPlanGenerated, onBack }: Props) {
  const [distance, setDistance] = useState<number | null>(null);
  const [weeks, setWeeks] = useState('12');
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [targetTime, setTargetTime] = useState('');
  const [loading, setLoading] = useState(false);

  const weeksNum = parseInt(weeks, 10);
  const weeksValid = !isNaN(weeksNum) && weeksNum >= 4 && weeksNum <= 16;

  async function handleGenerate() {
    if (!distance) {
      Alert.alert('Selecione a distância alvo');
      return;
    }
    if (!weeksValid) {
      Alert.alert('Semanas inválidas', 'Informe entre 4 e 16 semanas.');
      return;
    }
    setLoading(true);
    try {
      const plan = await generatePlan({
        goal_distance_km: distance,
        weeks: weeksNum,
        days_per_week: daysPerWeek,
      });
      onPlanGenerated(plan);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível gerar o plano.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Seu objetivo</Text>
      <Text style={styles.subtitle}>Vamos montar o plano ideal para você</Text>

      <Text style={styles.label}>Distância alvo</Text>
      <View style={styles.row}>
        {DISTANCE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, distance === opt.value && styles.chipSelected]}
            onPress={() => setDistance(opt.value)}
          >
            <Text style={[styles.chipText, distance === opt.value && styles.chipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Semanas de treino (4–16)</Text>
      <TextInput
        style={[styles.input, !weeksValid && weeks.length > 0 && styles.inputError]}
        keyboardType="number-pad"
        value={weeks}
        onChangeText={setWeeks}
        maxLength={2}
        placeholder="12"
        placeholderTextColor="#666"
      />
      {!weeksValid && weeks.length > 0 && (
        <Text style={styles.errorText}>Entre 4 e 16 semanas</Text>
      )}

      <Text style={styles.label}>Dias de treino por semana</Text>
      <View style={styles.row}>
        {DAYS_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chipSmall, daysPerWeek === d && styles.chipSelected]}
            onPress={() => setDaysPerWeek(d)}
          >
            <Text style={[styles.chipText, daysPerWeek === d && styles.chipTextSelected]}>
              {d}x
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Tempo alvo (opcional)</Text>
      <TextInput
        style={styles.input}
        value={targetTime}
        onChangeText={setTargetTime}
        placeholder="ex: 1h45min"
        placeholderTextColor="#666"
      />

      <TouchableOpacity
        style={[styles.button, (!distance || !weeksValid || loading) && styles.buttonDisabled]}
        onPress={handleGenerate}
        disabled={!distance || !weeksValid || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Gerar Plano →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingBottom: 48 },
  back: { marginBottom: 24 },
  backText: { color: '#00d4ff', fontSize: 16 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 32 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  chipSmall: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  chipSelected: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText: { color: '#ccc', fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: '#000', fontWeight: '700' },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    padding: 14,
    marginTop: 4,
  },
  inputError: { borderColor: '#ff4444' },
  errorText: { color: '#ff4444', fontSize: 12, marginTop: 4 },
  button: {
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 40,
  },
  buttonDisabled: { backgroundColor: '#1a4a55', opacity: 0.6 },
  buttonText: { color: '#000', fontSize: 18, fontWeight: '700' },
});
