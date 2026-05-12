import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function SettingsScreen() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setGarminConnected = useAuthStore((s) => s.setGarminConnected);
  const session = useAuthStore((s) => s.session);
  const qc = useQueryClient();

  const advancedMode = profile?.advancedMode ?? false;
  const garminConnected = profile?.garminConnected ?? false;

  const [showGarminModal, setShowGarminModal] = useState(false);
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminMfa, setGarminMfa] = useState('');
  const [connectStep, setConnectStep] = useState<'idle' | 'connecting' | 'syncing'>('idle');
  const [syncCount, setSyncCount] = useState<number | null>(null);

  function toggleAdvancedMode(value: boolean) {
    if (!profile) return;
    setProfile({ ...profile, advancedMode: value });
  }

  async function handleGarminConnect() {
    if (!session) return;
    if (!garminEmail.trim() || !garminPassword.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha e-mail e senha do Garmin.');
      return;
    }

    setConnectStep('connecting');
    try {
      const connectRes = await fetch(`${API_URL}/garmin/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_id: session.athlete_id,
          email: garminEmail.trim(),
          password: garminPassword,
          ...(garminMfa.trim() ? { mfa_code: garminMfa.trim() } : {}),
        }),
      });

      if (!connectRes.ok) {
        const text = await connectRes.text().catch(() => '');
        let body: { error?: string } = {};
        try { body = JSON.parse(text); } catch { /* non-JSON */ }
        throw new Error(body.error ?? `Falha ao conectar com o Garmin (HTTP ${connectRes.status})`);
      }

      setConnectStep('syncing');

      const syncRes = await fetch(`${API_URL}/garmin/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: session.athlete_id, days: 90 }),
      });

      const syncBody = (await syncRes.json().catch(() => ({}))) as { synced?: number; error?: string };

      if (!syncRes.ok) {
        throw new Error(syncBody.error ?? 'Falha ao sincronizar treinos');
      }

      setGarminConnected(true);
      setSyncCount(syncBody.synced ?? 0);
      qc.invalidateQueries({ queryKey: ['plan'] });
      setShowGarminModal(false);
      setConnectStep('idle');

      Alert.alert(
        'Garmin conectado!',
        syncBody.synced && syncBody.synced > 0
          ? `${syncBody.synced} treino${syncBody.synced > 1 ? 's' : ''} importado${syncBody.synced > 1 ? 's' : ''}. Seu plano agora será personalizado com base no seu histórico.`
          : 'Conta conectada. Nenhum treino de corrida encontrado nos últimos 90 dias.',
      );
    } catch (err) {
      setConnectStep('idle');
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não conseguimos conectar ao Garmin.');
    }
  }

  async function handleGarminSync() {
    if (!session) return;
    setConnectStep('syncing');
    try {
      const res = await fetch(`${API_URL}/garmin/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: session.athlete_id, days: 30 }),
      });
      const body = (await res.json().catch(() => ({}))) as { synced?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Falha ao sincronizar');
      setSyncCount(body.synced ?? 0);
      qc.invalidateQueries({ queryKey: ['plan'] });
      Alert.alert('Sincronização concluída', `${body.synced ?? 0} treino(s) atualizado(s).`);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao sincronizar.');
    } finally {
      setConnectStep('idle');
    }
  }

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

  const isBusy = connectStep !== 'idle';

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Configurações</Text>

        <Text style={styles.sectionLabel}>Garmin</Text>

        {garminConnected ? (
          <>
            <View style={[styles.item, styles.itemRow]}>
              <View style={styles.itemContent}>
                <Text style={styles.itemText}>Garmin Connect</Text>
                <Text style={styles.itemSubtextGreen}>Conta conectada</Text>
              </View>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>✓</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.item, isBusy && styles.itemDisabled]}
              onPress={handleGarminSync}
              disabled={isBusy}
            >
              {connectStep === 'syncing' ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={styles.itemTextBlue}>Sincronizar agora (últimos 30 dias)</Text>
              )}
            </TouchableOpacity>
            {syncCount !== null ? (
              <Text style={styles.syncHint}>{syncCount} treino(s) na última sincronização</Text>
            ) : null}
          </>
        ) : (
          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              setConnectStep('idle');
              setShowGarminModal(true);
            }}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemText}>Conectar Garmin</Text>
              <Text style={styles.itemSubtext}>
                Importe seu histórico e personalize seu plano
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Preferências</Text>

        <View style={styles.item}>
          <View style={styles.itemContent}>
            <Text style={styles.itemText}>Modo Avançado</Text>
            <Text style={styles.itemSubtext}>Exibe métricas técnicas (ACWR, CTL, TSB)</Text>
          </View>
          <Switch
            value={advancedMode}
            onValueChange={toggleAdvancedMode}
            trackColor={{ false: '#d1d5db', true: '#2563eb' }}
            thumbColor="#fff"
          />
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Conta</Text>

        <TouchableOpacity style={styles.item} onPress={confirmLogout}>
          <Text style={styles.itemTextDanger}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showGarminModal}
        animationType="slide"
        transparent
        onRequestClose={() => !isBusy && setShowGarminModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Conectar Garmin</Text>
            <Text style={styles.modalSubtitle}>
              Use o e-mail e senha da sua conta Garmin Connect.
            </Text>

            {connectStep === 'idle' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="E-mail Garmin"
                  placeholderTextColor="#9ca3af"
                  value={garminEmail}
                  onChangeText={setGarminEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Senha"
                  placeholderTextColor="#9ca3af"
                  value={garminPassword}
                  onChangeText={setGarminPassword}
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  placeholder="Código MFA (opcional)"
                  placeholderTextColor="#9ca3af"
                  value={garminMfa}
                  onChangeText={setGarminMfa}
                  keyboardType="number-pad"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.btnCancel}
                    onPress={() => setShowGarminModal(false)}
                  >
                    <Text style={styles.btnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnConfirm} onPress={handleGarminConnect}>
                    <Text style={styles.btnConfirmText}>Conectar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>
                  {connectStep === 'connecting'
                    ? 'Autenticando no Garmin...'
                    : 'Importando seus treinos...'}
                </Text>
                <Text style={styles.loadingSubtext}>
                  {connectStep === 'syncing' ? 'Isso pode levar alguns segundos.' : ''}
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 24, marginTop: 48 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  itemRow: { flexDirection: 'row' },
  itemDisabled: { opacity: 0.5 },
  itemContent: { flex: 1 },
  itemText: { fontSize: 16, color: '#111', fontWeight: '500' },
  itemSubtext: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemSubtextGreen: { fontSize: 12, color: '#16a34a', marginTop: 2 },
  itemTextBlue: { fontSize: 16, color: '#2563eb', fontWeight: '500' },
  itemTextDanger: { fontSize: 16, color: '#ef4444' },
  chevron: { fontSize: 22, color: '#9ca3af', fontWeight: '300' },
  connectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedBadgeText: { color: '#16a34a', fontSize: 14, fontWeight: '700' },
  syncHint: { fontSize: 11, color: '#9ca3af', marginBottom: 4, marginLeft: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#111',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  btnConfirm: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  loadingBox: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#111', fontWeight: '500' },
  loadingSubtext: { marginTop: 6, fontSize: 13, color: '#6b7280' },
});
