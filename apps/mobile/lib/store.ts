import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chunkedSecureStorage } from './secureStorage';

interface AthleteProfile {
  id: string;
  userId: string;
  calibrationMode: boolean;
  goalMode: 'race' | 'general_progression';
  advancedMode: boolean;
  garminConnected?: boolean;
  lastGarminSync?: string;
}

interface AuthState {
  session: { access_token: string; athlete_id: string } | null;
  profile: AthleteProfile | null;
  onboardingComplete: boolean;
  setSession: (session: AuthState['session']) => void;
  setProfile: (profile: AthleteProfile) => void;
  setGarminConnected: (connected: boolean) => void;
  setLastGarminSync: (ts: string) => void;
  setOnboardingComplete: () => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      profile: null,
      onboardingComplete: false,
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setGarminConnected: (connected) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, garminConnected: connected } : s.profile })),
      setLastGarminSync: (ts) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, lastGarminSync: ts } : s.profile })),
      setOnboardingComplete: () => set({ onboardingComplete: true }),
      clearSession: () => set({ session: null, profile: null, onboardingComplete: false }),
    }),
    {
      name: 'fitsync-auth',
      storage: createJSONStorage(() => chunkedSecureStorage),
    },
  ),
);

interface UIState {
  toastMessage: string | null;
  showPlanDiff: boolean;
  setToast: (message: string | null) => void;
  setShowPlanDiff: (show: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  toastMessage: null,
  showPlanDiff: false,
  setToast: (message) => set({ toastMessage: message }),
  setShowPlanDiff: (show) => set({ showPlanDiff: show }),
}));
