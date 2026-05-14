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
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';

type Sex = 'M' | 'F' | 'other';
type Frequency = '2x' | '3x' | '4x' | '5x+';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) => CURRENT_YEAR - 14 - i);
const ITEM_W = 80;
const ITEM_GAP = 8;

const WEIGHTS = ['40', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100', '105', '110', '120+'];

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <View style={pb.wrapper}>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${pct}%` as `${number}%` }]} />
      </View>
      <Text style={pb.label}>Passo {step + 1} de {total}</Text>
    </View>
  );
}
const pb = StyleSheet.create({
  wrapper: { marginBottom: Spacing.xl },
  track: { height: 4, backgroundColor: Colors.border, borderRadius: Radii.full, marginBottom: Spacing.sm },
  fill: { height: 4, backgroundColor: Colors.primary, borderRadius: Radii.full },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={[sc.card, Shadow.card]}>{children}</View>;
}
const sc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
});

function SectionTitle({ children }: { children: string }) {
  return <Text style={st.text}>{children}</Text>;
}
const st = StyleSheet.create({
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
});

function YearPicker({ value, onChange }: { value: number | null; onChange: (y: number) => void }) {
  const listRef = useRef<FlatList>(null);

  function handleSelect(year: number, index: number) {
    onChange(year);
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, 50);
  }

  return (
    <View>
      <View style={yp.displayRow}>
        <Text style={yp.displayValue}>{value ?? '—'}</Text>
        <Text style={yp.displayUnit}>ano</Text>
      </View>
      <FlatList
        ref={listRef}
        data={YEARS}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_W + ITEM_GAP}
        decelerationRate="fast"
        initialScrollIndex={value ? Math.max(0, YEARS.indexOf(value)) : 0}
        getItemLayout={(_, i) => ({ length: ITEM_W + ITEM_GAP, offset: (ITEM_W + ITEM_GAP) * i, index: i })}
        keyExtractor={(y) => String(y)}
        renderItem={({ item: year, index }) => (
          <TouchableOpacity
            style={[yp.item, value === year && yp.itemActive]}
            onPress={() => handleSelect(year, index)}
            accessibilityRole="button"
            accessibilityLabel={`Ano ${year}`}
            accessibilityState={{ selected: value === year }}
          >
            <Text style={[yp.itemText, value === year && yp.itemTextActive]}>{year}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: Spacing.xs }}
      />
    </View>
  );
}
const yp = StyleSheet.create({
  displayRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, marginBottom: Spacing.md },
  displayValue: { fontSize: FontSize['4xl'], fontWeight: FontWeight.extrabold, color: Colors.primary },
  displayUnit: { fontSize: FontSize.md, color: Colors.textMuted },
  item: {
    width: ITEM_W,
    height: 44,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ITEM_GAP,
    backgroundColor: Colors.bg,
  },
  itemActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  itemText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  itemTextActive: { color: Colors.surface, fontWeight: FontWeight.bold },
});

function WeightPicker({ value, onChange }: { value: string; onChange: (w: string) => void }) {
  const num = Number(value);
  return (
    <View>
      <View style={wp.displayRow}>
        <Text style={wp.displayValue}>{value || '—'}</Text>
        <Text style={wp.displayUnit}>kg</Text>
      </View>
      <View style={wp.grid}>
        {WEIGHTS.map((w) => (
          <TouchableOpacity
            key={w}
            style={[wp.btn, value === w && wp.btnActive]}
            onPress={() => onChange(w)}
            accessibilityRole="radio"
            accessibilityLabel={`${w} kg`}
            accessibilityState={{ selected: value === w }}
          >
            <Text style={[wp.btnText, value === w && wp.btnTextActive]}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {value && (num < 30 || num > 200) && (
        <Text style={wp.hint}>Digite entre 30 e 200 kg</Text>
      )}
    </View>
  );
}
const wp = StyleSheet.create({
  displayRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, marginBottom: Spacing.md },
  displayValue: { fontSize: FontSize['4xl'], fontWeight: FontWeight.extrabold, color: Colors.primary },
  displayUnit: { fontSize: FontSize.md, color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  btn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    minWidth: 52,
    alignItems: 'center',
  },
  btnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  btnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  btnTextActive: { color: Colors.surface, fontWeight: FontWeight.bold },
  hint: { fontSize: FontSize.xs, color: Colors.danger, marginTop: Spacing.sm },
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
      {options.map((opt) => {
        const label = labelMap?.[opt] ?? opt;
        const isActive = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[chip.base, isActive && chip.active]}
            onPress={() => onChange(opt)}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
          >
            {isActive && <View style={chip.dot} />}
            <Text style={[chip.text, isActive && chip.textActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const chip = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  active: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dot: { width: 6, height: 6, borderRadius: Radii.full, backgroundColor: Colors.surface },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  textActive: { color: Colors.surface, fontWeight: FontWeight.bold },
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

  function handleYearChange(y: number) { setError(null); setBirthYear(y); }
  function handleWeightChange(w: string) { setError(null); setWeightKg(w); }
  function handleSexChange(s: Sex) { setError(null); setSex(s); }
  function handleFreqChange(f: Frequency) { setError(null); setFrequency(f); }

  async function next() {
    if (!isValid || !session?.athlete_id) return;
    const weight = Number(weightKg.replace(',', '.').replace('+', ''));
    if (isNaN(weight) || weight < 30 || weight > 200) {
      setError('Peso inválido. Selecione entre 30 e 200 kg.');
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

        {error ? (
          <View style={{ marginBottom: Spacing.md }}>
            <ErrorCard message={error} />
          </View>
        ) : null}

        <SectionCard>
          <SectionTitle>Ano de nascimento</SectionTitle>
          <YearPicker value={birthYear} onChange={handleYearChange} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Peso</SectionTitle>
          <WeightPicker value={weightKg} onChange={handleWeightChange} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Sexo biológico</SectionTitle>
          <ChipGroup<Sex>
            options={['M', 'F', 'other']}
            value={sex}
            onChange={handleSexChange}
            labelMap={{ M: 'Masculino', F: 'Feminino', other: 'Outro' }}
          />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Frequência semanal de treinos</SectionTitle>
          <ChipGroup<Frequency>
            options={['2x', '3x', '4x', '5x+']}
            value={frequency}
            onChange={handleFreqChange}
          />
        </SectionCard>

        <Button
          label="Continuar"
          onPress={next}
          loading={loading}
          disabled={!isValid}
          style={styles.btn}
          accessibilityLabel="Continuar para próximo passo"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 },
  btn: { marginTop: Spacing.md },
});
