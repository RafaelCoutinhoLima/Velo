// US-008 — Disclaimer obrigatório LGPD antes de qualquer chamada Claude
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function DisclaimerScreen() {
  const session = useAuthStore((s) => s.session);
  const [loading, setLoading] = useState(false);

  async function accept() {
    if (!session?.athlete_id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/onboarding/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: session.athlete_id }),
      });
      if (!res.ok) throw new Error('Falha ao registrar consentimento');
      router.push('/onboarding/profile');
    } catch {
      Alert.alert('Erro', 'Não conseguimos registrar seu aceite. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.progress}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      <Text style={styles.title}>Antes de começar</Text>
      <Text style={styles.subtitle}>Leia com atenção</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏃 O que o FitSync faz</Text>
          <Text style={styles.cardText}>
            Gera planos de corrida personalizados com IA, baseados nos seus dados do Garmin e
            métricas de carga de treino (rTSS, ACWR, HRV).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ O que o FitSync não faz</Text>
          <Text style={styles.cardText}>
            O FitSync AI <Text style={styles.bold}>não substitui</Text> acompanhamento médico,
            fisioterapêutico ou de treinador profissional. Em caso de dor, lesão ou desconforto,
            consulte um profissional de saúde.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔒 Seus dados (LGPD)</Text>
          <Text style={styles.cardText}>
            Coletamos seus dados de treino do Garmin, perfil esportivo e métricas fisiológicas para
            gerar planos personalizados. Seus dados ficam armazenados em servidores no Brasil.
            Você pode exportar ou excluir seus dados a qualquer momento nas configurações.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🤖 IA generativa</Text>
          <Text style={styles.cardText}>
            Os planos são gerados pelo Claude (Anthropic). Aplicamos guardrails automáticos de
            segurança (carga máxima, progressão) mas sempre revise o plano antes de executar.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.btn} onPress={accept} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Li e aceito os termos</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 56 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 32, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  dotActive: { backgroundColor: '#2563eb', width: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 20 },
  scroll: { flex: 1 },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#4b5563', lineHeight: 22 },
  bold: { fontWeight: '700' },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
