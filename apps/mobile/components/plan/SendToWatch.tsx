import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../Button';
import { ErrorCard } from '../ErrorCard';

// Envia a semana pro Garmin e confirma com o bottom sheet de sucesso da
// tela 19 (scrim escuro, check verde 92px, card do envio, CTA "Feito").
export function SendToWatch({ athleteId }: { athleteId: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { post } = useApi();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [showSheet, setShowSheet] = useState(false);

  async function send() {
    setStatus('sending');
    setMessage(null);
    try {
      const res = await post<{ ok: boolean; sent: number }>('/plan/send-to-garmin', {
        athlete_id: athleteId,
        week_number: 1,
      });
      setStatus('sent');
      setSentCount(res.sent);
      setShowSheet(true);
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Não conseguimos enviar pro relógio.');
    }
  }

  return (
    <View style={styles.section}>
      <Button
        label={status === 'sent' ? 'Enviado' : 'Enviar semana pro relógio'}
        onPress={send}
        variant="secondary"
        loading={status === 'sending'}
        disabled={status === 'sending' || status === 'sent'}
        icon={
          <Ionicons
            name={status === 'sent' ? 'checkmark' : 'watch-outline'}
            size={18}
            color={theme.colors.textPrimary}
          />
        }
        accessibilityLabel="Enviar treinos da semana para o relógio Garmin"
      />
      {status === 'error' && message ? (
        <View style={styles.feedback}>
          <ErrorCard message={message} />
        </View>
      ) : null}

      {/* Bottom sheet de sucesso (tela 19) */}
      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSheet(false)}
      >
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={44} color={theme.colors.success} />
            </View>
            <Text style={styles.sheetTitle}>Enviado para o relógio</Text>
            <Text style={styles.sheetBody}>
              Seus treinos aparecem no Garmin como treinos estruturados. É só apertar start no
              aquecimento.
            </Text>

            <View style={styles.workoutCard}>
              <View style={styles.workoutIcon}>
                <Ionicons name="watch-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.workoutName}>Plano da semana</Text>
                <Text style={styles.workoutMeta}>
                  {sentCount} treino{sentCount === 1 ? '' : 's'} estruturado
                  {sentCount === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.syncRow}>
                <View style={styles.syncDot} />
                <Text style={styles.syncText}>Sincronizado</Text>
              </View>
            </View>

            <Button
              label="Feito"
              onPress={() => setShowSheet(false)}
              style={{ alignSelf: 'stretch' }}
              accessibilityLabel="Fechar confirmação"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: { marginTop: 2 },
    feedback: { marginTop: Spacing.sm },

    scrim: {
      flex: 1,
      backgroundColor: 'rgba(20,21,25,0.72)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: Spacing.lg,
      paddingBottom: Spacing.xl + Spacing.md,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    grabber: {
      width: 40,
      height: 4,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.borderStrong,
      marginBottom: Spacing.sm,
    },
    checkCircle: {
      width: 92,
      height: 92,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.successLight,
      borderWidth: 2,
      borderColor: theme.colors.successBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
    },
    sheetTitle: {
      fontFamily: Fonts.displayBlack,
      fontSize: 25,
      letterSpacing: -0.6,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    sheetBody: {
      ...theme.type.bodySm,
      fontSize: FontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 300,
    },
    workoutCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm + 2,
      alignSelf: 'stretch',
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginVertical: Spacing.sm,
    },
    workoutIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    workoutName: { ...theme.type.bodyStrong, fontSize: FontSize.sm, color: theme.colors.textPrimary },
    workoutMeta: {
      fontFamily: Fonts.data,
      fontSize: 11.5,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    syncRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    syncDot: { width: 7, height: 7, borderRadius: Radii.full, backgroundColor: theme.colors.success },
    syncText: { fontFamily: Fonts.bodySemiBold, fontSize: FontSize.xs, color: theme.colors.success },
  });
