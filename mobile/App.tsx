import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import type { ZoneResult, TrainingPlan } from './src/lib/api';
import { fetchCurrentPlan, fetchActivities } from './src/lib/api';

import Login from './src/screens/Login';
import Activities from './src/screens/Activities';
import WeekPlan from './src/screens/WeekPlan';
import Settings from './src/screens/Settings';
import CooperTest from './src/screens/CooperTest';
import ZoneDisplay from './src/screens/ZoneDisplay';
import GoalForm from './src/screens/GoalForm';
import ProfileForm from './src/screens/ProfileForm';

// Onboarding: login → profileForm → cooperTest → zoneDisplay → goalForm (only first time)
// Main app: tabs (activities | plan | feedback | settings)
type AppScreen =
  | 'login'
  | 'profileForm'
  | 'cooperTest'
  | 'zoneDisplay'
  | 'goalForm'
  | 'main';

type MainTab = 'activities' | 'plan' | 'feedback' | 'settings';

const RESTING_HR_DEFAULT = 55;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<AppScreen>('login');
  const [tab, setTab] = useState<MainTab>('activities');
  const [zones, setZones] = useState<ZoneResult | null>(null);
  const [zonesCalibrated, setZonesCalibrated] = useState(false);
  const [cooperFcMax, setCooperFcMax] = useState(0);
  const [cooperFcRest, setCooperFcRest] = useState(RESTING_HR_DEFAULT);
  const [cooperActivities, setCooperActivities] = useState<any[]>([]);
  const [cooperOrigin, setCooperOrigin] = useState<'onboarding' | 'main'>('onboarding');
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [garminConnected, setGarminConnected] = useState(false);
  const [goalFormOrigin, setGoalFormOrigin] = useState<'onboarding' | 'main'>('onboarding');

  async function resolveScreenForUser(userId: string) {
    const done = await AsyncStorage.getItem(`fitsync_onboarding_done_${userId}`);
    const profileDone = await AsyncStorage.getItem(`fitsync_profile_done_${userId}`);
    const garmin = await AsyncStorage.getItem(`fitsync_garmin_connected_${userId}`);
    const cooper = await AsyncStorage.getItem(`fitsync_cooper_done_${userId}`);
    if (garmin) setGarminConnected(true);
    if (cooper) setZonesCalibrated(true);
    if (done) {
      setScreen('main');
      setPlanLoading(true);
      fetchCurrentPlan().then(setPlan).finally(() => setPlanLoading(false));
    } else if (profileDone) {
      setScreen('cooperTest');
    } else {
      setScreen('profileForm');
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) resolveScreenForUser(data.session.user.id);
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
      if (data.session) resolveScreenForUser(data.session.user.id);
    });
  }

  if (screen === 'login' || !session) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Login onLogin={handleLogin} />
      </SafeAreaProvider>
    );
  }

  if (screen === 'profileForm') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ProfileForm
          onContinue={() => {
            if (session) AsyncStorage.setItem(`fitsync_profile_done_${session.user.id}`, '1');
            setScreen('cooperTest');
          }}
        />
      </SafeAreaProvider>
    );
  }

  if (screen === 'cooperTest') {
    // Load activities if coming from onboarding (may have synced Garmin via onSkip path)
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <CooperTest
          activities={cooperActivities}
          resting_hr={cooperFcRest || RESTING_HR_DEFAULT}
          onZonesCalculated={(z, _id, fcMax, fcRest) => {
            setZones(z);
            setCooperFcMax(fcMax);
            setCooperFcRest(fcRest);
            setScreen('zoneDisplay');
          }}
          onBack={() => cooperOrigin === 'main' ? setScreen('main') : supabase.auth.signOut()}
          onSkip={() => setScreen('main')}
        />
      </SafeAreaProvider>
    );
  }

  if (screen === 'zoneDisplay' && zones) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ZoneDisplay
          zones={zones}
          fcMax={cooperFcMax || undefined}
          fcRest={cooperFcRest || undefined}
          settingsMode={cooperOrigin === 'main'}
          onConfirm={() => {
            if (cooperOrigin === 'main') {
              if (session) AsyncStorage.setItem(`fitsync_cooper_done_${session.user.id}`, '1');
              setZonesCalibrated(true);
              setScreen('main');
            } else {
              setScreen('goalForm');
            }
          }}
          onBack={() => setScreen('cooperTest')}
        />
      </SafeAreaProvider>
    );
  }

  if (screen === 'goalForm') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <GoalForm
          onPlanGenerated={(p) => {
            AsyncStorage.setItem(`fitsync_onboarding_done_${session.user.id}`, '1');
            AsyncStorage.setItem(`fitsync_cooper_done_${session.user.id}`, '1');
            setZonesCalibrated(true);
            setPlan(p);
            setTab('plan');
            setScreen('main');
          }}
          onBack={() => {
            if (goalFormOrigin === 'main') {
              setScreen('main');
            } else {
              setScreen('zoneDisplay');
            }
          }}
        />
      </SafeAreaProvider>
    );
  }

  // Main app with bottom tabs
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />

        <View style={styles.flex}>
          {tab === 'activities' && <Activities />}
          {tab === 'plan' && (
            <WeekPlan
              plan={plan}
              loading={planLoading}
              onGeneratePlan={() => {
                setGoalFormOrigin('main');
                setScreen('goalForm');
              }}
            />
          )}
          {tab === 'feedback' && (
            <View style={styles.emptyFeedback}>
              <Text style={styles.emptyFeedbackText}>Nenhum treino recente para avaliar.</Text>
              <Text style={styles.emptyFeedbackHint}>
                O feedback estará disponível após sincronizar um treino do Garmin.
              </Text>
            </View>
          )}
          {tab === 'settings' && (
            <Settings
              garminConnected={garminConnected}
              zonesCalibrated={zonesCalibrated}
              onGarminConnected={() => {
                AsyncStorage.setItem(`fitsync_garmin_connected_${session.user.id}`, '1');
                setGarminConnected(true);
              }}
              onSignOut={() => supabase.auth.signOut()}
              onRequestNewPlan={() => {
                setGoalFormOrigin('main');
                setScreen('goalForm');
              }}
              onRequestCooperTest={async () => {
                setCooperOrigin('main');
                try {
                  const acts = await fetchActivities();
                  setCooperActivities(acts);
                } catch {
                  setCooperActivities([]);
                }
                setScreen('cooperTest');
              }}
            />
          )}
        </View>

        <View style={styles.tabBar}>
          <TabButton label="Corridas" icon="🏃" active={tab === 'activities'} onPress={() => setTab('activities')} />
          <TabButton label="Plano" icon="📅" active={tab === 'plan'} onPress={() => setTab('plan')} />
          <TabButton label="Feedback" icon="💬" active={tab === 'feedback'} onPress={() => setTab('feedback')} />
          <TabButton label="Config" icon="⚙️" active={tab === 'settings'} onPress={() => setTab('settings')} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TabButton({
  label, icon, active, onPress,
}: {
  label: string; icon: string; active: boolean; onPress: () => void;
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
  emptyFeedback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#f9fafb' },
  emptyFeedbackText: { fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptyFeedbackHint: { color: '#6b7280', textAlign: 'center', lineHeight: 20 },
});
