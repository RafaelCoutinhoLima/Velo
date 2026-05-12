// US-003 — Perfil esportivo
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';

type Sex = 'M' | 'F' | 'other';
type Frequency = '2x' | '3x' | '4x' | '5x+';

export default function ProfileScreen() {
  const [birthYear, setBirthYear] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);

  const isValid = birthYear.length === 4 && weightKg.length > 0 && sex && frequency;

  function next() {
    if (!isValid) return;
    // Sprint 1: POST /onboarding com esses dados antes de navegar
    router.push('/onboarding/goal');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.progress}>
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>Seu perfil</Text>
        <Text style={styles.subtitle}>Para calibrar os treinos corretamente</Text>

        <Text style={styles.label}>Ano de nascimento</Text>
        <TextInput
          style={styles.input}
          placeholder="1990"
          keyboardType="number-pad"
          maxLength={4}
          value={birthYear}
          onChangeText={setBirthYear}
        />

        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="70"
          keyboardType="decimal-pad"
          value={weightKg}
          onChangeText={setWeightKg}
        />

        <Text style={styles.label}>Sexo biológico</Text>
        <View style={styles.row}>
          {(['M', 'F', 'other'] as Sex[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, sex === s && styles.chipActive]}
              onPress={() => setSex(s)}
            >
              <Text style={[styles.chipText, sex === s && styles.chipTextActive]}>
                {s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : 'Outro'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Quantas vezes treina por semana?</Text>
        <View style={styles.row}>
          {(['2x', '3x', '4x', '5x+'] as Frequency[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, frequency === f && styles.chipActive]}
              onPress={() => setFrequency(f)}
            >
              <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, !isValid && styles.btnDisabled]}
          onPress={next}
          disabled={!isValid}
        >
          <Text style={styles.btnText}>Continuar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 32, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  dotActive: { backgroundColor: '#2563eb', width: 24 },
  dotDone: { backgroundColor: '#93c5fd' },
  title: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#f9fafb',
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#2563eb', fontWeight: '700' },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
