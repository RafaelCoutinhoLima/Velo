import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { postFeedback } from '../lib/api';

type Rating = 'easy' | 'medium' | 'hard';

type Props = { workoutId: string; onDone: () => void };

const OPTIONS: { rating: Rating; emoji: string; label: string; color: string }[] = [
  { rating: 'easy', emoji: '😌', label: 'Fácil', color: '#dcfce7' },
  { rating: 'medium', emoji: '😐', label: 'Na medida', color: '#fef9c3' },
  { rating: 'hard', emoji: '😣', label: 'Difícil', color: '#fee2e2' },
];

export default function Feedback({ workoutId, onDone }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleFeedback(rating: Rating) {
    setLoading(true);
    try {
      const result = await postFeedback(workoutId, rating);
      if (result.recalibration_signal === 'reduce') {
        Alert.alert(
          'Ajustar plano?',
          'Seus últimos 3 treinos foram difíceis. Posso reduzir o volume em 15% para você se recuperar.',
          [{ text: 'Sim, ajustar', onPress: onDone }, { text: 'Não por agora', onPress: onDone }],
        );
      } else if (result.recalibration_signal === 'increase') {
        Alert.alert(
          'Evoluir plano?',
          'Seus últimos 3 treinos foram tranquilos. Posso aumentar o volume em 5%.',
          [{ text: 'Sim, evoluir', onPress: onDone }, { text: 'Não por agora', onPress: onDone }],
        );
      } else {
        onDone();
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Como foi o treino?</Text>
      <Text style={styles.subtitle}>Seu feedback ajuda a calibrar o plano.</Text>
      {OPTIONS.map(({ rating, emoji, label, color }) => (
        <TouchableOpacity
          key={rating}
          style={[styles.option, { backgroundColor: color }]}
          onPress={() => handleFeedback(rating)}
        >
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#6b7280', textAlign: 'center', marginBottom: 40 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderRadius: 12, padding: 20, marginBottom: 12,
  },
  emoji: { fontSize: 36 },
  label: { fontSize: 20, fontWeight: '600', color: '#111827' },
});
