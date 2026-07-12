import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { BackHeader } from '../../components/BackHeader';

const MIN_S = 600; // 10 min
const MAX_S = 840; // 14 min

const STEPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'location-outline', text: 'Use uma pista plana ou terreno aberto com bom sinal de GPS.' },
  { icon: 'flame-outline', text: 'Aqueça 5–10 min em ritmo leve antes de iniciar.' },
  { icon: 'stopwatch-outline', text: 'Corra 12 minutos na maior distância que conseguir sustentar.' },
  { icon: 'heart-outline', text: 'Use a cinta ou o sensor de pulso do Garmin para capturar a FC.' },
  { icon: 'sync-outline', text: 'Sincronize o Garmin ao terminar e selecione a corrida abaixo.' },
];

interface WorkoutListItem {
  id: string;
  date: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function fmtClock(totalS: number): string {
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtPace(durationS: number, distanceM: number): string {
  if (distanceM <= 0) return '—';
  const paceS = Math.round(durationS / (distanceM / 1000));
  const m = Math.floor(paceS / 60);
  const s = paceS % 60;
  return `${m}'${String(s).padStart(2, '0')}"/km`;
}

export default function CooperScreen() {
  const session = useAuthStore((s) => s.session);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  const { get, post } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [restingHr, setRestingHr] = useState('');
  const [restingError, setRestingError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['workouts', 'cooper', session?.athlete_id],
    queryFn: () =>
      get<{ workouts: WorkoutListItem[] }>(
        `/workouts?athlete_id=${session?.athlete_id}&limit=50`,
      ),
    enabled: !!session?.athlete_id,
  });

  const eligible = (data?.workouts ?? []).filter(
    (w) => w.duration_s >= MIN_S && w.duration_s <= MAX_S && w.distance_m > 0,
  );

  function finishOnboarding() {
    setOnboardingComplete();
    if (session?.athlete_id) {
      post('/plan/generate', { athlete_id: session.athlete_id }).catch(() => {});
    }
    router.replace('/(tabs)/plan');
  }

  async function selectActivity(activity: WorkoutListItem) {
    const fcRest = Number(restingHr);
    if (!restingHr.trim() || Number.isNaN(fcRest) || fcRest < 30 || fcRest > 100) {
      setRestingError('Informe sua FC de repouso (entre 30 e 100 bpm).');
      return;
    }
    setRestingError(null);
    setError(null);
    setSaving(true);
    try {
      const detail = await get<{ workout: { max_hr: number | null } }>(
        `/workouts/${activity.id}`,
      );
      const fcMax = detail.workout.max_hr;
      if (fcMax == null || fcMax < 100) {
        setError(
          'Essa corrida não tem frequência cardíaca máxima registrada. Escolha outra feita com monitor cardíaco.',
        );
        setSaving(false);
        return;
      }
      await post('/onboarding/zones', {
        athlete_id: session?.athlete_id,
        fc_max: fcMax,
        fc_rest: fcRest,
      });
      finishOnboarding();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não conseguimos calibrar suas zonas.');
      setSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingScreen message="Buscando suas corridas..." />;
  }
  if (saving) {
    return (
      <LoadingScreen
        message="Calibrando suas zonas"
        subMessage="Usamos sua FC máxima medida para personalizar o plano"
      />
    );
  }

  return (
    <View style={styles.container}>
      <BackHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Calibre suas zonas</Text>
        <Text style={styles.subtitle}>
          O Teste de Cooper mede sua FC máxima real numa corrida de 12 minutos no esforço mais
          forte que você sustentar. Zonas calibradas com FC medida geram um plano muito mais
          preciso do que estimativas por idade.
        </Text>

        <TouchableOpacity
          style={styles.guideToggle}
          onPress={() => setShowGuide((v) => !v)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ expanded: showGuide }}
          accessibilityLabel="Como realizar o Teste de Cooper"
        >
          <Text style={styles.guideToggleText}>
            {showGuide ? 'Ocultar instruções' : 'Como realizar o teste'}
          </Text>
          <Ionicons
            name={showGuide ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.primary}
          />
        </TouchableOpacity>

        {showGuide ? (
          <View style={styles.guideBox}>
            {STEPS.map((step) => (
              <View key={step.text} style={styles.step}>
                <Ionicons name={step.icon} size={18} color={theme.colors.primary} />
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Input
          label="FC de repouso (bpm)"
          placeholder="Ex: 58"
          keyboardType="number-pad"
          maxLength={3}
          value={restingHr}
          onChangeText={setRestingHr}
          error={restingError ?? undefined}
        />
        <Text style={styles.hint}>
          Meça em repouso total, logo ao acordar, antes de levantar da cama.
        </Text>

        {error ? (
          <View style={{ marginVertical: Spacing.sm }}>
            <ErrorCard message={error} />
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>
          {eligible.length > 0
            ? `${eligible.length} corrida${eligible.length > 1 ? 's' : ''} elegível${eligible.length > 1 ? 'is' : ''} (10–14 min)`
            : 'Corridas elegíveis (10–14 min)'}
        </Text>

        {eligible.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="walk-outline" size={36} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Nenhuma corrida de ~12 minutos encontrada</Text>
            <Text style={styles.emptyHint}>
              Faça o teste seguindo as instruções acima, sincronize o Garmin e volte aqui — ou
              calibre depois nas configurações.
            </Text>
          </View>
        ) : (
          eligible.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => selectActivity(item)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Usar corrida de ${fmtDate(item.date)}, ${fmtClock(item.duration_s)} minutos`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>{fmtDate(item.date)}</Text>
                <Text style={styles.cardDuration}>{fmtClock(item.duration_s)} min</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMeta}>{(item.distance_m / 1000).toFixed(2)} km</Text>
                <Text style={styles.cardMeta}>{fmtPace(item.duration_s, item.distance_m)}</Text>
                {item.avg_hr ? <Text style={styles.cardMeta}>{item.avg_hr} bpm méd</Text> : null}
              </View>
              <View style={styles.cardCtaRow}>
                <Text style={styles.cardCta}>Usar esta corrida</Text>
                <Ionicons name="arrow-forward" size={15} color={theme.colors.primary} />
              </View>
            </TouchableOpacity>
          ))
        )}

        <Button
          label="Fazer depois"
          variant="ghost"
          onPress={finishOnboarding}
          style={styles.skipBtn}
          accessibilityLabel="Pular calibração e ver meu plano"
        />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    scroll: { flex: 1 },
    content: { padding: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl },
    title: { ...theme.type.display, color: theme.colors.textPrimary, marginBottom: Spacing.xs },
    subtitle: { ...theme.type.bodySm, color: theme.colors.textSecondary, marginBottom: Spacing.md },
    guideToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.md,
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: Radii.md,
      marginBottom: Spacing.md,
    },
    guideToggleText: { fontFamily: Fonts.bodySemiBold, color: theme.colors.primary, fontSize: FontSize.sm },
    guideBox: {
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: Spacing.sm,
    },
    step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    stepText: { flex: 1, ...theme.type.bodySm, color: theme.colors.textSecondary },
    hint: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      marginTop: -Spacing.xs,
      marginBottom: Spacing.md,
    },
    sectionLabel: { ...theme.type.label, color: theme.colors.textMuted, marginBottom: Spacing.sm },
    empty: { paddingVertical: Spacing.xl, alignItems: 'center', gap: Spacing.xs },
    emptyText: { ...theme.type.subtitle, fontSize: FontSize.md, color: theme.colors.textPrimary, textAlign: 'center' },
    emptyHint: { ...theme.type.bodySm, color: theme.colors.textMuted, textAlign: 'center' },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    cardDate: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
    },
    cardDuration: { fontFamily: Fonts.data, fontSize: FontSize.xl, color: theme.colors.textPrimary },
    cardMetaRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap', marginTop: Spacing.xs },
    cardMeta: { fontFamily: Fonts.data, fontSize: FontSize.sm, color: theme.colors.textSecondary },
    cardCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
    cardCta: { fontFamily: Fonts.bodySemiBold, fontSize: FontSize.sm, color: theme.colors.primary },
    skipBtn: { marginTop: Spacing.md },
  });
