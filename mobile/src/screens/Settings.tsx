import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { connectGarmin, syncGarmin } from '../lib/api';

type Props = {
  garminConnected: boolean;
  zonesCalibrated: boolean;
  onGarminConnected: () => void;
  onSignOut: () => void;
  onRequestNewPlan: () => void;
  onRequestCooperTest: () => void;
};

export default function Settings({ garminConnected, zonesCalibrated, onGarminConnected, onSignOut, onRequestNewPlan, onRequestCooperTest }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleConnect() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos obrigatórios', 'Informe email e senha do Garmin Connect.');
      return;
    }
    setConnecting(true);
    try {
      await connectGarmin({ email: email.trim(), password, mfa_code: mfa.trim() || undefined });
      onGarminConnected();
      Alert.alert('Garmin conectado!', 'Agora sincronize para importar seus treinos.');
    } catch (e: any) {
      const msg: string = e.message ?? '';
      if (msg.toLowerCase().includes('mfa') || msg.toLowerCase().includes('2fa') || msg.toLowerCase().includes('otp')) {
        setShowMfa(true);
        Alert.alert('Código de verificação necessário', 'Insira o código do Garmin e tente novamente.');
      } else {
        Alert.alert('Erro ao conectar', msg || 'Verifique suas credenciais e tente novamente.');
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncGarmin(90);
      Alert.alert('Sincronização concluída', `${result.synced ?? 0} treino(s) importado(s).`);
    } catch (e: any) {
      Alert.alert('Erro ao sincronizar', e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Configurações</Text>

      {/* ── Garmin ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Garmin Connect</Text>

        <View style={[styles.statusRow, { backgroundColor: garminConnected ? '#dcfce7' : '#fef9c3' }]}>
          <Text style={styles.statusDot}>{garminConnected ? '🟢' : '🟡'}</Text>
          <Text style={styles.statusText}>
            {garminConnected ? 'Conta conectada' : 'Conta não conectada'}
          </Text>
        </View>

        {!garminConnected && (
          <View style={styles.form}>
            <Text style={styles.formHint}>
              Use as mesmas credenciais do Garmin Connect (app ou site).
            </Text>

            <Text style={styles.label}>Email do Garmin</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            {showMfa && (
              <>
                <Text style={styles.label}>Código de verificação (2FA)</Text>
                <TextInput
                  style={styles.input}
                  value={mfa}
                  onChangeText={setMfa}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, connecting && styles.btnDisabled]}
              onPress={handleConnect}
              disabled={connecting}
            >
              {connecting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnTextLight}>Conectar Garmin</Text>}
            </TouchableOpacity>
          </View>
        )}

        {garminConnected && (
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, syncing && styles.btnDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator color="#2563eb" />
              : <Text style={styles.btnTextDark}>Sincronizar treinos (90 dias)</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Calibração de Zonas ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calibração de Zonas</Text>

        <View style={[styles.statusRow, { backgroundColor: zonesCalibrated ? '#dcfce7' : '#fef9c3' }]}>
          <Text style={styles.statusDot}>{zonesCalibrated ? '🟢' : '🟡'}</Text>
          <Text style={styles.statusText}>
            {zonesCalibrated ? 'Zonas calibradas' : 'Zonas não calibradas'}
          </Text>
        </View>

        <Text style={styles.formHint}>
          O Teste de Cooper calibra suas zonas de FC e pace — 12 minutos correndo no máximo esforço sustentável. Use uma corrida já sincronizada do Garmin ou faça o teste e sincronize.
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onRequestCooperTest}>
          <Text style={styles.btnTextDark}>
            {zonesCalibrated ? 'Refazer Teste de Cooper' : 'Fazer Teste de Cooper'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Objetivo de Treino ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objetivo de Treino</Text>
        <Text style={styles.formHint}>
          Defina sua meta de corrida e geramos um plano semanal personalizado com base no seu histórico.
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onRequestNewPlan}>
          <Text style={styles.btnTextLight}>Definir / Gerar Novo Plano</Text>
        </TouchableOpacity>
      </View>

      {/* ── Conta ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={onSignOut}>
          <Text style={styles.btnTextLight}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f9fafb' },
  container: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, padding: 10, marginBottom: 12 },
  statusDot: { fontSize: 14 },
  statusText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  form: { gap: 4 },
  formHint: { color: '#6b7280', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#f9fafb', marginBottom: 4,
  },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnSecondary: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#2563eb' },
  btnDanger: { backgroundColor: '#ef4444' },
  btnDisabled: { opacity: 0.6 },
  btnTextLight: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnTextDark: { color: '#2563eb', fontWeight: '700', fontSize: 15 },
});
