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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, Fonts, FontSize, Radii, Spacing, Tracking, Type } from '../../lib/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ErrorCard } from '../../components/ErrorCard';
import { TopBar } from '../../components/TopBar';

// ── Linha de configuração genérica (ícone + título + subtítulo + ação) ─
function SettingRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  right,
  onPress,
  divider,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  divider?: boolean;
  danger?: boolean;
}) {
  const body = (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg ?? Colors.surfaceAlt }]}>
        <Ionicons name={icon} size={20} color={iconColor ?? (danger ? Colors.danger : Colors.textPrimary)} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: Colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={title}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

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
    <View style={styles.screen}>
      <TopBar />

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Configurações</Text>

        {/* ── Perfil ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileGlow} />
          <View style={styles.profileTop}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={32} color={Colors.textSecondary} />
            </View>
            <View>
              <Text style={styles.profileName}>Atleta FitSync</Text>
              <Text style={styles.profileMeta}>Perfil esportivo</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.goalRow}
            onPress={() => router.push('/onboarding/goal' as never)}
            accessibilityRole="button"
            accessibilityLabel="Editar prova alvo"
          >
            <View style={styles.goalLeft}>
              <Ionicons name="flag" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.goalLabel}>Prova Alvo</Text>
                <Text style={styles.goalValue}>Toque para definir</Text>
              </View>
            </View>
            <Text style={styles.linkText}>Editar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Preferências ── */}
        <SectionLabel>Preferências</SectionLabel>
        <View style={styles.groupCard}>
          <SettingRow
            icon="sparkles"
            iconColor={Colors.primary}
            title="Modo Avançado"
            subtitle="Métricas técnicas visíveis (ACWR, CTL, TSB)"
            right={
              <Switch
                value={advancedMode}
                onValueChange={toggleAdvancedMode}
                trackColor={{ false: Colors.surfaceAlt, true: Colors.primary }}
                thumbColor={Colors.bg}
                ios_backgroundColor={Colors.surfaceAlt}
                accessibilityRole="switch"
                accessibilityLabel="Modo avançado de métricas"
                accessibilityState={{ checked: advancedMode }}
              />
            }
          />
        </View>

        {/* ── Conexões ── */}
        <SectionLabel>Conexões</SectionLabel>
        <View style={styles.groupCard}>
          {garminConnected ? (
            <SettingRow
              icon="watch"
              iconColor="#3BA9E0"
              iconBg="rgba(0,124,195,0.18)"
              title="Conexão Garmin"
              subtitle={lastSync ? `Última sync: ${formatSync(lastSync)}` : undefined}
              right={
                <View style={styles.connRight}>
                  <View style={styles.statusChip}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Conectado</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleGarminSync}
                    disabled={isBusy}
                    style={styles.syncBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Sincronizar treinos do Garmin"
                  >
                    <Ionicons
                      name="sync"
                      size={20}
                      color={isBusy ? Colors.textMuted : Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              }
            />
          ) : (
            <SettingRow
              icon="watch"
              iconColor="#3BA9E0"
              iconBg="rgba(0,124,195,0.18)"
              title="Conectar Garmin"
              subtitle="Importe seu histórico e personalize seu plano"
              onPress={() => { setConnectStep('idle'); setConnectError(null); setShowGarminModal(true); }}
              right={<Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />}
            />
          )}
        </View>
        {garminConnected && syncCount !== null ? (
          <Text style={styles.syncNote}>{syncCount} treinos sincronizados.</Text>
        ) : null}

        {/* ── Conta ── */}
        <SectionLabel>Conta</SectionLabel>
        <View style={styles.groupCard}>
          <SettingRow
            icon="star"
            iconColor={Colors.onAccent}
            iconBg={Colors.primary}
            title="Assinatura"
            subtitle="Gerencie seu plano FitSync AI"
            onPress={() => router.push('/subscription' as never)}
            right={<Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />}
            divider
          />
          <SettingRow
            icon="log-out-outline"
            title="Sair da conta"
            onPress={() => setShowLogoutModal(true)}
          />
        </View>

        <Text style={styles.footer}>FitSync AI · versão 0.1.0</Text>
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
                    <View style={styles.modalHandle} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  title: { ...Type.headline, color: Colors.textPrimary, marginBottom: Spacing.xs },

  // Profile card
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  profileGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(62,144,255,0.10)',
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { ...Type.title, color: Colors.textPrimary },
  profileMeta: { ...Type.bodySm, color: Colors.textSecondary, marginTop: 2 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  goalLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  goalLabel: {
    fontFamily: Fonts.data,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: Tracking.wide,
  },
  goalValue: { ...Type.bodyStrong, color: Colors.textPrimary, marginTop: 2 },
  linkText: { fontFamily: Fonts.bodySemiBold, fontSize: FontSize.sm, color: Colors.accent },

  // Sections
  sectionLabel: {
    ...Type.label,
    color: Colors.textMuted,
    letterSpacing: Tracking.wider,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Rows
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...Type.bodyStrong, color: Colors.textPrimary },
  rowSubtitle: { ...Type.bodySm, color: Colors.textSecondary, marginTop: 1 },

  // Garmin connection
  connRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: Radii.full, backgroundColor: Colors.primary },
  statusText: {
    fontFamily: Fonts.data,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  syncBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncNote: { ...Type.bodySm, fontSize: FontSize.xs, color: Colors.textMuted, paddingLeft: Spacing.xs },

  footer: {
    ...Type.bodySm,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.surfaceAlt,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + Spacing.md,
    minHeight: 300,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radii.full,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.md,
  },
  modalTitle: { ...Type.title, color: Colors.textPrimary, marginBottom: Spacing.xs },
  modalSub: { ...Type.bodySm, color: Colors.textMuted, marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
