// US-002 — Conectar Garmin via sidecar + US-005 importar 90 dias
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type Step = 'form' | 'connecting' | 'importing' | 'done';

export default function GarminScreen() {
  const session = useAuthStore((s) => s.session);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [step, setStep] = useState<Step>('form');

  async function connect() {
    if (!email || !password || !session?.athlete_id) return;
    setStep('connecting');

    try {
      const connectRes = await fetch(`${API_URL}/garmin/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_id: session.athlete_id,
          email,
          password,
          mfa_code: mfaCode || undefined,
        }),
      });

      if (!connectRes.ok) {
        const err = (await connectRes.json().catch(() => ({}))).error ?? 'Erro ao conectar Garmin';
        throw new Error(err);
      }

      setStep('importing');
      const syncRes = await fetch(`${API_URL}/garmin/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: session.athlete_id }),
      });

      if (!syncRes.ok) throw new Error('Não conseguimos importar seus treinos');

      setStep('done');
    } catch (e: unknown) {
      setStep('form');
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      Alert.alert('Erro', msg);
    }
  }

  async function finish() {
    setOnboardingComplete();
    if (session?.athlete_id) {
      // Dispara geração do primeiro plano assincronamente
      fetch(`${API_URL}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: session.athlete_id }),
      }).catch(() => {
        // Falha silenciosa — job async garante reprocessamento
      });
    }
    router.replace('/(tabs)/plan');
  }

  if (step === 'connecting') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.statusText}>Conectando ao Garmin...</Text>
        <Text style={styles.statusSub}>Isso pode levar alguns segundos</Text>
      </View>
    );
  }

  if (step === 'importing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.statusText}>Importando seus treinos</Text>
        <Text style={styles.statusSub}>Buscando os últimos 90 dias do Garmin Connect</Text>
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View style={styles.centered}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.statusText}>Garmin conectado!</Text>
        <Text style={styles.statusSub}>
          Seus treinos foram importados e seu primeiro plano está sendo gerado.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={finish}>
          <Text style={styles.btnText}>Ver meu plano</Text>
        </TouchableOpacity>
      </View>
    );
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
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <Text style={styles.title}>Conectar Garmin</Text>
        <Text style={styles.subtitle}>
          Usamos seu Garmin Connect para importar treinos passados e enviar treinos para o relógio.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            🔒 Suas credenciais são criptografadas e nunca ficam armazenadas em texto plano.
          </Text>
        </View>

        <Text style={styles.label}>E-mail do Garmin Connect</Text>
        <TextInput
          style={styles.input}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Código MFA (se habilitado)</Text>
        <TextInput
          style={styles.input}
          placeholder="123456 (opcional)"
          keyboardType="number-pad"
          maxLength={6}
          value={mfaCode}
          onChangeText={setMfaCode}
        />

        <TouchableOpacity
          style={[styles.btn, (!email || !password) && styles.btnDisabled]}
          onPress={connect}
          disabled={!email || !password}
        >
          <Text style={styles.btnText}>Conectar e importar treinos</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>Pular por agora</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 32, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  dotActive: { backgroundColor: '#2563eb', width: 24 },
  dotDone: { backgroundColor: '#93c5fd' },
  title: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 20, lineHeight: 22 },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  infoText: { fontSize: 13, color: '#1d4ed8', lineHeight: 20 },
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
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', marginTop: 16, padding: 8 },
  skipText: { color: '#6b7280', fontSize: 14 },
  statusText: { fontSize: 20, fontWeight: '700', color: '#111', marginTop: 20, textAlign: 'center' },
  statusSub: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  doneIcon: { fontSize: 56 },
});
