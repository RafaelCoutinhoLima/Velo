// US-004 — Prova alvo ou modo progressão geral
import { useState } from 'react';
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
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';

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

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={progress.wrapper}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[progress.dot, i < step && progress.done, i === step && progress.active]} />
      ))}
      <Text style={progress.label}>Passo {step + 1} de {total}</Text>
    </View>
  );
}
const progress = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radii.full, backgroundColor: Colors.border },
  active: { backgroundColor: Colors.primary, width: 24, borderRadius: Radii.full },
  done: { backgroundColor: Colors.primaryMuted },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: Spacing.sm },
});

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
        <ProgressBar step={2} total={4} />

        <Text style={styles.title}>Seu objetivo</Text>
        <Text style={styles.subtitle}>Isso define como o plano é construído</Text>

        {error ? <View style={{ marginBottom: Spacing.md }}><ErrorCard message={error} /></View> : null}

        <TouchableOpacity
          style={[styles.modeCard, mode === 'race' && styles.modeCardActive]}
          onPress={() => setMode('race')}
          accessibilityRole="radio"
          accessibilityLabel="Tenho uma prova alvo"
          accessibilityState={{ selected: mode === 'race' }}
        >
          <Text style={styles.modeIcon}>🏁</Text>
          <View style={styles.modeBody}>
            <Text style={[styles.modeTitle, mode === 'race' && styles.modeTitleActive]}>
              Tenho uma prova alvo
            </Text>
            <Text style={styles.modeDesc}>Preparação periodizada para uma data específica</Text>
          </View>
          {mode === 'race' && <View style={styles.checkDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, mode === 'general_progression' && styles.modeCardActive]}
          onPress={() => setMode('general_progression')}
          accessibilityRole="radio"
          accessibilityLabel="Quero evoluir gradualmente"
          accessibilityState={{ selected: mode === 'general_progression' }}
        >
          <Text style={styles.modeIcon}>📈</Text>
          <View style={styles.modeBody}>
            <Text style={[styles.modeTitle, mode === 'general_progression' && styles.modeTitleActive]}>
              Quero evoluir gradualmente
            </Text>
            <Text style={styles.modeDesc}>Sem prova definida — foco em base e progressão</Text>
          </View>
          {mode === 'general_progression' && <View style={styles.checkDot} />}
        </TouchableOpacity>

        {mode === 'race' && (
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
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel="Data da prova"
            />
            {dateError ? (
              <Text style={styles.fieldError}>{dateError}</Text>
            ) : raceDate.length === 10 ? (
              <Text style={styles.fieldOk}>✓ Data válida</Text>
            ) : null}
          </>
        )}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, marginBottom: Spacing.lg },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    backgroundColor: Colors.bg,
  },
  modeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  modeIcon: { fontSize: 32 },
  modeBody: { flex: 1 },
  modeTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 2 },
  modeTitleActive: { color: Colors.primary },
  modeDesc: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
  },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  distanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  distanceCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
  distanceCardActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  distanceText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold, textAlign: 'center', lineHeight: 16 },
  distanceTextActive: { color: Colors.primary },
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
  inputError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  fieldError: { fontSize: FontSize.xs, color: Colors.danger, marginTop: Spacing.xs },
  fieldOk: { fontSize: FontSize.xs, color: Colors.success, marginTop: Spacing.xs },
  btn: { marginTop: Spacing.xl },
});
