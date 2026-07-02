import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chunkedSecureStorage } from './secureStorage';
import type { ThemeName } from './themes/types';
import type { AccentName } from './themes/accents';

interface AthleteProfile {
  id: string;
  userId: string;
  calibrationMode: boolean;
  goalMode: 'race' | 'general_progression';
  advancedMode: boolean;
}

interface AuthState {
  _hasHydrated: boolean;
  session: { access_token: string; athlete_id: string } | null;
  profile: AthleteProfile | null;
  onboardingComplete: boolean;
  // Preferência só de UI (não existe coluna no banco) — vive fora do
  // `profile`, que pode ser null enquanto não há hidratação do backend.
  advancedMode: boolean;
  // Último calibration_mode visto do servidor — usado para disparar o aviso
  // "calibração concluída" uma única vez, sem depender de `profile`.
  lastSeenCalibrationMode: boolean | null;
  // Status Garmin — setado após connect/sync com sucesso. Fora do `profile`
  // (sempre-null sem hidratação), senão o badge nunca atualiza.
  garminConnected: boolean;
  lastGarminSync: string | null;
  setSession: (session: AuthState['session']) => void;
  setProfile: (profile: AthleteProfile) => void;
  setGarminConnected: (connected: boolean) => void;
  setLastGarminSync: (ts: string) => void;
  setHasHydrated: (v: boolean) => void;
  setOnboardingComplete: () => void;
  setAdvancedMode: (value: boolean) => void;
  setLastSeenCalibrationMode: (value: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      session: null,
      profile: null,
      onboardingComplete: false,
      advancedMode: false,
      lastSeenCalibrationMode: null,
      garminConnected: false,
      lastGarminSync: null,
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setGarminConnected: (connected) => set({ garminConnected: connected }),
      setLastGarminSync: (ts) => set({ lastGarminSync: ts }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setOnboardingComplete: () => set({ onboardingComplete: true }),
      setAdvancedMode: (value) => set({ advancedMode: value }),
      setLastSeenCalibrationMode: (value) => set({ lastSeenCalibrationMode: value }),
      clearSession: () =>
        set({
          session: null,
          profile: null,
          onboardingComplete: false,
          lastSeenCalibrationMode: null,
          garminConnected: false,
          lastGarminSync: null,
        }),
    }),
    {
      name: 'fitsync-auth',
      storage: createJSONStorage(() => chunkedSecureStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
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

// Preferências persistidas que não pertencem ao auth state (tema visual,
// futuras prefs de UX). Persistidas via mesmo secure storage do auth — a
// chave é distinta (`fitsync-prefs`), então não colide com sessão.
interface PrefsState {
  themeName: ThemeName;
  accentName: AccentName;
  setThemeName: (name: ThemeName) => void;
  setAccentName: (name: AccentName) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      themeName: 'veloLight',
      accentName: 'azul',
      setThemeName: (name) => set({ themeName: name }),
      setAccentName: (name) => set({ accentName: name }),
    }),
    {
      name: 'fitsync-prefs',
      storage: createJSONStorage(() => chunkedSecureStorage),
    },
  ),
);
