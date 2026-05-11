import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

interface AthleteProfile {
  id: string;
  userId: string;
  calibrationMode: boolean;
  goalMode: 'race' | 'general_progression';
  advancedMode: boolean;
}

interface AuthState {
  session: { access_token: string; athlete_id: string } | null;
  profile: AthleteProfile | null;
  setSession: (session: AuthState['session']) => void;
  setProfile: (profile: AthleteProfile) => void;
  clearSession: () => void;
}

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      profile: null,
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      clearSession: () => set({ session: null, profile: null }),
    }),
    {
      name: 'fitsync-auth',
      storage: createJSONStorage(() => secureStorage),
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
