import { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ErrorCard } from '../../components/ErrorCard';

export default function LoginScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        {/* ── Hero (tela 01): símbolo » + wordmark Velo + ponto accent ── */}
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 7l7 5-7 5M12 7l7 5-7 5"
                stroke={theme.colors.onAccent}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={styles.wordmarkRow}>
            <Text style={styles.title}>Velo</Text>
            <View style={styles.wordmarkDot} />
          </View>
          <Text style={styles.subtitle}>
            Seu treinador de corrida com IA. Treinos que se adaptam a você.
          </Text>
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
          icon={<Ionicons name="logo-google" size={18} color={theme.colors.textPrimary} />}
          accessibilityLabel="Entrar com Google"
        />

        {/* Apple Sign-In só existe no iOS — renderizar no Android quebra/
            fica em branco (funnel drop-off). Gate por plataforma. */}
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={Radii.full}
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
          <View style={styles.emailForm}>
            <Input
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              accessibilityLabel="Campo e-mail"
            />
            <Input
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
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

        {/* Prova social (tela 01) */}
        <View style={styles.socialProof}>
          <View style={styles.avatarStack}>
            <View style={[styles.proofAvatar, { backgroundColor: '#c7d9f5' }]} />
            <View style={[styles.proofAvatar, styles.proofAvatarOverlap, { backgroundColor: '#a9c4ef' }]} />
            <View style={[styles.proofAvatar, styles.proofAvatarOverlap, { backgroundColor: '#7fa8e8' }]} />
          </View>
          <Text style={styles.socialProofText}>
            Mais de 2.000 corredores treinando com a Velo
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          A Velo não substitui acompanhamento médico ou profissional.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: {
      padding: Spacing.lg,
      paddingTop: Spacing.xxl + Spacing.xl,
      paddingBottom: Spacing.xl,
      flexGrow: 1,
    },
    hero: { alignItems: 'center', marginBottom: Spacing.xl },
    logoBadge: {
      width: 82,
      height: 82,
      borderRadius: 22,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md + 4,
      ...theme.shadow.glow,
    },
    wordmarkRow: { flexDirection: 'row', alignItems: 'baseline' },
    title: {
      fontFamily: Fonts.displayBlack,
      fontSize: 46,
      color: theme.colors.textPrimary,
      letterSpacing: -1.5,
    },
    wordmarkDot: {
      width: 9,
      height: 9,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primary,
      marginLeft: 6,
    },
    subtitle: {
      ...theme.type.body,
      color: theme.colors.textSecondary,
      marginTop: Spacing.sm,
      textAlign: 'center',
      maxWidth: 280,
    },
    errorWrap: { marginBottom: Spacing.md },
    socialBtn: { marginBottom: Spacing.sm },
    appleBtn: { width: '100%', height: 52, marginBottom: Spacing.sm },
    emailToggle: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    emailToggleText: {
      fontFamily: Fonts.bodySemiBold,
      color: theme.colors.accent,
      fontSize: FontSize.sm,
    },
    emailForm: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    socialProof: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: Spacing.md,
    },
    avatarStack: { flexDirection: 'row' },
    proofAvatar: {
      width: 22,
      height: 22,
      borderRadius: Radii.full,
      borderWidth: 2,
      borderColor: theme.colors.bg,
    },
    proofAvatarOverlap: { marginLeft: -8 },
    socialProofText: {
      fontFamily: Fonts.bodyMedium,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
    },
    disclaimer: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: 'auto',
      paddingTop: Spacing.lg,
    },
  });
