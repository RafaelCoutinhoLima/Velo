import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../lib/api';
import { Fonts, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../Button';
import { ErrorCard } from '../ErrorCard';

export function SendToWatch({ athleteId }: { athleteId: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { post } = useApi();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setStatus('sending');
    setMessage(null);
    try {
      const res = await post<{ ok: boolean; sent: number }>('/plan/send-to-garmin', {
        athlete_id: athleteId,
        week_number: 1,
      });
      setStatus('sent');
      setMessage(
        `${res.sent} treino${res.sent === 1 ? '' : 's'} enviado${res.sent === 1 ? '' : 's'} pro relógio.`,
      );
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
      {status === 'sent' && message ? <Text style={styles.ok}>{message}</Text> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: { marginTop: 2 },
    feedback: { marginTop: Spacing.sm },
    ok: {
      ...theme.type.bodySm,
      color: theme.colors.success,
      fontFamily: Fonts.bodySemiBold,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
  });
