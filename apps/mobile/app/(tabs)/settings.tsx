import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ErrorCard } from '../../components/ErrorCard';

export default function SettingsScreen() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const advancedMode = useAuthStore((s) => s.advancedMode);
  const setAdvancedMode = useAuthStore((s) => s.setAdvancedMode);
  const garminConnected = useAuthStore((s) => s.garminConnected);
  const lastSync = useAuthStore((s) => s.lastGarminSync);
  const setGarminConnected = useAuthStore((s) => s.setGarminConnected);
  const setLastGarminSync = useAuthStore((s) => s.setLastGarminSync);
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const qc = useQueryClient();

  const [showGarminModal, setShowGarminModal] = useState(false);
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminMfa, setGarminMfa] = useState('');
  const [connectStep, setConnectStep] = useState<'idle' | 'connecting' | 'syncing'>('idle');
  const [syncCount, setSyncCount] = useState<number | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  function toggleAdvancedMode(value: boolean) {
    setAdvancedMode(value);
  }

  async function handleGarminConnect() {
    if (!session) return;
    if (!garminEmail.trim() || !garminPassword.trim()) {
      setConnectError('Preencha e-mail e senha do Garmin.');
      return;
    }
    setConnectError(null);
    setConnectStep('connecting');

    try {
      await post('/garmin/connect', {
        athlete_id: session.athlete_id,
        email: garminEmail.trim(),
        password: garminPassword,
        ...(garminMfa.trim() ? { mfa_code: garminMfa.trim() } : {}),
      });

      // Limpa credenciais da memória imediatamente
      setGarminPassword('');
      setGarminMfa('');

      setConnectStep('syncing');

      const syncBody = await post<{ synced: number }>('/garmin/sync', {
        athlete_id: session.athlete_id,
        days: 90,
      });

      setGarminConnected(true);
      setLastGarminSync(new Date().toISOString());
      setSyncCount(syncBody.synced);
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['workouts'] });
      setShowGarminModal(false);
      setConnectStep('idle');
    } catch (err: unknown) {
      setConnectStep('idle');
      setConnectError(err instanceof Error ? err.message : 'Não conseguimos conectar ao Garmin.');
    }
  }

  async function handleGarminSync() {
    if (!session) return;
    setConnectStep('syncing');
    try {
      const body = await post<{ synced: number }>('/garmin/sync', {
        athlete_id: session.athlete_id,
        days: 30,
      });
      setSyncCount(body.synced);
      setLastGarminSync(new Date().toISOString());
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['workouts'] });
    } catch { /* erro silencioso — usuário vê count não atualizado */ } finally {
      setConnectStep('idle');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  }

  const isBusy = connectStep !== 'idle';

  function formatSync(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Configurações</Text>

        {/* ── GARMIN ── */}
        <Text style={styles.sectionLabel}>Garmin Connect</Text>

        {garminConnected ? (
          <View style={[styles.card, Shadow.card]}>
            <View style={styles.connectedRow}>
              <View style={styles.statusDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.connectedTitle}>Conta conectada</Text>
                {lastSync ? (
                  <Text style={styles.syncTimestamp}>Última sync: {formatSync(lastSync)}</Text>
                ) : null}
              </View>
              {syncCount !== null && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{syncCount} treinos</Text>
                </View>
              )}
            </View>
            <Button
              label={connectStep === 'syncing' ? 'Sincronizando...' : 'Sincronizar agora (30 dias)'}
              onPress={handleGarminSync}
              variant="secondary"
              loading={connectStep === 'syncing'}
              disabled={isBusy}
              style={{ marginTop: Spacing.md }}
              accessibilityLabel="Sincronizar treinos do Garmin dos últimos 30 dias"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.card, styles.cardRow, Shadow.card]}
            onPress={() => { setConnectStep('idle'); setConnectError(null); setShowGarminModal(true); }}
            accessibilityRole="button"
            accessibilityLabel="Conectar conta Garmin"
          >
            <View style={styles.disconnectedDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.connectTitle}>Conectar Garmin</Text>
              <Text style={styles.connectDesc}>Importe seu histórico e personalize seu plano</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── PREFERÊNCIAS ── */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Preferências</Text>

        <View style={[styles.card, styles.cardRow, Shadow.card]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Modo Avançado</Text>
            <Text style={styles.settingDesc}>Exibe métricas técnicas (ACWR, CTL, TSB)</Text>
          </View>
          <Switch
            value={advancedMode}
            onValueChange={toggleAdvancedMode}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.surface}
            accessibilityRole="switch"
            accessibilityLabel="Modo avançado de métricas"
            accessibilityState={{ checked: advancedMode }}
          />
        </View>

        {/* ── CONTA ── */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Conta</Text>

        <TouchableOpacity
          style={[styles.card, Shadow.card]}
          onPress={() => setShowLogoutModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Text style={styles.dangerText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── MODAL GARMIN ── */}
      <Modal
        visible={showGarminModal}
        animationType="slide"
        transparent
        onRequestClose={() => !isBusy && setShowGarminModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => !isBusy && setShowGarminModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.modalBox}>
            {connectStep === 'idle' ? (
              <>
                <Text style={styles.modalTitle}>Conectar Garmin</Text>
                <Text style={styles.modalSub}>
                  Use o e-mail e senha da sua conta Garmin Connect.
                </Text>

                {connectError ? (
                  <View style={{ marginBottom: Spacing.md }}>
                    <ErrorCard message={connectError} />
                  </View>
                ) : null}

                <Input
                  label="E-mail Garmin"
                  placeholder="seu@email.com"
                  value={garminEmail}
                  onChangeText={setGarminEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <Input
                  label="Senha"
                  placeholder="••••••••"
                  value={garminPassword}
                  onChangeText={setGarminPassword}
                  secureTextEntry
                />
                <Input
                  label="Código MFA (opcional)"
                  placeholder="123456"
                  value={garminMfa}
                  onChangeText={setGarminMfa}
                  keyboardType="number-pad"
                />

                <View style={styles.modalActions}>
                  <Button
                    label="Cancelar"
                    variant="secondary"
                    onPress={() => setShowGarminModal(false)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Conectar"
                    onPress={handleGarminConnect}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : (
              <LoadingScreen
                message={connectStep === 'connecting' ? 'Autenticando no Garmin...' : 'Importando seus treinos...'}
                subMessage={connectStep === 'syncing' ? 'Isso pode levar alguns segundos.' : undefined}
              />
            )}
          </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmModal
        visible={showLogoutModal}
        title="Sair da conta"
        message="Tem certeza que deseja sair? Seus dados permanecem salvos."
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        onConfirm={logout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingTop: Spacing.xxl + Spacing.md, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: Radii.full, backgroundColor: Colors.success },
  disconnectedDot: { width: 10, height: 10, borderRadius: Radii.full, backgroundColor: Colors.textMuted, marginRight: Spacing.sm },
  connectedTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  syncTimestamp: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  syncBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  syncBadgeText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  connectTitle: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  connectDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted },
  settingTitle: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  settingDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  dangerText: { fontSize: FontSize.md, color: Colors.danger, fontWeight: FontWeight.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + Spacing.md,
    minHeight: 300,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  modalSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
