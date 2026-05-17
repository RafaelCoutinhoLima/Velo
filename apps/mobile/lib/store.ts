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
  // Preferência só de UI (não existe coluna no banco) — vive fora do
  // `profile`, que pode ser null enquanto não há hidratação do backend.
  advancedMode: boolean;
  // Último calibration_mode visto do servidor — usado para disparar o aviso
  // "calibração concluída" uma única vez, sem depender de `profile`.
  lastSeenCalibrationMode: boolean | null;
  setSession: (session: AuthState['session']) => void;
  setProfile: (profile: AthleteProfile) => void;
  setGarminConnected: (connected: boolean) => void;
  setLastGarminSync: (ts: string) => void;
  setOnboardingComplete: () => void;
  setAdvancedMode: (value: boolean) => void;
  setLastSeenCalibrationMode: (value: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      profile: null,
      onboardingComplete: false,
      advancedMode: false,
      lastSeenCalibrationMode: null,
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setGarminConnected: (connected) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, garminConnected: connected } : s.profile })),
      setLastGarminSync: (ts) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, lastGarminSync: ts } : s.profile })),
      setOnboardingComplete: () => set({ onboardingComplete: true }),
      setAdvancedMode: (value) => set({ advancedMode: value }),
      setLastSeenCalibrationMode: (value) => set({ lastSeenCalibrationMode: value }),
      clearSession: () =>
        set({
          session: null,
          profile: null,
          onboardingComplete: false,
          lastSeenCalibrationMode: null,
        }),
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
