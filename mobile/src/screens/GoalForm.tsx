import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generatePlan, pollJobResult } from '../lib/api';
import type { TrainingPlan } from '../lib/api';

const DISTANCE_OPTIONS = [
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: 'Meia (21 km)', value: 21 },
  { label: 'Maratona (42 km)', value: 42 },
];

const DAYS_OPTIONS = [3, 4, 5];

const WEEKS_OPTIONS = [
  { label: '4 sem', value: 4 },
  { label: '8 sem', value: 8 },
  { label: '12 sem', value: 12 },
  { label: '16 sem', value: 16 },
];

interface Props {
  onPlanGenerated: (plan: TrainingPlan) => void;
  onBack: () => void;
}

export default function GoalForm({ onPlanGenerated, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [distance, setDistance] = useState<number | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [weeksToGoal, setWeeksToGoal] = useState<number>(8);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Gerando seu plano...');

  async function handleGenerate() {
    if (!distance) {
      Alert.alert('Selecione a distância alvo');
      return;
    }
    setLoading(true);
    setLoadingMsg('Gerando seu plano...');
    try {
      const result = await generatePlan({
        goal_distance_km: distance,
        days_per_week: daysPerWeek,
        weeks_to_goal: weeksToGoal,
      });

      if ('job_id' in result) {
        setLoadingMsg('Montando seu plano com IA... (pode levar até 4 min)');
        const plan = await pollJobResult(result.job_id);
        onPlanGenerated(plan);
      } else {
        onPlanGenerated(result as TrainingPlan);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível gerar o plano.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
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

      <Text style={styles.label}>Duração do plano</Text>
      <View style={styles.row}>
        {WEEKS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chipSmall, weeksToGoal === opt.value && styles.chipSelected]}
            onPress={() => setWeeksToGoal(opt.value)}
          >
            <Text style={[styles.chipText, weeksToGoal === opt.value && styles.chipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, (!distance || loading) && styles.buttonDisabled]}
        onPress={handleGenerate}
        disabled={!distance || loading}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#fff" style={{ marginBottom: 4 }} />
            <Text style={[styles.buttonText, { fontSize: 13 }]}>{loadingMsg}</Text>
          </>
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
