import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
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
import { persister } from '../../lib/queryClient';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import {
  ACCENTS,
  Fonts,
  FontSize,
  Radii,
  Spacing,
  Tracking,
  useTheme,
  type Theme,
  type ThemeName,
} from '../../lib/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ErrorCard } from '../../components/ErrorCard';
import { TopBar } from '../../components/TopBar';

export default function SettingsScreen() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const advancedMode = useAuthStore((s) => s.advancedMode);
  const setAdvancedMode = useAuthStore((s) => s.setAdvancedMode);
  const garminConnected = useAuthStore((s) => s.garminConnected);
  const lastSync = useAuthStore((s) => s.lastGarminSync);
  const setGarminConnected = useAuthStore((s) => s.setGarminConnected);
  const setLastGarminSync = useAuthStore((s) => s.setLastGarminSync);
  const session = useAuthStore((s) => s.session);
  const { get, post, postLong, del } = useApi();
  const qc = useQueryClient();
  const {
    theme,
    themeName,
    setThemeName,
    available,
    accentName,
    setAccentName,
    availableAccents,
  } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showGarminModal, setShowGarminModal] = useState(false);
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminMfa, setGarminMfa] = useState('');
  const [connectStep, setConnectStep] = useState<'idle' | 'connecting' | 'syncing'>('idle');
  const [syncCount, setSyncCount] = useState<number | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dataBusy, setDataBusy] = useState<'idle' | 'exporting' | 'deleting'>('idle');
  const [dataStatus, setDataStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  // Mensagem de status do botão de re-sync (sucesso ou erro) — sem isso o
  // botão parecia "morto" quando o sync falhava (erro era engolido).
  const [syncStatus, setSyncStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  function toggleAdvancedMode(value: boolean) {
    setAdvancedMode(value);
  }

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
        <View style={[styles.rowIcon, { backgroundColor: iconBg ?? theme.colors.surfaceAlt }]}>
          <Ionicons
            name={icon}
            size={20}
            color={iconColor ?? (danger ? theme.colors.danger : theme.colors.textPrimary)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, danger && { color: theme.colors.danger }]}>{title}</Text>
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

  // Segmented control para troca de identidade visual.
  function ThemeSelector() {
    return (
      <View style={styles.themeSelector}>
        {available.map((opt) => {
          const isActive = opt.name === themeName;
          return (
            <TouchableOpacity
              key={opt.name}
              onPress={() => setThemeName(opt.name as ThemeName)}
              style={[styles.themeOption, isActive && styles.themeOptionActive]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar tema ${opt.displayName}`}
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.themeSwatchRow}>
                <View
                  style={[
                    styles.themeSwatch,
                    {
                      backgroundColor:
                        opt.name === 'veloDark' ? '#5b95f7' : '#2a5ea7',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.themeSwatch,
                    {
                      backgroundColor:
                        opt.name === 'veloDark' ? '#101113' : '#f5f8fd',
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.themeName, isActive && styles.themeNameActive]}>
                {opt.displayName}
              </Text>
              {isActive ? (
                <View style={styles.themeCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Seletor de cor de ação (tela 11): Azul / Verde / Laranja.
  function AccentSelector() {
    const isDark = themeName === 'veloDark';
    return (
      <View style={styles.accentRow}>
        {availableAccents.map((opt) => {
          const isActive = opt.name === accentName;
          const hex = isDark ? ACCENTS[opt.name].dark : ACCENTS[opt.name].light;
          return (
            <TouchableOpacity
              key={opt.name}
              onPress={() => setAccentName(opt.name)}
              style={[styles.accentOption, isActive && { borderColor: hex }]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar cor ${opt.displayName}`}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.accentSwatch, { backgroundColor: hex }]}>
                {isActive ? (
                  <Ionicons name="checkmark" size={14} color={theme.colors.onAccent} />
                ) : null}
              </View>
              <Text style={[styles.accentName, isActive && { color: hex }]}>
                {opt.displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
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
      await postLong('/garmin/connect', {
        athlete_id: session.athlete_id,
        email: garminEmail.trim(),
        password: garminPassword,
        ...(garminMfa.trim() ? { mfa_code: garminMfa.trim() } : {}),
      });

      // Limpa credenciais da memória imediatamente
      setGarminPassword('');
      setGarminMfa('');

      setConnectStep('syncing');

      const syncBody = await postLong<{ synced: number }>('/garmin/sync', {
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
    setSyncStatus(null);
    try {
      // postLong: Garmin Connect é lento (15s do timeout normal estourava).
      // days=90 pra trazer o histórico completo, não só o último mês.
      const body = await postLong<{ synced: number }>('/garmin/sync', {
        athlete_id: session.athlete_id,
        days: 90,
      });
      setSyncCount(body.synced);
      setLastGarminSync(new Date().toISOString());
      setSyncStatus({
        kind: 'ok',
        msg: body.synced > 0 ? `${body.synced} treinos sincronizados.` : 'Tudo já estava em dia.',
      });
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['workouts'] });
    } catch (err: unknown) {
      // Surface o erro — antes era engolido e o botão parecia não funcionar.
      setSyncStatus({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Não conseguimos sincronizar. Tente de novo.',
      });
    } finally {
      setConnectStep('idle');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    clearSession();
    // Limpa o cache do react-query (memória + persistido no SecureStore) para
    // que dados de treino do usuário anterior não fiquem no dispositivo.
    qc.clear();
    await Promise.resolve(persister.removeClient()).catch(() => {});
    router.replace('/(auth)/login');
  }

  // LGPD art. 18 V — portabilidade: baixa todos os dados do titular e abre a
  // folha de compartilhamento com o JSON.
  async function exportData() {
    if (dataBusy !== 'idle') return;
    setDataBusy('exporting');
    setDataStatus(null);
    try {
      const data = await get<Record<string, unknown>>('/athlete/export');
      await Share.share({
        title: 'Meus dados Velo',
        message: JSON.stringify(data, null, 2),
      });
      setDataStatus({ kind: 'ok', msg: 'Exportação gerada. Escolha onde salvar/enviar.' });
    } catch (err: unknown) {
      setDataStatus({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Não consegui exportar seus dados.',
      });
    } finally {
      setDataBusy('idle');
    }
  }

  // LGPD art. 18 VI — eliminação: apaga a conta no servidor (cascata) e desloga.
  async function deleteAccount() {
    setShowDeleteModal(false);
    if (dataBusy !== 'idle') return;
    setDataBusy('deleting');
    setDataStatus(null);
    try {
      await del('/athlete');
      await supabase.auth.signOut();
      clearSession();
      qc.clear();
      await Promise.resolve(persister.removeClient()).catch(() => {});
      router.replace('/(auth)/login');
    } catch (err: unknown) {
      setDataBusy('idle');
      setDataStatus({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Não consegui excluir a conta. Tente de novo.',
      });
    }
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
          <View style={styles.profileTop}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={32} color={theme.colors.textSecondary} />
            </View>
            <View>
              <Text style={styles.profileName}>Atleta Velo</Text>
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
              <Ionicons name="flag" size={20} color={theme.colors.primary} />
              <View>
                <Text style={styles.goalLabel}>Prova Alvo</Text>
                <Text style={styles.goalValue}>Toque para definir</Text>
              </View>
            </View>
            <Text style={styles.linkText}>Editar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Aparência ── */}
        <SectionLabel>Aparência</SectionLabel>
        <View style={styles.groupCard}>
          <View style={styles.themeCardInner}>
            <Text style={styles.themeHeader}>Identidade visual</Text>
            <Text style={styles.themeSub}>Escolha como a Velo se apresenta.</Text>
            <ThemeSelector />
            <Text style={[styles.themeSub, { marginTop: Spacing.md }]}>Cor de destaque</Text>
            <AccentSelector />
          </View>
        </View>

        {/* ── Preferências ── */}
        <SectionLabel>Preferências</SectionLabel>
        <View style={styles.groupCard}>
          <SettingRow
            icon="sparkles"
            iconColor={theme.colors.primary}
            title="Modo Avançado"
            subtitle="Mostra ACWR (balanço carga/risco), CTL (forma de fundo) e TSB (frescor) nas telas de treino."
            right={
              <Switch
                value={advancedMode}
                onValueChange={toggleAdvancedMode}
                trackColor={{ false: theme.colors.surfaceAlt, true: theme.colors.primary }}
                thumbColor={theme.colors.surface}
                ios_backgroundColor={theme.colors.surfaceAlt}
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
              iconColor={theme.colors.accent}
              iconBg={theme.colors.accentLight}
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
                    accessibilityState={{ disabled: isBusy }}
                  >
                    {connectStep === 'syncing' ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Ionicons name="sync" size={20} color={theme.colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                </View>
              }
            />
          ) : (
            <SettingRow
              icon="watch"
              iconColor={theme.colors.accent}
              iconBg={theme.colors.accentLight}
              title="Conectar Garmin"
              subtitle="Importe seu histórico e personalize seu plano"
              onPress={() => { setConnectStep('idle'); setConnectError(null); setShowGarminModal(true); }}
              right={<Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />}
            />
          )}
        </View>
        {connectStep === 'syncing' ? (
          <Text style={styles.syncNote}>Sincronizando com o Garmin… pode levar até 1 min.</Text>
        ) : syncStatus ? (
          <Text
            style={[
              styles.syncNote,
              { color: syncStatus.kind === 'ok' ? theme.colors.success : theme.colors.danger },
            ]}
          >
            {syncStatus.msg}
          </Text>
        ) : garminConnected && syncCount !== null ? (
          <Text style={styles.syncNote}>{syncCount} treinos sincronizados.</Text>
        ) : null}

        {/* ── Conta ── */}
        <SectionLabel>Conta</SectionLabel>
        <View style={styles.groupCard}>
          <SettingRow
            icon="star"
            iconColor={theme.colors.onAccent}
            iconBg={theme.colors.primary}
            title="Assinatura"
            subtitle="Gerencie seu plano Velo Pro"
            onPress={() => router.push('/subscription' as never)}
            right={<Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />}
            divider
          />
          <SettingRow
            icon="download-outline"
            title="Exportar meus dados"
            subtitle="Baixe tudo o que a Velo guarda sobre você (LGPD)"
            onPress={exportData}
            right={
              dataBusy === 'exporting' ? (
                <ActivityIndicator size="small" color={theme.colors.textMuted} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              )
            }
            divider
          />
          <SettingRow
            icon="log-out-outline"
            title="Sair da conta"
            onPress={() => setShowLogoutModal(true)}
            divider
          />
          <SettingRow
            icon="trash-outline"
            iconColor={theme.colors.danger}
            title="Excluir minha conta"
            subtitle="Apaga permanentemente todos os seus dados (LGPD)"
            onPress={() => setShowDeleteModal(true)}
            right={
              dataBusy === 'deleting' ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : null
            }
          />
        </View>

        {dataStatus ? (
          <Text
            style={[
              styles.syncNote,
              dataStatus.kind === 'error' ? { color: theme.colors.danger } : null,
            ]}
          >
            {dataStatus.msg}
          </Text>
        ) : null}

        <Text style={styles.footer}>Velo · versão 0.1.0</Text>
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

      <ConfirmModal
        visible={showDeleteModal}
        title="Excluir minha conta"
        message="Isso apaga permanentemente seu perfil, treinos, métricas e planos. Não dá para desfazer. Continuar?"
        confirmLabel="Excluir tudo"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        onConfirm={deleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.bg },
    container: { flex: 1 },
    content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
    title: { ...theme.type.headline, color: theme.colors.textPrimary, marginBottom: Spacing.xs },

    // Profile card
    profileCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.lg,
      gap: Spacing.md,
      overflow: 'hidden',
    },
    profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileName: { ...theme.type.title, color: theme.colors.textPrimary },
    profileMeta: { ...theme.type.bodySm, color: theme.colors.textSecondary, marginTop: 2 },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    goalLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    goalLabel: {
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
    },
    goalValue: { ...theme.type.bodyStrong, color: theme.colors.textPrimary, marginTop: 2 },
    linkText: { fontFamily: Fonts.bodySemiBold, fontSize: FontSize.sm, color: theme.colors.accent },

    // Sections
    sectionLabel: {
      ...theme.type.label,
      color: theme.colors.textMuted,
      letterSpacing: Tracking.wider,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
      paddingLeft: Spacing.xs,
    },
    groupCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },

    // Theme selector
    themeCardInner: { padding: Spacing.md, gap: Spacing.sm },
    themeHeader: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    themeSub: { ...theme.type.bodySm, color: theme.colors.textSecondary },
    themeSelector: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    themeOption: {
      flex: 1,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      padding: Spacing.md,
      gap: Spacing.sm,
      position: 'relative',
    },
    themeOptionActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryMuted,
    },
    themeSwatchRow: { flexDirection: 'row', gap: 4 },
    themeSwatch: {
      width: 22,
      height: 22,
      borderRadius: Radii.sm,
    },
    themeName: {
      ...theme.type.bodySm,
      fontFamily: Fonts.bodySemiBold,
      color: theme.colors.textPrimary,
    },
    themeNameActive: { color: theme.colors.primary },
    themeCheck: { position: 'absolute', top: Spacing.xs, right: Spacing.xs },

    accentRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    accentOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm + 2,
    },
    accentSwatch: {
      width: 22,
      height: 22,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentName: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.sm,
      color: theme.colors.textSecondary,
    },

    // Rows
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    rowSubtitle: { ...theme.type.bodySm, color: theme.colors.textSecondary, marginTop: 1 },

    // Garmin connection
    connRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 8, height: 8, borderRadius: Radii.full, backgroundColor: theme.colors.success },
    statusText: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      color: theme.colors.success,
    },
    syncBtn: {
      width: 36,
      height: 36,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    syncNote: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.textMuted, paddingLeft: Spacing.xs },

    footer: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.lg,
    },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalBox: {
      backgroundColor: theme.colors.surface,
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
      backgroundColor: theme.colors.borderStrong,
      marginBottom: Spacing.md,
    },
    modalTitle: { ...theme.type.title, color: theme.colors.textPrimary, marginBottom: Spacing.xs },
    modalSub: { ...theme.type.bodySm, color: theme.colors.textMuted, marginBottom: Spacing.md },
    modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  });
