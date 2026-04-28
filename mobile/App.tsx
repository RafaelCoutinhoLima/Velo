import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import type { ZoneResult, TrainingPlan } from './src/lib/api';

import Login from './src/screens/Login';
import Activities from './src/screens/Activities';
import WeekPlan from './src/screens/WeekPlan';
import Feedback from './src/screens/Feedback';
import ThreeKmTest from './src/screens/ThreeKmTest';
import ZoneDisplay from './src/screens/ZoneDisplay';
import GoalForm from './src/screens/GoalForm';

// Onboarding: login → threeKmTest → zoneDisplay → goalForm
// Main app: tabs (activities | plan | feedback)
type AppScreen =
  | 'login'
  | 'threeKmTest'
  | 'zoneDisplay'
  | 'goalForm'
  | 'main';

type MainTab = 'activities' | 'plan' | 'feedback';

const RESTING_HR_DEFAULT = 55; // used until we add a proper onboarding input

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<AppScreen>('login');
  const [tab, setTab] = useState<MainTab>('activities');
  const [zones, setZones] = useState<ZoneResult | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  // activities fetched once to pass into ThreeKmTest
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) setScreen('threeKmTest');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setScreen('login');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function handleLogin() {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setScreen('threeKmTest');
    });
  }

  if (screen === 'login' || !session) {
    return (
      <>
        <StatusBar style="light" />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  if (screen === 'threeKmTest') {
    return (
      <>
        <StatusBar style="light" />
        <ThreeKmTest
          activities={activities}
          resting_hr={RESTING_HR_DEFAULT}
          onZonesCalculated={(z) => {
            setZones(z);
            setScreen('zoneDisplay');
          }}
          onBack={() => supabase.auth.signOut()}
        />
      </>
    );
  }

  if (screen === 'zoneDisplay' && zones) {
    return (
      <>
        <StatusBar style="light" />
        <ZoneDisplay
          zones={zones}
          onConfirm={() => setScreen('goalForm')}
          onBack={() => setScreen('threeKmTest')}
        />
      </>
    );
  }

  if (screen === 'goalForm') {
    return (
      <>
        <StatusBar style="light" />
        <GoalForm
          onPlanGenerated={(p) => {
            setPlan(p);
            setTab('plan');
            setScreen('main');
          }}
          onBack={() => setScreen('zoneDisplay')}
        />
      </>
    );
  }

  // Main app with bottom tabs
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.flex}>
        {tab === 'activities' && <Activities />}
        {tab === 'plan' && <WeekPlan plan={plan} loading={false} />}
        {tab === 'feedback' && (
          <Feedback workoutId="placeholder" onDone={() => setTab('activities')} />
        )}
      </View>

      <View style={styles.tabBar}>
        <TabButton label="Corridas" icon="🏃" active={tab === 'activities'} onPress={() => setTab('activities')} />
        <TabButton label="Plano" icon="📅" active={tab === 'plan'} onPress={() => setTab('plan')} />
        <TabButton label="Feedback" icon="💬" active={tab === 'feedback'} onPress={() => setTab('feedback')} />
        <TouchableOpacity style={styles.tab} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={styles.tabLabel}>Sair</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress}>
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#1f1f1f',
    backgroundColor: '#111',
    paddingBottom: 8,
    paddingTop: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { fontSize: 11, color: '#555' },
  tabActive: { color: '#00d4ff', fontWeight: '600' },
});
