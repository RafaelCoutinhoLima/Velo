import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';
import { StepBar } from '../../components/StepBar';

type GoalMode = 'race' | 'general_progression';
type RaceDistance = '5k' | '10k' | '21k' | '42k' | '70.3' | 'other';

const DISTANCE_KM: Record<RaceDistance, number> = {
  '5k': 5,
  '10k': 10,
  '21k': 21.0975,
  '42k': 42.195,
  '70.3': 113.0,
  other: 0,
};

const DISTANCE_LABELS: Record<RaceDistance, string> = {
  '5k': '5K',
  '10k': '10K',
  '21k': 'Meia\n21K',
  '42k': 'Maratona\n42K',
  '70.3': 'Half Iron\n70.3',
  other: 'Outra',
};

function validateDate(raw: string): string | null {
  if (raw.length < 10) return 'Data incompleta';
  const [d, m, y] = raw.split('/').map(Number);
  if (!d || !m || !y) return 'Formato inválido';
  if (m < 1 || m > 12) return 'Mês inválido (01–12)';
  if (d < 1 || d > 31) return 'Dia inválido (01–31)';
  if (y < new Date().getFullYear()) return 'A prova deve ser no futuro';
  return null;
}

export default function GoalScreen() {
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState<GoalMode | null>(null);
  const [raceDistance, setRaceDistance] = useState<RaceDistance | null>(null);
  const [raceDate, setRaceDate] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    mode === 'general_progression' ||
    (mode === 'race' && raceDistance !== null && raceDate.length === 10 && dateError === null);

  function handleDateChange(t: string) {
    const digits = t.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    setRaceDate(formatted);
    if (formatted.length === 10) {
      setDateError(validateDate(formatted));
    } else {
      setDateError(null);
    }
  }

  async function next() {
    if (!isValid || !session?.athlete_id) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        athlete_id: session.athlete_id,
        goal_mode: mode,
      };
      if (mode === 'race' && raceDistance && raceDate) {
        const [d, m, y] = raceDate.split('/');
        body['race_date'] = `${y}-${m}-${d}`;
        body['race_distance_km'] = DISTANCE_KM[raceDistance];
      }
      await post('/onboarding/goal', body);
      router.push('/onboarding/garmin');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não conseguimos salvar seu objetivo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>Sua prova alvo</Text>
          <Text style={styles.subtitle}>Isso define como o plano é construído</Text>
        </View>

        <StepBar current={1} />

        {error ? <View style={{ marginBottom: Spacing.md }}><ErrorCard message={error} /></View> : null}

        <ModeCard
          icon="flag"
          active={mode === 'race'}
          title="Tenho uma prova alvo"
          desc="Preparação periodizada para uma data específica"
          onPress={() => setMode('race')}
          theme={theme}
          styles={styles}
        />
        <ModeCard
          icon="trending-up"
          active={mode === 'general_progression'}
          title="Quero evoluir gradualmente"
          desc="Sem prova definida — foco em base e progressão"
          onPress={() => setMode('general_progression')}
          theme={theme}
          styles={styles}
        />

        {mode === 'race' ? (
          <>
            <Text style={styles.label}>Distância da prova</Text>
            <View style={styles.distanceGrid}>
              {(Object.keys(DISTANCE_LABELS) as RaceDistance[]).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.distanceCard, raceDistance === d && styles.distanceCardActive]}
                  onPress={() => setRaceDistance(d)}
                  accessibilityRole="radio"
                  accessibilityLabel={DISTANCE_LABELS[d].replace('\n', ' ')}
                  accessibilityState={{ selected: raceDistance === d }}
                >
                  <Text style={[styles.distanceText, raceDistance === d && styles.distanceTextActive]}>
                    {DISTANCE_LABELS[d]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Data da prova</Text>
            <TextInput
              style={[styles.input, dateError ? styles.inputError : undefined]}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              value={raceDate}
              onChangeText={handleDateChange}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel="Data da prova"
            />
            {dateError ? (
              <Text style={styles.fieldError}>{dateError}</Text>
            ) : raceDate.length === 10 ? (
              <Text style={styles.fieldOk}>✓ Data válida</Text>
            ) : null}
          </>
        ) : null}

        <Button
          label="Continuar"
          onPress={next}
          loading={loading}
          disabled={!isValid}
          style={styles.btn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Definido em escopo de módulo (não dentro da tela) para manter a identidade
// do componente estável entre renders — evita desmontar/remontar a subárvore.
function ModeCard({
  icon,
  active,
  title,
  desc,
  onPress,
  theme,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  title: string;
  desc: string;
  onPress: () => void;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.modeCard, active && styles.modeCardActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.modeIcon, active && styles.modeIconActive]}>
        <Ionicons name={icon} size={20} color={active ? theme.colors.onAccent : theme.colors.textSecondary} />
      </View>
      <View style={styles.modeBody}>
        <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{title}</Text>
        <Text style={styles.modeDesc}>{desc}</Text>
      </View>
      {active ? <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} /> : null}
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
    hero: { marginBottom: Spacing.lg },
    title: { ...theme.type.display, color: theme.colors.textPrimary },
    subtitle: { ...theme.type.body, color: theme.colors.textMuted, marginTop: Spacing.xs },

    modeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radii.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
      backgroundColor: theme.colors.surface,
    },
    modeCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryMuted },
    modeIcon: {
      width: 44,
      height: 44,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeIconActive: { backgroundColor: theme.colors.primary },
    modeBody: { flex: 1 },
    modeTitle: { ...theme.type.bodyStrong, color: theme.colors.textPrimary },
    modeTitleActive: { color: theme.colors.primary },
    modeDesc: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.textMuted, marginTop: 2 },

    label: { ...theme.type.label, color: theme.colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.md },
    distanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    distanceCard: {
      flexGrow: 1,
      flexBasis: '30%',
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.sm,
      minHeight: 58,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    distanceCardActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    distanceText: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    distanceTextActive: { color: theme.colors.onAccent },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontFamily: Fonts.data,
      fontSize: FontSize.md,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceAlt,
      minHeight: 50,
    },
    inputError: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerLight },
    fieldError: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.danger, marginTop: Spacing.xs },
    fieldOk: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.success, marginTop: Spacing.xs },
    btn: { marginTop: Spacing.xl },
  });
