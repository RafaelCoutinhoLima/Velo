import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Spacing, Type } from '../lib/theme';

// Barra de topo do app (design Stitch "Kinetic Precision"): avatar à
// esquerda, marca, sino de notificações à direita.
export function TopBar() {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.navigate('/(tabs)/settings')}
          accessibilityRole="button"
          accessibilityLabel="Abrir configurações"
        >
          <Ionicons name="person" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>FitSync AI</Text>
      </View>
      <TouchableOpacity
        style={styles.bell}
        accessibilityRole="button"
        accessibilityLabel="Notificações"
      >
        <Ionicons name="notifications-outline" size={22} color={Colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl + Spacing.xs,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Type.headline, color: Colors.textPrimary },
  bell: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
