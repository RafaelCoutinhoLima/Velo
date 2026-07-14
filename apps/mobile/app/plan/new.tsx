import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';
import { GenerationProgress } from '../../components/plan/GenerationProgress';
import { BackHeader } from '../../components/BackHeader';

// "Pedir Novo Plano" — dispara a regeneração do plano semanal pela IA.
// Reaproveita o endpoint /plan/generate + polling de job.
export default function NewPlanScreen() {
  const session = useAuthStore((s) => s.session);
  const { post, get } = useApi();
  const qc = useQueryClient();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      <GenerationProgress
        footnote={jobId ? 'Costuma levar poucos segundos.' : 'Preparando a geração…'}
      />
    );
  }

  return (
    <View style={styles.container}>
      <BackHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconCircle}>
          <Ionicons name="sparkles" size={36} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Pedir um novo plano</Text>
        <Text style={styles.subtitle}>
          A IA vai recriar sua semana de treinos com base no seu perfil, objetivo e nos treinos
          mais recentes sincronizados.
        </Text>

        <View style={styles.infoCard}>
          <InfoRow icon="refresh" text="Substitui o plano da semana atual" theme={theme} styles={styles} />
          <InfoRow icon="trending-up" text="Considera sua carga e progressão recentes" theme={theme} styles={styles} />
          <InfoRow icon="shield-checkmark" text="Aplica guardrails de segurança automáticos" theme={theme} styles={styles} />
        </View>

        {error ? <ErrorCard message={error} /> : null}

        <Button
          label="Gerar novo plano"
          onPress={generate}
          icon={<Ionicons name="sparkles" size={18} color={theme.colors.onAccent} />}
          accessibilityLabel="Gerar um novo plano de treino"
        />
        <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

// Definido em escopo de módulo (não dentro da tela) para manter a identidade
// do componente estável entre renders — evita desmontar/remontar a subárvore.
function InfoRow({
  icon,
  text,
  theme,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={theme.colors.accent} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: Spacing.lg, gap: Spacing.md },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.xs,
    },
    title: { ...theme.type.headline, color: theme.colors.textPrimary, textAlign: 'center' },
    subtitle: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center' },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginVertical: Spacing.sm,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    infoText: { ...theme.type.bodySm, color: theme.colors.textPrimary, flex: 1 },
  });
