import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, Radii, Spacing, Type } from '../../lib/theme';
import { Button } from '../../components/Button';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';

// "Pedir Novo Plano" — dispara a regeneração do plano semanal pela IA.
// Reaproveita o endpoint /plan/generate + polling de job.
export default function NewPlanScreen() {
  const session = useAuthStore((s) => s.session);
  const { post, get } = useApi();
  const qc = useQueryClient();

  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function finish() {
    qc.invalidateQueries({ queryKey: ['plan'] });
    router.replace('/plan/updated' as never);
  }

  function pollJob(id: string) {
    let attempts = 0;
    intervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const body = await get<{ status: string }>(`/jobs/${id}`);
        if (body.status === 'done') {
          clearInterval(intervalRef.current!);
          finish();
        } else if (body.status === 'failed' || attempts > 60) {
          clearInterval(intervalRef.current!);
          setGenerating(false);
          setJobId(null);
          setError('A geração falhou. Tente novamente em alguns instantes.');
        }
      } catch { /* continua tentando */ }
    }, 5000);
  }

  async function generate() {
    if (!session?.athlete_id) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await post<{ job_id?: string }>('/plan/generate', {
        athlete_id: session.athlete_id,
      });
      if (res?.job_id) {
        setJobId(res.job_id);
        pollJob(res.job_id);
      } else {
        finish();
      }
    } catch (e: unknown) {
      setGenerating(false);
      setError(e instanceof Error ? e.message : 'Não conseguimos gerar um novo plano.');
    }
  }

  if (generating) {
    return (
      <LoadingScreen
        message={jobId ? 'Processando seu novo plano...' : 'Gerando seu plano com IA...'}
        subMessage="Isso pode levar até 1 minuto"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconCircle}>
          <Ionicons name="sparkles" size={36} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Pedir um novo plano</Text>
        <Text style={styles.subtitle}>
          A IA vai recriar sua semana de treinos com base no seu perfil, objetivo e nos treinos
          mais recentes sincronizados.
        </Text>

        <View style={styles.infoCard}>
          <InfoRow icon="refresh" text="Substitui o plano da semana atual" />
          <InfoRow icon="trending-up" text="Considera sua carga e progressão recentes" />
          <InfoRow icon="shield-checkmark" text="Aplica guardrails de segurança automáticos" />
        </View>

        {error ? <ErrorCard message={error} /> : null}

        <Button
          label="Gerar novo plano"
          onPress={generate}
          icon={<Ionicons name="sparkles" size={18} color={Colors.onAccent} />}
          accessibilityLabel="Gerar um novo plano de treino"
        />
        <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.accent} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl + Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: Spacing.lg, gap: Spacing.md },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  title: { ...Type.headline, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Type.body, color: Colors.textSecondary, textAlign: 'center' },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoText: { ...Type.bodySm, color: Colors.textPrimary, flex: 1 },
});
