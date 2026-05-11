import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

export default function SettingsScreen() {
  const clearSession = useAuthStore((s) => s.clearSession);

  async function logout() {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  }

  function confirmLogout() {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configurações</Text>

      <TouchableOpacity style={styles.item} onPress={confirmLogout}>
        <Text style={styles.itemText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 24, marginTop: 48 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  itemText: { fontSize: 16, color: '#ef4444' },
});
