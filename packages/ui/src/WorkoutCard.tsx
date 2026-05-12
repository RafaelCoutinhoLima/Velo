import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export type WorkoutType = 'easy' | 'interval' | 'tempo' | 'long' | 'rest' | 'cross';
export type WorkoutStatus = 'done' | 'today' | 'future' | 'rest';

export interface WorkoutCardProps {
  dayLabel: string;
  dateLabel?: string;
  type: WorkoutType;
  duration_min: number;
  distance_km: number;
  zones: number[];
  description: string;
  status: WorkoutStatus;
  isDragging?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TYPE_LABELS: Record<WorkoutType, string> = {
  easy: 'Corrida leve',
  interval: 'Intervalado',
  tempo: 'Tempo run',
  long: 'Long run',
  rest: 'Descanso',
  cross: 'Cross-training',
};

const STATUS_ICONS: Record<WorkoutStatus, string> = {
  done: '✅',
  today: '🟢',
  future: '⚪',
  rest: '💤',
};

const TYPE_ACCENT: Record<WorkoutType, string> = {
  easy: '#22c55e',
  interval: '#ef4444',
  tempo: '#f97316',
  long: '#3b82f6',
  rest: '#9ca3af',
  cross: '#a855f7',
};

export function WorkoutCard({
  dayLabel,
  dateLabel,
  type,
  duration_min,
  distance_km,
  zones,
  description,
  status,
  isDragging,
  style,
}: WorkoutCardProps) {
  const accent = TYPE_ACCENT[type];

  return (
    <View style={[styles.card, { borderLeftColor: accent }, isDragging && styles.dragging, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.statusIcon}>{STATUS_ICONS[status]}</Text>
          <View>
            <Text style={styles.dayLabel}>{dayLabel}</Text>
            {dateLabel ? <Text style={styles.dateLabel}>{dateLabel}</Text> : null}
          </View>
        </View>
        <Text style={[styles.typeChip, { backgroundColor: `${accent}20`, color: accent }]}>
          {TYPE_LABELS[type]}
        </Text>
      </View>

      {type !== 'rest' ? (
        <>
          <Text style={styles.stats}>
            {duration_min > 0 ? `${duration_min}min` : ''}
            {duration_min > 0 && distance_km > 0 ? ' · ' : ''}
            {distance_km > 0 ? `${distance_km}km` : ''}
            {zones.length > 0 ? `  Z${zones.join(' Z')}` : ''}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </>
      ) : (
        <Text style={styles.restText}>Recuperação ativa — sem treino prescrito</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dragging: {
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    opacity: 0.95,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIcon: {
    fontSize: 18,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  typeChip: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stats: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  restText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
