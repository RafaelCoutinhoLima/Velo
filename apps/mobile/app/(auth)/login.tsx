import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loginWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'fitsync://auth/callback' },
      });
      if (authErr) throw authErr;
    } catch {
      setError('Não conseguimos fazer login com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithApple() {
    setError(null);
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { error: authErr } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken ?? '',
      });
      if (authErr) throw authErr;
      router.replace('/');
    } catch {
      setError('Não conseguimos fazer login com Apple. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithEmail() {
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authErr) throw authErr;
      router.replace('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authErr) throw authErr;
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.logo}>⚡</Text>
          <Text style={styles.title}>FitSync AI</Text>
          <Text style={styles.subtitle}>Seu plano de corrida com IA adaptativa</Text>
        </View>

        {error ? (
          <View style={styles.errorWrap}>
            <ErrorCard message={error} />
          </View>
        ) : null}

        {/* Google primeiro — maior taxa de uso */}
        <Button
          label="Continuar com Google"
          onPress={loginWithGoogle}
          variant="secondary"
          loading={loading}
          style={styles.socialBtn}
          accessibilityLabel="Entrar com Google"
        />

        {/* Apple Sign-In só existe no iOS — renderizar no Android quebra/
            fica em branco (funnel drop-off). Gate por plataforma. */}
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={Radii.md}
            style={styles.appleBtn}
            onPress={loginWithApple}
          />
        ) : null}

        <TouchableOpacity
          onPress={() => { setShowEmailForm(!showEmailForm); setError(null); }}
          style={styles.emailToggle}
          accessibilityRole="button"
          accessibilityLabel="Entrar com e-mail"
        >
          <Text style={styles.emailToggleText}>
            {showEmailForm ? 'Ocultar formulário' : 'Entrar com e-mail'}
          </Text>
        </TouchableOpacity>

        {showEmailForm && (
          <View style={[styles.emailForm, Shadow.card]}>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel="Campo e-mail"
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel="Campo senha"
            />
            <Button
              label="Entrar"
              onPress={loginWithEmail}
              loading={loading}
              style={{ marginBottom: Spacing.sm }}
            />
            <Button
              label="Criar conta"
              onPress={signUpWithEmail}
              variant="ghost"
              loading={loading}
            />
          </View>
        )}

        <Text style={styles.disclaimer}>
          FitSync não substitui acompanhamento médico ou profissional.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl + Spacing.xl, paddingBottom: Spacing.xl, flexGrow: 1 },
  hero: { alignItems: 'center', marginBottom: Spacing.xl },
  logo: { fontSize: 56, marginBottom: Spacing.sm },
  title: { fontSize: FontSize['4xl'], fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
  errorWrap: { marginBottom: Spacing.md },
  socialBtn: { marginBottom: Spacing.sm },
  appleBtn: { width: '100%', height: 52, marginBottom: Spacing.sm },
  emailToggle: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  emailToggleText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  emailForm: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.bg,
    minHeight: 50,
  },
  disclaimer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: Spacing.lg,
    lineHeight: 16,
  },
});
