import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, FontWeight, Radii, Spacing, Tracking, useTheme, type Theme } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { BackHeader } from '../../components/BackHeader';
import { RpeScale, RPE_LABELS } from '../../components/workout/RpeScale';

// Forma curta ("Terça", não "Terça-feira") — bate com o handoff (hero "today
// hero" de Velo App.dc.html) e evita que o pill "Concluído" + a data estourem
// a largura do hero em telas estreitas (~320pt).
const PT_WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function formatPace(paceS: number): string {
  const min = Math.floor(paceS / 60);
  const sec = paceS % 60;
  return `${min}'${String(sec).padStart(2, '0')}"`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function weekday(iso: string): string {
  return PT_WEEKDAYS_FULL[new Date(`${iso}T12:00:00`).getDay()] ?? '';
}

function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (s > 0) return `${m}m${String(s).padStart(2, '0')}s`;
  return `${m}`;
}

interface Workout {
  id: string;
  date: string;
  type?: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  max_hr: number | null;
  rtss: number | null;
  rpe?: number | null;
  avg_pace_s: number | null;
  calories: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  vo2max: number | null;
  steps: number | null;
  activity_name: string | null;
  location: string | null;
  description?: string;
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const { get, patch } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    easy:     { label: 'Regenerativo', color: theme.colors.workoutEasy },
    interval: { label: 'Intervalado',  color: theme.colors.workoutInterval },
    tempo:    { label: 'Tempo',        color: theme.colors.workoutTempo },
    long:     { label: 'Longo',        color: theme.colors.workoutLong },
    rest:     { label: 'Descanso',     color: theme.colors.workoutRest },
    cross:    { label: 'Cross',        color: theme.colors.workoutCross },
  };

  function rpeColor(n: number): string {
    if (n <= 3) return theme.colors.workoutEasy;
    if (n <= 5) return theme.colors.workoutTempo;
    if (n <= 7) return theme.colors.warning;
    return theme.colors.danger;
  }

  const [rpe, setRpe] = useState<number | null>(null);
  // `rpeFromGarmin`: o valor inicial veio do sync (perceivedEffort/feel) — UI
  // colapsa pra um chip de confirmação no lugar dos 10 botões.
  const [rpeFromGarmin, setRpeFromGarmin] = useState(false);
  const [rpeEditOpen, setRpeEditOpen] = useState(false);
  const [savingRpe, setSavingRpe] = useState(false);
  const [rpeError, setRpeError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workout', id],
    queryFn: () => get<{ workout: Workout }>(`/workouts/${id}`),
    enabled: !!id && !!session,
  });

  useEffect(() => {
    if (data?.workout.rpe != null) {
      setRpe(data.workout.rpe);
      setRpeFromGarmin(true);
    }
  }, [data?.workout.rpe]);

  async function saveRpe(value: number) {
    setRpe(value);
    // Após edição manual, o valor não é mais "do Garmin" — ajuste do atleta vence.
    setRpeFromGarmin(false);
    setRpeEditOpen(false);
    setSavingRpe(true);
    setRpeError(null);
    try {
      await patch(`/workouts/${id}`, { rpe: value });
    } catch {
      setRpeError('Não conseguimos salvar. Tente novamente.');
    } finally {
      setSavingRpe(false);
    }
  }

  function SplitPanel({
    left,
    right,
  }: {
    left: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; unit: string };
    right: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; unit: string };
  }) {
    return (
      <View style={styles.splitPanel}>
        <View style={styles.splitSide}>
          <View style={styles.splitLabelRow}>
            <Ionicons name={left.icon} size={15} color={theme.colors.accent} />
            <Text style={styles.splitLabel}>{left.label}</Text>
          </View>
          <Text style={styles.splitValue}>
            {left.value}
            <Text style={styles.splitUnit}> {left.unit}</Text>
          </Text>
        </View>
        <View style={styles.splitDivider} />
        <View style={[styles.splitSide, { alignItems: 'flex-end' }]}>
          <View style={styles.splitLabelRow}>
            <Ionicons name={right.icon} size={15} color={theme.colors.accent} />
            <Text style={styles.splitLabel}>{right.label}</Text>
          </View>
          <Text style={styles.splitValue}>
            {right.value}
            <Text style={styles.splitUnit}> {right.unit}</Text>
          </Text>
        </View>
      </View>
    );
  }

  function GridStat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
    return (
      <View style={styles.gridStat}>
        <Ionicons name={icon} size={18} color={theme.colors.textMuted} />
        <View>
          <Text style={styles.gridValue}>{value}</Text>
          <Text style={styles.gridLabel}>{label}</Text>
        </View>
      </View>
    );
  }

  if (isLoading) return <LoadingScreen message="Carregando treino..." />;

  if (isError || !data?.workout) {
    return (
      <View style={styles.container}>
        <BackHeader />
        <View style={styles.content}>
          <ErrorCard message="Treino não encontrado ou falha ao carregar." />
        </View>
      </View>
    );
  }

  const w = data.workout;
  const typeConfig = TYPE_CONFIG[w.type ?? 'easy'] ?? TYPE_CONFIG.easy;
  const distKm = w.distance_m > 0 ? (w.distance_m / 1000).toFixed(1) : '—';
  const heroTitle = (w.activity_name?.trim() || typeConfig.label).toUpperCase();

  return (
    <View style={styles.container}>
      {/* ── Header ── só botão de voltar. Tipo do treino vai pro hero como dot. */}
      <BackHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── badge "✓ Concluído" (tela 17) + data; tipo vira ponto colorido */}
        <View style={styles.hero}>
          <View style={styles.heroPills}>
            <View style={styles.donePill}>
              <Ionicons name="checkmark" size={12} color={theme.colors.success} />
              <Text style={styles.donePillText}>Concluído</Text>
            </View>
            <Text style={styles.datePillMuted} numberOfLines={1} ellipsizeMode="tail">
              {weekday(w.date)} · {formatDate(w.date)}
            </Text>
          </View>
          <View style={styles.heroTypeRow}>
            <View style={[styles.heroTypeDot, { backgroundColor: typeConfig.color }]} />
            <Text style={[styles.heroTypeLabel, { color: typeConfig.color }]}>
              {typeConfig.label}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          {w.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={15} color={theme.colors.textMuted} />
              <Text style={styles.locationText}>{w.location}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Distância | Duração ── */}
        <SplitPanel
          left={{ icon: 'map-outline', label: 'Distância', value: distKm, unit: 'km' }}
          right={{
            icon: 'timer-outline',
            label: 'Duração',
            value: w.duration_s > 0 ? formatDuration(w.duration_s) : '—',
            unit: w.duration_s >= 3600 ? '' : 'min',
          }}
        />

        {/* ── FC média (destaque) ── */}
        <View style={styles.hrPanel}>
          <Ionicons name="heart" size={34} color={theme.colors.danger} />
          <Text style={styles.hrValue}>
            {w.avg_hr != null ? w.avg_hr : '—'}
            <Text style={styles.hrUnit}>  BPM Médio</Text>
          </Text>
        </View>

        {/* ── Grade de métricas ── */}
        <View style={styles.gridCard}>
          <View style={styles.gridRow}>
            <GridStat
              icon="speedometer-outline"
              value={w.avg_pace_s ? `${formatPace(w.avg_pace_s)}/km` : '—'}
              label="Pace médio"
            />
            <GridStat
              icon="heart-outline"
              value={w.max_hr != null ? `${w.max_hr} bpm` : '—'}
              label="FC máxima"
            />
          </View>
          <View style={styles.gridSep} />
          <View style={styles.gridRow}>
            <GridStat
              icon="flame-outline"
              value={w.calories != null ? `${w.calories}` : '—'}
              label="Calorias"
            />
            <GridStat
              icon="footsteps-outline"
              value={w.steps != null ? w.steps.toLocaleString('pt-BR') : '—'}
              label="Passos"
            />
          </View>
          {(w.elevation_gain != null || w.vo2max != null || w.rtss != null) ? (
            <>
              <View style={styles.gridSep} />
              <View style={styles.gridRow}>
                <GridStat
                  icon="trending-up-outline"
                  value={w.elevation_gain != null ? `${w.elevation_gain} m` : '—'}
                  label="Ganho de altitude"
                />
                <GridStat
                  icon="pulse-outline"
                  value={
                    w.rtss != null
                      ? `${w.rtss.toFixed(0)} rTSS`
                      : w.vo2max != null
                        ? `${w.vo2max}`
                        : '—'
                  }
                  label={w.rtss != null ? 'Carga (rTSS)' : 'VO₂ máx'}
                />
              </View>
              {w.rtss != null ? (
                <Text style={styles.rtssFootnote}>
                  rTSS mede o peso total deste treino na sua semana de carga.
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {/* ── RPE / Esforço ── 3 estados:
            1) Veio do Garmin (rpeFromGarmin): chip verde compacto + link "Ajustar"
            2) Editado pelo atleta (rpe!=null, !fromGarmin, !editOpen): chip simples
            3) Vazio OU clicou em ajustar: widget completo com 10 botões
         */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Esforço</Text>

          {rpe != null && rpeFromGarmin && !rpeEditOpen ? (
            <View style={styles.rpeChipRow}>
              <View style={[styles.rpeChipGarmin, { borderColor: rpeColor(rpe) }]}>
                <Ionicons name="watch" size={16} color={rpeColor(rpe)} />
                <Text style={[styles.rpeChipValue, { color: rpeColor(rpe) }]}>
                  {rpe}
                </Text>
                <Text style={styles.rpeChipLabel}>{RPE_LABELS[rpe]}</Text>
                <Text style={styles.rpeChipSource}>do seu relógio</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRpeEditOpen(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Ajustar esforço percebido"
              >
                <Text style={styles.rpeAdjustLink}>Ajustar</Text>
              </TouchableOpacity>
            </View>
          ) : rpe != null && !rpeEditOpen ? (
            <View style={styles.rpeChipRow}>
              <View style={[styles.rpeChipGarmin, { borderColor: rpeColor(rpe) }]}>
                <Ionicons name="checkmark-circle" size={16} color={rpeColor(rpe)} />
                <Text style={[styles.rpeChipValue, { color: rpeColor(rpe) }]}>
                  {rpe}
                </Text>
                <Text style={styles.rpeChipLabel}>{RPE_LABELS[rpe]}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRpeEditOpen(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Alterar esforço percebido"
              >
                <Text style={styles.rpeAdjustLink}>Alterar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.cardSub}>Como você sentiu? Ajuda a calibrar seu plano.</Text>
              <RpeScale value={rpe} onSelect={saveRpe} colorFor={rpeColor} />
              <Text style={styles.rpeMicrocopy}>
                Seu RPE calibra a carga dos próximos treinos.
              </Text>
            </>
          )}

          {savingRpe ? (
            <Text style={styles.rpeStatus} accessibilityLiveRegion="polite">
              Salvando…
            </Text>
          ) : null}
          {rpeError ? (
            <View style={{ marginTop: Spacing.sm }}>
              <ErrorCard message={rpeError} />
            </View>
          ) : null}
        </View>

        {/* ── Feedback do treinador ── */}
        <View style={styles.coachCard}>
          <View style={styles.coachHead}>
            <Ionicons name="sparkles" size={18} color={theme.colors.accent} />
            <Text style={styles.coachLabel}>Feedback do treinador</Text>
          </View>
          <Text style={styles.cardSub}>
            Receba uma análise personalizada deste treino com base no seu pace, FC e histórico.
          </Text>
          <TouchableOpacity
            style={styles.coachBtn}
            onPress={() => router.push(`/feedback/${id}` as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver feedback do treinador para este treino"
          >
            <Text style={styles.coachBtnText}>Ver feedback do treinador</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },

    typePill: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radii.sm,
    },
    typePillText: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: theme.colors.onAccent,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },

    scroll: { flex: 1 },
    content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

    // Hero
    hero: { gap: Spacing.sm },
    heroPills: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    donePill: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.successLight,
      borderWidth: 1,
      borderColor: theme.colors.successBorder,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: Radii.full,
    },
    donePillText: {
      fontFamily: Fonts.dataBold,
      fontSize: FontSize.xs,
      color: theme.colors.success,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    datePillMuted: {
      flexShrink: 1,
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 5,
      borderRadius: Radii.sm,
      overflow: 'hidden',
    },
    heroTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    heroTypeDot: {
      width: 8,
      height: 8,
      borderRadius: Radii.full,
    },
    heroTypeLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wider,
    },
    heroTitle: {
      fontFamily: Fonts.displayBlack,
      fontSize: 42,
      lineHeight: 46,
      fontWeight: FontWeight.extrabold,
      color: theme.colors.textPrimary,
      letterSpacing: Tracking.tight,
      textTransform: 'uppercase',
    },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { ...theme.type.bodySm, color: theme.colors.textMuted },

    // Split panel
    splitPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: Radii.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.lg,
    },
    splitSide: { flex: 1, gap: Spacing.xs },
    splitLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    splitLabel: {
      fontFamily: Fonts.data,
      fontSize: 11,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    splitValue: {
      fontFamily: Fonts.displayBlack,
      fontSize: 34,
      fontWeight: FontWeight.extrabold,
      color: theme.colors.textPrimary,
    },
    splitUnit: { fontFamily: Fonts.display, fontSize: FontSize.md, color: theme.colors.textMuted },
    splitDivider: { width: 1, height: 48, backgroundColor: theme.colors.border, marginHorizontal: Spacing.md },

    // HR panel
    hrPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: Spacing.lg,
    },
    hrValue: {
      fontFamily: Fonts.displayBlack,
      fontSize: 38,
      fontWeight: FontWeight.extrabold,
      color: theme.colors.textPrimary,
    },
    hrUnit: { fontFamily: Fonts.display, fontSize: FontSize.md, color: theme.colors.textMuted },

    // Metrics grid
    gridCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    gridRow: { flexDirection: 'row', paddingVertical: Spacing.sm },
    gridStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    gridValue: { fontFamily: Fonts.data, fontSize: FontSize.md, color: theme.colors.textPrimary },
    gridLabel: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
    gridSep: { height: 1, backgroundColor: theme.colors.border },
    rtssFootnote: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      lineHeight: 17,
      paddingTop: Spacing.sm,
    },

    // Generic card
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    cardLabel: { ...theme.type.label, color: theme.colors.textMuted, marginBottom: 3 },
    cardSub: { ...theme.type.bodySm, color: theme.colors.textSecondary, marginBottom: Spacing.md },

    // RPE
    rpeSelected: { fontFamily: Fonts.bodySemiBold, fontSize: FontSize.sm, marginBottom: Spacing.sm },
    rpeChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginTop: Spacing.xs,
    },
    rpeChipGarmin: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1.5,
      borderRadius: Radii.md,
      backgroundColor: theme.colors.surface,
      flex: 1,
    },
    rpeChipValue: {
      fontFamily: Fonts.displayBlack,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.extrabold,
      marginLeft: 2,
    },
    rpeChipLabel: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.sm,
      color: theme.colors.textPrimary,
      marginLeft: 4,
    },
    rpeChipSource: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      marginLeft: 'auto',
    },
    rpeAdjustLink: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.sm,
      color: theme.colors.accent,
    },
    rpeMicrocopy: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      marginTop: Spacing.sm,
    },
    rpeStatus: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.textMuted, marginTop: Spacing.sm },

    // Coach card
    coachCard: {
      backgroundColor: theme.colors.accentLight,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    coachHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    coachLabel: { ...theme.type.label, color: theme.colors.accent },
    coachBtn: {
      flexDirection: 'row',
      backgroundColor: theme.colors.accentLight,
      borderRadius: Radii.full,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    coachBtnText: { fontFamily: Fonts.display, fontSize: FontSize.md, color: theme.colors.accent },
  });
