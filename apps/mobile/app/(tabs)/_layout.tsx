import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSize, Tracking } from '../../lib/theme';

// Bottom bar do Stitch "Kinetic Precision": 4 abas, ícone linear + label
// uppercase, accent lima na aba ativa.
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        sceneStyle: { backgroundColor: Colors.bg },
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.bodyBold,
          fontSize: FontSize.xs,
          letterSpacing: Tracking.wide,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen name="plan" options={{ title: 'Plano', tabBarIcon: tabIcon('plan') }} />
      <Tabs.Screen name="history" options={{ title: 'Histórico', tabBarIcon: tabIcon('history') }} />
      <Tabs.Screen
        name="conquistas"
        options={{ title: 'Conquistas', tabBarIcon: tabIcon('conquistas') }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Config', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}
