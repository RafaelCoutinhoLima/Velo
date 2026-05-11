import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

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
      router.replace('/(tabs)/plan');
    } catch {
      Alert.alert('Erro', 'Não conseguimos fazer login com Apple. Tente novamente.');
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
  appleBtn: { width: '100%', height: 52, marginBottom: 24 },
  disclaimer: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 'auto' },
});
