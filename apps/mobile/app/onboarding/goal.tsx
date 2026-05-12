// US-004 — Prova alvo ou modo progressão geral
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type GoalMode = 'race' | 'general_progression';
type RaceDistance = '5k' | '10k' | '21k' | '42k' | '70.3' | 'other';

const DISTANCE_KM: Record<RaceDistance, number> = {
  '5k': 5,
  '10k': 10,
  '21k': 21.0975,
  '42k': 42.195,
  '70.3': 113.0,
  other: 0,
};

export default function GoalScreen() {
  const session = useAuthStore((s) => s.session);
  const [mode, setMode] = useState<GoalMode | null>(null);
  const [raceDistance, setRaceDistance] = useState<RaceDistance | null>(null);
  const [raceDate, setRaceDate] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid =
    mode === 'general_progression' ||
    (mode === 'race' && raceDistance && raceDate.length === 10);

  async function next() {
    if (!isValid || !session?.athlete_id) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        athlete_id: session.athlete_id,
        goal_mode: mode,
      };
      if (mode === 'race' && raceDistance && raceDate) {
        // Converte DD/MM/AAAA → AAAA-MM-DD
        const [d, m, y] = raceDate.split('/');
        body['race_date'] = `${y}-${m}-${d}`;
        body['race_distance_km'] = DISTANCE_KM[raceDistance];
      }
      const res = await fetch(`${API_URL}/onboarding/goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Falha ao salvar objetivo');
      router.push('/onboarding/garmin');
    } catch {
      Alert.alert('Erro', 'Não conseguimos salvar seu objetivo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.progress}>
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>Seu objetivo</Text>
        <Text style={styles.subtitle}>Isso define como o plano é construído</Text>

        <TouchableOpacity
          style={[styles.card, mode === 'race' && styles.cardActive]}
          onPress={() => setMode('race')}
        >
          <Text style={styles.cardIcon}>🏁</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Tenho uma prova alvo</Text>
            <Text style={styles.cardDesc}>Preparação periodizada para uma data específica</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, mode === 'general_progression' && styles.cardActive]}
          onPress={() => setMode('general_progression')}
        >
          <Text style={styles.cardIcon}>📈</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Quero evoluir gradualmente</Text>
            <Text style={styles.cardDesc}>Sem prova definida — foco em base e progressão</Text>
          </View>
        </TouchableOpacity>

        {mode === 'race' && (
          <>
            <Text style={styles.label}>Distância da prova</Text>
            <View style={styles.row}>
              {(['5k', '10k', '21k', '42k', '70.3', 'other'] as RaceDistance[]).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, raceDistance === d && styles.chipActive]}
                  onPress={() => setRaceDistance(d)}
                >
                  <Text style={[styles.chipText, raceDistance === d && styles.chipTextActive]}>
                    {d === '70.3' ? '70.3mi' : d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Data da prova</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              value={raceDate}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, '');
                let formatted = digits;
                if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                setRaceDate(formatted);
              }}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={next}
          disabled={!isValid || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continuar</Text>}
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  cardActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  cardIcon: { fontSize: 32 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 20 },
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
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#f9fafb',
  },
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
