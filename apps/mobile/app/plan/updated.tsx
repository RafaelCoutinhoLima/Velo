import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Spacing, Type } from '../../lib/theme';
import { Button } from '../../components/Button';

// "Plano Atualizado" — confirmação exibida após a regeneração do plano
// concluir com sucesso (vindo de /plan/new).
export default function PlanUpdatedScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={styles.glow} />
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={52} color={Colors.onAccent} />
        </View>
        <Text style={styles.title}>Plano atualizado!</Text>
        <Text style={styles.text}>
          Sua semana de treinos foi recriada pela IA com base nos seus dados mais recentes.
          Confira o que mudou e bons treinos.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label="Ver meu plano"
          onPress={() => router.replace('/(tabs)/plan')}
          icon={<Ionicons name="arrow-forward" size={18} color={Colors.onAccent} />}
          accessibilityLabel="Ver meu plano atualizado"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(195,244,0,0.08)',
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { ...Type.display, color: Colors.textPrimary, textAlign: 'center' },
  text: { ...Type.body, color: Colors.textSecondary, textAlign: 'center' },
  footer: { padding: Spacing.lg },
});
