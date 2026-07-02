import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';

// Tela 15 — checklist transparente do raciocínio da geração. Os rótulos
// espelham as etapas reais do pipeline (/plan/generate): ler histórico,
// calcular carga, distribuir intensidade, posicionar longo/recuperação.
const GENERATION_STEPS = [
  'Li seus últimos treinos sincronizados',
  'Calculei sua carga e ACWR',
  'Distribuindo intensidade 80/20…',
  'Posicionando o longo e a recuperação',
];

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
  const [step, setStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (stepRef.current) clearInterval(stepRef.current);
    };
  }, []);

  // Avança o checklist em ritmo constante enquanto o job roda; o último
  // passo só completa quando o backend confirma (finish/erro param tudo).
  useEffect(() => {
    if (!generating) {
      if (stepRef.current) clearInterval(stepRef.current);
      setStep(0);
      return;
    }
    stepRef.current = setInterval(() => {
      setStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, 4000);
    return () => {
      if (stepRef.current) clearInterval(stepRef.current);
    };
  }, [generating]);

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
      <View style={[styles.container, styles.genScreen]}>
        <View style={styles.genLogo}>
          <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 7l7 5-7 5M12 7l7 5-7 5"
              stroke={theme.colors.onAccent}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <Text style={styles.genTitle}>Montando sua semana</Text>

        <View style={styles.genChecklist}>
          {GENERATION_STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <View key={label} style={[styles.genStep, !done && !active && { opacity: 0.5 }]}>
                {done ? (
                  <View style={styles.genStepDone}>
                    <Ionicons name="checkmark" size={13} color={theme.colors.onAccent} />
                  </View>
                ) : active ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <View style={styles.genStepFuture} />
                )}
                <Text style={[styles.genStepText, done && styles.genStepTextDone]}>{label}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.genFootnote}>
          {jobId ? 'Costuma levar poucos segundos.' : 'Preparando a geração…'}
        </Text>
      </View>
    );
  }

  function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
    return (
      <View style={styles.infoRow}>
        <Ionicons name={icon} size={18} color={theme.colors.accent} />
        <Text style={styles.infoText}>{text}</Text>
      </View>
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
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

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
          <InfoRow icon="refresh" text="Substitui o plano da semana atual" />
          <InfoRow icon="trending-up" text="Considera sua carga e progressão recentes" />
          <InfoRow icon="shield-checkmark" text="Aplica guardrails de segurança automáticos" />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
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
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
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

    // Estado de geração (tela 15)
    genScreen: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.lg,
    },
    genLogo: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.glow,
    },
    genTitle: { ...theme.type.headline, color: theme.colors.textPrimary, textAlign: 'center' },
    genChecklist: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    genStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2, minHeight: 22 },
    genStepDone: {
      width: 20,
      height: 20,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    genStepFuture: {
      width: 20,
      height: 20,
      borderRadius: Radii.full,
      borderWidth: 1.5,
      borderColor: theme.colors.borderStrong,
    },
    genStepText: { ...theme.type.bodySm, fontSize: FontSize.sm, color: theme.colors.textPrimary, flex: 1 },
    genStepTextDone: { color: theme.colors.textSecondary },
    genFootnote: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
    },
  });
