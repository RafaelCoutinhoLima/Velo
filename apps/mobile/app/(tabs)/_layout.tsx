import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, useTheme } from '../../lib/theme';

// Bottom bar: 4 abas (Hoje · Histórico · Conquistas · Ajustes), ícone linear
// + rótulo 10px, accent na aba ativa — anatomia da tab bar do handoff.
type IoniconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IoniconName; off: IoniconName }> = {
  plan: { on: 'today', off: 'today-outline' },
  history: { on: 'time', off: 'time-outline' },
  conquistas: { on: 'trophy', off: 'trophy-outline' },
  settings: { on: 'settings', off: 'settings-outline' },
};

function tabIcon(name: string) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => {
    const icon = ICONS[name];
    return <Ionicons name={focused ? icon.on : icon.off} size={size ?? 22} color={color} />;
  };
}

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        sceneStyle: { backgroundColor: theme.colors.bg },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.divider,
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.bodySemiBold,
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen name="plan" options={{ title: 'Hoje', tabBarIcon: tabIcon('plan') }} />
      <Tabs.Screen name="history" options={{ title: 'Histórico', tabBarIcon: tabIcon('history') }} />
      <Tabs.Screen
        name="conquistas"
        options={{ title: 'Conquistas', tabBarIcon: tabIcon('conquistas') }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}
