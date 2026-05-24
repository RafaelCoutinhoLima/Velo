import { ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, Fonts, FontSize, FontWeight, Radii, Shadow, Spacing, Tracking, Type } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { TopBar } from '../../components/TopBar';

interface Workout {
  id: string;
  date: string;
  distance_m: number;
  duration_s: number;
}

// Marco derivado dos dados reais de treino — desbloqueado quando o valor
// acumulado atinge o limiar.
interface Milestone {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  threshold: number;
  current: number;
  unit: string;
}

// Streak = nº de semanas consecutivas (terminando nesta) com ≥1 treino.
function computeWeekStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const weekKeys = new Set(
    dates.map((iso) => {
      const d = new Date(`${iso}T12:00:00`);
      const sunday = new Date(d);
      sunday.setDate(d.getDate() - d.getDay());
      return `${sunday.getFullYear()}-${sunday.getMonth()}-${sunday.getDate()}`;
    }),
  );
  const today = new Date();
  const cursor = new Date(today);
  cursor.setDate(today.getDate() - today.getDay());
  let streak = 0;
  for (let i = 0; i < 104; i++) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (weekKeys.has(key)) {
      streak++;
    } else if (i > 0) {
      break; // semana atual pode estar vazia sem zerar o streak
    }
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function StatCard({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={Colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MilestoneBadge({ m }: { m: Milestone }) {
  const unlocked = m.current >= m.threshold;
  const pct = Math.min(m.current / m.threshold, 1);
  return (
    <View style={styles.badge}>
      <View style={[styles.badgeRing, unlocked ? styles.badgeRingOn : styles.badgeRingOff]}>
        <Ionicons
          name={unlocked ? m.icon : 'lock-closed'}
          size={26}
          color={unlocked ? Colors.primary : Colors.textMuted}
        />
      </View>
      <Text style={[styles.badgeLabel, !unlocked && { color: Colors.textMuted }]}>{m.label}</Text>
      {unlocked ? (
        <Text style={styles.badgeDone}>Desbloqueada</Text>
      ) : (
        <View style={styles.badgeBarTrack}>
          <View style={[styles.badgeBarFill, { width: `${pct * 100}%` }]} />
        </View>
      )}
    </View>
  );
}

export default function ConquistasScreen() {
  const session = useAuthStore((s) => s.session);
  const { get } = useApi();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['workouts', session?.athlete_id],
    queryFn: () =>
      get<{ workouts: Workout[] }>(`/workouts?athlete_id=${session?.athlete_id}&limit=200`),
    enabled: !!session?.athlete_id,
    staleTime: 1000 * 60 * 5,
  });

  if (!session) return null;
  if (isLoading) {
    return (
      <View style={styles.container}>
        <TopBar />
        <LoadingScreen message="Carregando conquistas..." />
      </View>
    );
  }

  const workouts = data?.workouts ?? [];
  const totalKm = workouts.reduce((s, w) => s + (w.distance_m ?? 0), 0) / 1000;
  const totalCount = workouts.length;
  const longestKm = workouts.reduce((mx, w) => Math.max(mx, (w.distance_m ?? 0) / 1000), 0);
  const streak = computeWeekStreak(workouts.map((w) => w.date));

  const milestones: Milestone[] = [
    { icon: 'flash', label: 'Primeiros 10 treinos', threshold: 10, current: totalCount, unit: '' },
    { icon: 'footsteps', label: '100 km acumulados', threshold: 100, current: totalKm, unit: 'km' },
    { icon: 'medal', label: '25 treinos registrados', threshold: 25, current: totalCount, unit: '' },
    { icon: 'trail-sign', label: 'Corrida de 10 km', threshold: 10, current: longestKm, unit: 'km' },
    { icon: 'ribbon', label: 'Distância de meia (21 km)', threshold: 21, current: longestKm, unit: 'km' },
    { icon: 'planet', label: '500 km acumulados', threshold: 500, current: totalKm, unit: 'km' },
  ];
  const unlockedCount = milestones.filter((m) => m.current >= m.threshold).length;

  return (
    <View style={styles.container}>
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
      >
        <Text style={styles.screenTitle}>Conquistas</Text>

        {isError ? (
          <ErrorCard message="Não conseguimos carregar suas conquistas." />
        ) : (
          <>
            {/* ── Streak hero ── */}
            <View style={styles.streakCard}>
              <View style={styles.streakGlow} />
              <View style={styles.streakIcon}>
                <Ionicons name="flame" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}>
                {streak === 1 ? 'semana seguida treinando' : 'semanas seguidas treinando'}
              </Text>
            </View>

            {/* ── Stats reais ── */}
            <View style={styles.statRow}>
              <StatCard icon="footsteps-outline" value={totalKm.toFixed(0)} label="km totais" />
              <StatCard icon="fitness-outline" value={String(totalCount)} label="treinos" />
              <StatCard icon="trending-up-outline" value={longestKm.toFixed(1)} label="maior corrida" />
            </View>

            {/* ── Marcos ── */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Marcos</Text>
              <Text style={styles.sectionCount}>{unlockedCount}/{milestones.length} desbloqueados</Text>
            </View>
            <View style={styles.badgeGrid}>
              {milestones.map((m) => (
                <MilestoneBadge key={m.label} m={m} />
              ))}
            </View>

            {totalCount === 0 ? (
              <Text style={styles.emptyNote}>
                Sincronize seus treinos do Garmin para começar a desbloquear marcos.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },
  screenTitle: { ...Type.headline, color: Colors.textPrimary },

  // Streak hero
  streakCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
    ...Shadow.glow,
  },
  streakGlow: {
    position: 'absolute',
    top: -60,
    width: 200,
    height: 200,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(195,244,0,0.10)',
  },
  streakIcon: {
    width: 84,
    height: 84,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 2,
    borderColor: 'rgba(195,244,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  streakNumber: {
    fontFamily: Fonts.displayBlack,
    fontSize: 72,
    lineHeight: 78,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  streakLabel: { ...Type.subtitle, fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },

  // Stats
  statRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: Fonts.data,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  statLabel: { ...Type.bodySm, fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  // Section header
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  sectionTitle: { ...Type.title, color: Colors.textPrimary },
  sectionCount: { fontFamily: Fonts.data, fontSize: FontSize.xs, color: Colors.textMuted },

  // Badge grid
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  badgeRing: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRingOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  badgeRingOff: { borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  badgeLabel: {
    ...Type.bodySm,
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  badgeDone: {
    fontFamily: Fonts.data,
    fontSize: 9,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: Tracking.wide,
  },
  badgeBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
  },
  badgeBarFill: { height: 4, borderRadius: Radii.full, backgroundColor: Colors.accent },

  emptyNote: { ...Type.bodySm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
});
