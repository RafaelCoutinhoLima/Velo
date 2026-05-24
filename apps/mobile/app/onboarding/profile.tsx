import { useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useApi } from '../../lib/api';
import { Fonts, FontSize, FontWeight, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';
import { Button } from '../../components/Button';
import { ErrorCard } from '../../components/ErrorCard';
import { StepBar } from '../../components/StepBar';

type Frequency = '2x' | '3x' | '4x' | '5x+';
type Sex = 'M' | 'F';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) => CURRENT_YEAR - 14 - i);
const ITEM_W = 72;
const ITEM_GAP = 8;

const FREQ_LABELS: Record<Frequency, string> = {
  '2x': '2× por semana',
  '3x': '3× por semana',
  '4x': '4× por semana',
  '5x+': '5× ou mais',
};

export default function ProfileScreen() {
  const session = useAuthStore((s) => s.session);
  const { post } = useApi();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = birthYear !== null && weightKg.length > 0 && sex !== null && frequency !== null;

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

  function SectionCard({ children }: { children: React.ReactNode }) {
    return <View style={styles.sectionCard}>{children}</View>;
  }

  function SectionTitle({ children }: { children: string }) {
    return <Text style={styles.sectionTitle}>{children}</Text>;
  }

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
        <View style={styles.pickerDisplay}>
          <Text style={styles.pickerValue}>{value ?? '—'}</Text>
          <Text style={styles.pickerUnit}>ano</Text>
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
              style={[styles.yearItem, value === year && styles.yearItemActive]}
              onPress={() => handleSelect(year, index)}
              accessibilityRole="button"
              accessibilityLabel={`Ano ${year}`}
              accessibilityState={{ selected: value === year }}
            >
              <Text style={[styles.yearText, value === year && styles.yearTextActive]}>{year}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: Spacing.xs }}
        />
      </View>
    );
  }

  function WeightPicker({ value, onChange }: { value: string; onChange: (w: string) => void }) {
    return (
      <View style={styles.weightRow}>
        <TextInput
          style={styles.weightInput}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted}
          maxLength={6}
          accessibilityLabel="Peso em kg"
        />
        <Text style={styles.pickerUnit}>kg</Text>
      </View>
    );
  }

  function OptionGrid<T extends string>({
    options,
    value,
    onChange,
    render,
    labelFor,
  }: {
    options: T[];
    value: T | null;
    onChange: (v: T) => void;
    render: (opt: T, active: boolean) => React.ReactNode;
    labelFor: (opt: T) => string;
  }) {
    return (
      <View style={styles.optGrid}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.optCard, active && styles.optCardActive]}
              onPress={() => onChange(opt)}
              accessibilityRole="radio"
              accessibilityLabel={labelFor(opt)}
              accessibilityState={{ selected: active }}
            >
              {render(opt, active)}
              {active ? (
                <View style={styles.optCheck}>
                  <Ionicons name="checkmark" size={12} color={theme.colors.onAccent} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>Perfil esportivo</Text>
          <Text style={styles.subtitle}>Para calibrar seus treinos com precisão</Text>
        </View>

        <StepBar current={0} />

        {error ? (
          <View style={{ marginBottom: Spacing.md }}>
            <ErrorCard message={error} />
          </View>
        ) : null}

        <SectionCard>
          <SectionTitle>Ano de nascimento</SectionTitle>
          <YearPicker value={birthYear} onChange={(y) => { setError(null); setBirthYear(y); }} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Peso corporal</SectionTitle>
          <WeightPicker value={weightKg} onChange={(w) => { setError(null); setWeightKg(w); }} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Sexo biológico</SectionTitle>
          <OptionGrid<Sex>
            options={['M', 'F']}
            value={sex}
            onChange={(s) => { setError(null); setSex(s); }}
            labelFor={(s) => (s === 'M' ? 'Masculino' : 'Feminino')}
            render={(s, active) => (
              <Text style={[styles.optBig, active && styles.optBigActive]}>
                {s === 'M' ? 'Masculino' : 'Feminino'}
              </Text>
            )}
          />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Frequência semanal</SectionTitle>
          <OptionGrid<Frequency>
            options={['2x', '3x', '4x', '5x+']}
            value={frequency}
            onChange={(f) => { setError(null); setFrequency(f); }}
            labelFor={(f) => FREQ_LABELS[f]}
            render={(f, active) => (
              <>
                <Text style={[styles.optBig, active && styles.optBigActive]}>{f}</Text>
                <Text style={[styles.optSub, active && styles.optSubActive]}>
                  {FREQ_LABELS[f].replace(f + ' ', '')}
                </Text>
              </>
            )}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
    hero: { marginBottom: Spacing.lg },
    title: { ...theme.type.display, color: theme.colors.textPrimary },
    subtitle: { ...theme.type.body, color: theme.colors.textMuted, marginTop: Spacing.xs },
    btn: { marginTop: Spacing.sm },

    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    sectionTitle: { ...theme.type.label, color: theme.colors.textMuted, marginBottom: Spacing.md },

    pickerDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, marginBottom: Spacing.md },
    pickerValue: {
      fontFamily: Fonts.displayBlack,
      fontSize: FontSize['4xl'],
      fontWeight: FontWeight.extrabold,
      color: theme.colors.primary,
    },
    pickerUnit: { ...theme.type.body, color: theme.colors.textMuted },

    yearItem: {
      width: ITEM_W,
      height: 44,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: ITEM_GAP,
      backgroundColor: theme.colors.surfaceAlt,
    },
    yearItemActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    yearText: { fontFamily: Fonts.data, fontSize: FontSize.sm, color: theme.colors.textSecondary },
    yearTextActive: { color: theme.colors.onAccent },

    weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    weightInput: {
      fontFamily: Fonts.displayBlack,
      fontSize: FontSize['4xl'],
      fontWeight: FontWeight.extrabold,
      color: theme.colors.primary,
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primary,
      minWidth: 100,
      paddingVertical: Spacing.xs,
      textAlign: 'center',
    },

    optGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    optCard: {
      flexGrow: 1,
      flexBasis: '45%',
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    optCardActive: { backgroundColor: theme.colors.primaryMuted, borderColor: theme.colors.primary },
    optBig: {
      fontFamily: Fonts.display,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.extrabold,
      color: theme.colors.textPrimary,
    },
    optBigActive: { color: theme.colors.primary },
    optSub: { ...theme.type.bodySm, fontSize: FontSize.xs, color: theme.colors.textMuted, marginTop: 2 },
    optSubActive: { color: theme.colors.primary },
    optCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
