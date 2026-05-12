import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  async function loginWithGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'fitsync://auth/callback' },
      });
      if (error) throw error;
    } catch {
      Alert.alert('Erro', 'Não conseguimos fazer login com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithApple() {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken ?? '',
      });

      if (error) throw error;
      router.replace('/');
    } catch {
      Alert.alert('Erro', 'Não conseguimos fazer login com Apple. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithEmail() {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha email e senha.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha email e senha.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      Alert.alert('Conta criada', 'Verifique seu email para confirmar a conta.');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitSync AI</Text>
      <Text style={styles.subtitle}>Seu plano de corrida com IA</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
      ) : (
        <>
          <TouchableOpacity style={styles.googleBtn} onPress={loginWithGoogle}>
            <Text style={styles.googleText}>Continuar com Google</Text>
          </TouchableOpacity>

          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={8}
            style={styles.appleBtn}
            onPress={loginWithApple}
          />

          <TouchableOpacity onPress={() => setShowEmailForm(!showEmailForm)} style={styles.emailToggle}>
            <Text style={styles.emailToggleText}>
              {showEmailForm ? 'Ocultar login por email' : 'Entrar com email'}
            </Text>
          </TouchableOpacity>

          {showEmailForm && (
            <View style={styles.emailForm}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity style={styles.emailBtn} onPress={loginWithEmail}>
                <Text style={styles.emailBtnText}>Entrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signUpBtn} onPress={signUpWithEmail}>
                <Text style={styles.signUpText}>Criar conta</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <Text style={styles.disclaimer}>
        FitSync não substitui acompanhamento médico ou profissional.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', color: '#111' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 48, marginTop: 8 },
  loader: { marginTop: 24 },
  googleBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  googleText: { fontSize: 16, fontWeight: '600', color: '#111' },
  appleBtn: { width: '100%', height: 52, marginBottom: 12 },
  emailToggle: { alignItems: 'center', marginBottom: 12 },
  emailToggleText: { color: '#2563eb', fontSize: 14 },
  emailForm: { gap: 10, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  emailBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  emailBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signUpBtn: { alignItems: 'center', padding: 8 },
  signUpText: { color: '#666', fontSize: 14 },
  disclaimer: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 'auto' },
});
