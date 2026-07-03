import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../lib/api';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../Button';
import { GenerationProgress } from './GenerationProgress';

interface EmptyPlanProps {
  athleteId: string;
  onPlanReady: () => void;
}

export function EmptyPlan({ athleteId, onPlanReady }: EmptyPlanProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { post, get } = useApi();

  // Máquina de estados: idle → submitting → polling → (done|error). User pode
  // cancelar após 90s. Erro mostra mensagem específica e botão retry.
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'polling' | 'error'>('idle');
  const [pollSeconds, setPollSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimers() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    intervalRef.current = null;
    tickRef.current = null;
  }

  useEffect(() => stopTimers, []);

  function cancel() {
    stopTimers();
    setPhase('idle');
    setPollSeconds(0);
  }

  async function generate() {
    setPhase('submitting');
    setErrorMessage(null);
    setPollSeconds(0);
    try {
      const res = await post<{ job_id?: string; plan?: unknown }>('/plan/generate', {
        athlete_id: athleteId,
      });
      if (res?.job_id) {
        setPhase('polling');
        tickRef.current = setInterval(() => setPollSeconds((s) => s + 1), 1000);
        pollJob(res.job_id);
      } else {
        onPlanReady();
      }
    } catch (err) {
      setPhase('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não conseguimos iniciar a geração. Tente de novo em alguns minutos.',
      );
    }
  }

  function pollJob(id: string) {
    let attempts = 0;
    intervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const body = await get<{ status: string }>(`/jobs/${id}`);
        if (body.status === 'done') {
          stopTimers();
          onPlanReady();
        } else if (body.status === 'failed') {
          stopTimers();
          setPhase('error');
          setErrorMessage(
            'A IA não conseguiu gerar seu plano dessa vez. Tente de novo em alguns minutos.',
          );
        } else if (attempts > 60) {
          stopTimers();
          setPhase('error');
          setErrorMessage(
            'A geração demorou mais que o esperado. Pode ser sobrecarga no servidor da IA. Tente de novo em alguns minutos.',
          );
        }
      } catch {
        /* continua tentando — falha de rede pontual */
      }
    }, 5000);
  }

  if (phase === 'submitting' || phase === 'polling') {
    const footnote =
      phase === 'submitting'
        ? 'Enviando pedido pra IA…'
        : pollSeconds < 30
          ? 'Isso geralmente leva até 1 minuto.'
          : pollSeconds < 90
            ? 'Demorando mais que o esperado. Pode levar até 2 minutos no total.'
            : 'Mais de 90 segundos. Você pode esperar ou cancelar.';

    return (
      <GenerationProgress footnote={footnote}>
        {pollSeconds >= 90 ? (
          <Button
            label="Cancelar"
            variant="secondary"
            onPress={cancel}
            style={styles.button}
            accessibilityLabel="Cancelar geração do plano"
          />
        ) : null}
      </GenerationProgress>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.wrap}>
        <View style={styles.errorCircle}>
          <Ionicons name="alert-circle-outline" size={36} color={theme.colors.danger} />
        </View>
        <Text style={styles.title}>Não foi dessa vez</Text>
        <Text style={styles.text}>{errorMessage}</Text>
        <Button
          label="Tentar de novo"
          onPress={generate}
          style={styles.button}
          icon={<Ionicons name="refresh" size={18} color={theme.colors.onAccent} />}
          accessibilityLabel="Tentar gerar o plano novamente"
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="calendar-outline" size={36} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>Nenhum plano ativo</Text>
      <Text style={styles.text}>
        Gere seu primeiro plano semanal personalizado com base no seu perfil e histórico.
      </Text>
      <Button
        label="Gerar meu plano"
        onPress={generate}
        style={styles.button}
        icon={<Ionicons name="sparkles" size={18} color={theme.colors.onAccent} />}
        accessibilityLabel="Gerar plano de treino com IA"
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    errorCircle: {
      width: 88,
      height: 88,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.dangerLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      ...theme.type.headline,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    text: {
      ...theme.type.body,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    button: { width: '100%' },
  });
