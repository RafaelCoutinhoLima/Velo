import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveProfile } from '../lib/api';

const SEX_OPTIONS: { label: string; value: 'M' | 'F' | 'other' }[] = [
  { label: 'Masculino', value: 'M' },
  { label: 'Feminino', value: 'F' },
  { label: 'Outro', value: 'other' },
];

const CURRENT_YEAR = new Date().getFullYear();

interface Props {
  onContinue: () => void;
}

export default function ProfileForm({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const [birthYear, setBirthYear] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | 'other' | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    const year = parseInt(birthYear, 10);
    if (!birthYear || Number.isNaN(year) || year < 1930 || year > CURRENT_YEAR - 10) {
      return 'Informe um ano de nascimento válido (entre 1930 e ' + (CURRENT_YEAR - 10) + ')';
    }
    const weight = parseFloat(weightKg);
    if (!weightKg || Number.isNaN(weight) || weight < 30 || weight > 200) {
      return 'Informe um peso válido (entre 30 e 200 kg)';
    }
    if (!sex) return 'Selecione seu sexo biológico';
    return null;
  }

  async function handleContinue() {
    const err = validate();
    if (err) {
      Alert.alert('Dados incompletos', err);
      return;
    }
    setLoading(true);
    try {
      await saveProfile({
        birth_year: parseInt(birthYear, 10),
        weight_kg: parseFloat(weightKg),
        sex: sex!,
      });
      onContinue();
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível salvar o perfil.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Seu perfil</Text>
        <Text style={styles.subtitle}>
          Usamos esses dados para calcular suas zonas de treino e personalizar seu plano.
        </Text>

        <Text style={styles.label}>Ano de nascimento</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 1990"
          placeholderTextColor="#555"
          keyboardType="number-pad"
          maxLength={4}
          value={birthYear}
          onChangeText={setBirthYear}
          returnKeyType="done"
        />

        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 72"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
          maxLength={5}
          value={weightKg}
          onChangeText={setWeightKg}
          returnKeyType="done"
        />

        <Text style={styles.label}>Sexo biológico</Text>
        <Text style={styles.labelHint}>Usado para estimar métricas fisiológicas</Text>
        <View style={styles.row}>
          {SEX_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, sex === opt.value && styles.chipSelected]}
              onPress={() => setSex(opt.value)}
            >
              <Text style={[styles.chipText, sex === opt.value && styles.chipTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, (!sex || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!sex || loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Continuar →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingBottom: 48 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 32, lineHeight: 22 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  labelHint: { color: '#555', fontSize: 12, marginBottom: 10, marginTop: -6 },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    padding: 14,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  chipSelected: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText: { color: '#ccc', fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: '#000', fontWeight: '700' },
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
