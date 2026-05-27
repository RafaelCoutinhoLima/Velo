import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorCard } from '../../components/ErrorCard';
import { TopBar } from '../../components/TopBar';
import { MonthSummary } from '../../components/history/MonthSummary';
import { MonthCalendar } from '../../components/history/MonthCalendar';
import { WorkoutCard } from '../../components/history/WorkoutCard';
import { ViewToggle, type HistoryView } from '../../components/history/ViewToggle';
import type { Workout } from '../../components/history/types';

export default function HistoryScreen() {
  const session = useAuthStore((s) => s.session);
  const { get } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [view, setView] = useState<HistoryView>('list');
  // Offset de mês pro calendário (0 = mês atual, -1 = anterior).
  const [monthOffset, setMonthOffset] = useState(0);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['workouts', session?.athlete_id],
    queryFn: () =>
      get<{ workouts: Workout[] }>(`/workouts?athlete_id=${session?.athlete_id}&limit=90`),
    enabled: !!session?.athlete_id,
    staleTime: 1000 * 60 * 5,
  });

  if (!session) return null;
  if (isLoading) {
    return (
      <View style={styles.container}>
        <TopBar />
        <LoadingScreen message="Carregando histórico..." />
      </View>
    );
  }

  const workouts = data?.workouts ?? [];

  const Header = (
    <View>
      <Text style={styles.screenTitle}>Histórico</Text>
      <ViewToggle view={view} onChange={setView} />
      {workouts.length > 0 ? (
        view === 'calendar' ? (
          <MonthCalendar
            workouts={workouts}
            monthOffset={monthOffset}
            onChangeMonth={setMonthOffset}
          />
        ) : (
          <>
            <MonthSummary workouts={workouts} />
            <Text style={styles.listLabel}>Treinos</Text>
          </>
        )
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <TopBar />
      {isError ? (
        <View style={styles.errorWrap}>
          <ErrorCard message="Não conseguimos carregar seu histórico. Puxe para atualizar." />
        </View>
      ) : workouts.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <View>
              <Text style={styles.screenTitle}>Histórico</Text>
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="footsteps-outline" size={36} color={theme.colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Nenhum treino ainda</Text>
                <Text style={styles.emptyText}>
                  Conecte seu Garmin nas configurações e sincronize para importar seu histórico.
                </Text>
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
        />
      ) : (
        <FlatList
          data={view === 'list' ? workouts : []}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => <WorkoutCard workout={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={Header}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    screenTitle: { ...theme.type.headline, color: theme.colors.textPrimary, marginBottom: Spacing.md },
    errorWrap: { padding: Spacing.md },
    listLabel: { ...theme.type.label, color: theme.colors.textMuted, marginBottom: Spacing.sm },
    sep: { height: Spacing.sm },

    empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.sm },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    emptyTitle: { ...theme.type.title, color: theme.colors.textPrimary },
    emptyText: {
      ...theme.type.bodySm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: Spacing.lg,
    },
  });
