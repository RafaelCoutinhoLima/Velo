import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import type { PlanDiff } from '../(tabs)/plan';

// Indexado por posição do dia no plano (1 = segunda … 7 = domingo é derivado
// pela tela do plano; aqui usamos rótulo genérico "Dia N" — o diff compara
// posições, não datas do calendário).
const TYPE_LABELS: Record<string, string> = {
  easy: 'Rodagem leve',
  interval: 'Intervalado',
  tempo: 'Tempo',
  long: 'Longo',
  rest: 'Descanso',
  cross: 'Cross training',
};

function dayLabel(snap: { type: string; distance_km: number; duration_min: number } | null): string {
  if (!snap) return '—';
  const label = TYPE_LABELS[snap.type] ?? snap.type;
  if (snap.type === 'rest') return label;
  return snap.distance_km > 0 ? `${label} · ${snap.distance_km} km` : `${label} · ${snap.duration_min} min`;
}

// "Plano Atualizado" — confirmação exibida após a regeneração/replanejamento.
// US-020: quando veio de /plan/replan, o param `diff` (JSON) mostra o que
// mudou dia a dia; sem o param, cai na mensagem genérica (fluxo /plan/new).
export default function PlanUpdatedScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { diff: diffParam } = useLocalSearchParams<{ diff?: string }>();

  const diff = useMemo<PlanDiff | null>(() => {
    if (!diffParam) return null;
    try {
      return JSON.parse(String(diffParam)) as PlanDiff;
    } catch {
      return null; // param corrompido → segue com a mensagem genérica
    }
  }, [diffParam]);

  const changedDays = diff?.days.filter((d) => d.changed) ?? [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.center}>
        <View style={styles.iconWrap}>
          <View style={styles.glow} />
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={52} color={theme.colors.onAccent} />
          </View>
        </View>
        <Text style={styles.title}>Plano atualizado</Text>

        {diff && changedDays.length > 0 ? (
          <>
            <Text style={styles.text}>
              {changedDays.length === 1
                ? '1 dia mudou nesta semana'
                : `${changedDays.length} dias mudaram nesta semana`}
              {' · '}
              {diff.total_km_before} km → {diff.total_km_after} km
            </Text>
            <View style={styles.diffCard}>
              {changedDays.map((d) => (
                <View key={d.day} style={styles.diffRow}>
                  <Text style={styles.diffDay}>Dia {d.day}</Text>
                  <View style={styles.diffChange}>
                    <Text style={styles.diffBefore}>{dayLabel(d.before)}</Text>
                    <Ionicons name="arrow-forward" size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.diffAfter}>{dayLabel(d.after)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : diff ? (
          <Text style={styles.text}>
            Sua semana foi recalculada e continua no mesmo caminho — nenhum treino precisou mudar.
          </Text>
        ) : (
          <Text style={styles.text}>
            Recriamos sua semana com base nos seus dados mais recentes. O objetivo continua o
            mesmo — o caminho até ele ficou mais preciso.
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Ver meu plano"
          onPress={() => router.replace('/(tabs)/plan')}
          icon={<Ionicons name="arrow-forward" size={18} color={theme.colors.onAccent} />}
          accessibilityLabel="Ver meu plano atualizado"
        />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    center: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    iconWrap: { alignItems: 'center', justifyContent: 'center' },
    glow: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      opacity: 0.7,
    },
    iconCircle: {
      width: 104,
      height: 104,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    title: { ...theme.type.display, color: theme.colors.textPrimary, textAlign: 'center' },
    text: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center' },
    diffCard: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    diffRow: { gap: 2 },
    diffDay: { ...theme.type.label, color: theme.colors.textSecondary },
    diffChange: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    diffBefore: {
      ...theme.type.body,
      color: theme.colors.textSecondary,
      textDecorationLine: 'line-through',
    },
    diffAfter: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    footer: { padding: Spacing.lg },
  });
