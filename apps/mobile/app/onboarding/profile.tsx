import { useRef, useState } from 'react';
import {
  FlatList,
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
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';

type Frequency = '2x' | '3x' | '4x' | '5x+';
type Sex = 'M' | 'F';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) => CURRENT_YEAR - 14 - i);
const ITEM_W = 72;
const ITEM_GAP = 8;


const STEPS = ['Perfil', 'Objetivo', 'Garmin', 'Pronto'];

function StepBar({ current }: { current: number }) {
  return (
    <View style={sb.row}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={sb.stepWrap}>
            <View style={[sb.pill, done && sb.pillDone, active && sb.pillActive]}>
              {done ? (
                <Text style={sb.pillTextDone}>✓</Text>
              ) : (
                <Text style={[sb.pillNum, active && sb.pillNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[sb.label, active && sb.labelActive, done && sb.labelDone]}>{label}</Text>
            {i < STEPS.length - 1 && <View style={[sb.connector, done && sb.connectorDone]} />}
          </View>
        );
      })}
    </View>
  );
}

const sb = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    gap: 0,
  },
  stepWrap: {
    alignItems: 'center',
    position: 'relative',
    flex: 1,
  },
  pill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    zIndex: 1,
  },
  pillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  pillDone: {
    borderColor: Colors.success,
    backgroundColor: Colors.success,
  },
  pillNum: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
  },
  pillNumActive: {
    color: Colors.surface,
  },
  pillTextDone: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.surface,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  labelDone: {
    color: Colors.success,
  },
  connector: {
    position: 'absolute',
    top: 15,
    right: '-50%',
    left: '50%',
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 0,
  },
  connectorDone: {
    backgroundColor: Colors.success,
  },
});

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={[sc.card, Shadow.card]}>{children}</View>;
}
const sc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
  return (
    <View style={wp.row}>
      <TextInput
        style={wp.input}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        maxLength={6}
        accessibilityLabel="Peso em kg"
      />
      <Text style={wp.unit}>kg</Text>
    </View>
  );
}
const wp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  input: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    minWidth: 100,
    paddingVertical: Spacing.xs,
    textAlign: 'center',
  },
  unit: { fontSize: FontSize.md, color: Colors.textMuted },
});

const FREQ_LABELS: Record<Frequency, string> = {
  '2x': '2× por semana',
  '3x': '3× por semana',
  '4x': '4× por semana',
  '5x+': '5× ou mais',
};

function FreqPicker({ value, onChange }: { value: Frequency | null; onChange: (f: Frequency) => void }) {
  const options: Frequency[] = ['2x', '3x', '4x', '5x+'];
  return (
    <View style={fp.grid}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[fp.card, active && fp.cardActive]}
            onPress={() => onChange(opt)}
            accessibilityRole="radio"
            accessibilityLabel={FREQ_LABELS[opt]}
            accessibilityState={{ selected: active }}
          >
            <Text style={[fp.freq, active && fp.freqActive]}>{opt}</Text>
            <Text style={[fp.label, active && fp.labelActive]}>
              {FREQ_LABELS[opt].replace(opt + ' ', '')}
            </Text>
            {active && <View style={fp.check}><Text style={fp.checkText}>✓</Text></View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const SEX_LABELS: Record<Sex, string> = {
  M: 'Masculino',
  F: 'Feminino',
};

function SexPicker({ value, onChange }: { value: Sex | null; onChange: (s: Sex) => void }) {
  const options: Sex[] = ['M', 'F'];
  return (
    <View style={fp.grid}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[fp.card, active && fp.cardActive]}
            onPress={() => onChange(opt)}
            accessibilityRole="radio"
            accessibilityLabel={SEX_LABELS[opt]}
            accessibilityState={{ selected: active }}
          >
            <Text style={[fp.freq, active && fp.freqActive]}>{SEX_LABELS[opt]}</Text>
            {active && <View style={fp.check}><Text style={fp.checkText}>✓</Text></View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const fp = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    position: 'relative',
  },
  cardActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  freq: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: 2 },
  freqActive: { color: Colors.primary },
  label: { fontSize: FontSize.xs, color: Colors.textMuted },
  labelActive: { color: Colors.primary },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 10, color: Colors.surface, fontWeight: FontWeight.bold },
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

        <View style={styles.heroSection}>
          <Text style={styles.title}>Configure{'\n'}seu perfil</Text>
          <Text style={styles.subtitle}>Para calibrar seus treinos com precisão</Text>
        </View>

        <StepBar current={1} />

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
          <SectionTitle>Peso corporal</SectionTitle>
          <WeightPicker value={weightKg} onChange={handleWeightChange} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Sexo biológico</SectionTitle>
          <SexPicker value={sex} onChange={handleSexChange} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Frequência semanal</SectionTitle>
          <FreqPicker value={frequency} onChange={handleFreqChange} />
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
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  heroSection: { marginBottom: Spacing.xl },
  title: {
    fontSize: 32,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    lineHeight: 40,
    marginBottom: Spacing.xs,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, lineHeight: 22 },
  btn: { marginTop: Spacing.sm },
});
