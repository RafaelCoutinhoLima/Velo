// US-003 — Perfil esportivo
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radii, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';

type Sex = 'M' | 'F' | 'other';
type Frequency = '2x' | '3x' | '4x' | '5x+';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) => CURRENT_YEAR - 14 - i);

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

function YearPicker({ value, onChange }: { value: number | null; onChange: (y: number) => void }) {
  const listRef = useRef<FlatList>(null);
  const initialIndex = value ? YEARS.indexOf(value) : 0;

  return (
    <View style={picker.wrapper}>
      <FlatList
        ref={listRef}
        data={YEARS}
        horizontal
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={Math.max(0, initialIndex)}
        getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
        keyExtractor={(y) => String(y)}
        renderItem={({ item: year }) => (
          <TouchableOpacity
            style={[picker.item, value === year && picker.itemActive]}
            onPress={() => onChange(year)}
            accessibilityRole="button"
            accessibilityLabel={`Ano ${year}`}
            accessibilityState={{ selected: value === year }}
          >
            <Text style={[picker.itemText, value === year && picker.itemTextActive]}>
              {year}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: Spacing.xs }}
      />
      {value ? <Text style={picker.selected}>Selecionado: {value}</Text> : null}
    </View>
  );
}
const picker = StyleSheet.create({
  wrapper: { marginBottom: Spacing.sm },
  item: {
    width: 68,
    height: 48,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    backgroundColor: Colors.bg,
  },
  itemActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  itemText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  itemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  selected: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs, textAlign: 'center' },
});

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  labelMap,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  labelMap?: Partial<Record<T, string>>;
}) {
  return (
    <View style={chip.row}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[chip.base, value === opt && chip.active]}
          onPress={() => onChange(opt)}
          accessibilityRole="radio"
          accessibilityLabel={labelMap?.[opt] ?? opt}
          accessibilityState={{ selected: value === opt }}
        >
          <Text style={[chip.text, value === opt && chip.textActive]}>
            {labelMap?.[opt] ?? opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const chip = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  base: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  active: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  textActive: { color: Colors.primary, fontWeight: FontWeight.bold },
});

export default function ProfileScreen() {
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = birthYear !== null && weightKg.length > 0 && sex !== null && frequency !== null;

  async function next() {
    if (!isValid || !session?.athlete_id) return;
    const weight = Number(weightKg.replace(',', '.'));
    if (isNaN(weight) || weight < 30 || weight > 200) {
      setError('Peso inválido. Digite entre 30 e 200 kg.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await post('/onboarding/profile', {
        athlete_id: session.athlete_id,
        birth_year: birthYear,
        weight_kg: weight,
        sex,
        weekly_frequency: frequency,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.push('/onboarding/goal');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não conseguimos salvar seu perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ProgressBar step={1} total={4} />

        <Text style={styles.title}>Seu perfil</Text>
        <Text style={styles.subtitle}>Para calibrar os treinos corretamente</Text>

        {error ? <View style={{ marginBottom: Spacing.md }}><ErrorCard message={error} /></View> : null}

        <Text style={styles.label}>Ano de nascimento</Text>
        <YearPicker value={birthYear} onChange={setBirthYear} />

        <Text style={styles.label}>Peso (kg)</Text>
        <View style={styles.inputWrapper}>
          <View style={styles.input}>
            <Text style={styles.inputText}>{weightKg || ''}</Text>
          </View>
          <View style={styles.weightGrid}>
            {['40', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100'].map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.weightBtn, weightKg === w && styles.weightBtnActive]}
                onPress={() => setWeightKg(w)}
                accessibilityRole="radio"
                accessibilityLabel={`${w} kg`}
                accessibilityState={{ selected: weightKg === w }}
              >
                <Text style={[styles.weightBtnText, weightKg === w && styles.weightBtnTextActive]}>{w}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Sexo biológico</Text>
        <ChipGroup<Sex>
          options={['M', 'F', 'other']}
          value={sex}
          onChange={setSex}
          labelMap={{ M: 'Masculino', F: 'Feminino', other: 'Outro' }}
        />

        <Text style={styles.label}>Frequência semanal de treinos</Text>
        <ChipGroup<Frequency>
          options={['2x', '3x', '4x', '5x+']}
          value={frequency}
          onChange={setFrequency}
        />

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
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  inputWrapper: { marginBottom: Spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.md,
    backgroundColor: Colors.bg,
    marginBottom: Spacing.sm,
    minHeight: 50,
    justifyContent: 'center',
  },
  inputText: { fontSize: FontSize.md, color: Colors.textPrimary },
  weightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  weightBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    minWidth: 52,
    alignItems: 'center',
  },
  weightBtnActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  weightBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  weightBtnTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  btn: { marginTop: Spacing.xl },
});
