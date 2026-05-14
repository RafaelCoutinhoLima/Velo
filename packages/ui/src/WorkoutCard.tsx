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
  easy: 'Regenerativo',
  interval: 'Intervalado',
  tempo: 'Tempo run',
  long: 'Long run',
  rest: 'Descanso',
  cross: 'Cross-training',
};

// matches apps/mobile/lib/theme.ts Colors
const TYPE_ACCENT: Record<WorkoutType, string> = {
  easy: '#10b981',
  interval: '#ef4444',
  tempo: '#f59e0b',
  long: '#1e40af',
  rest: '#94a3b8',
  cross: '#8b5cf6',
};

const STATUS_ACCENT: Record<WorkoutStatus, string> = {
  done: '#10b981',
  today: '#1e40af',
  future: '#94a3b8',
  rest: '#94a3b8',
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
  const statusColor = STATUS_ACCENT[status];
  const isToday = status === 'today';
  const isDone = status === 'done';

  return (
    <View
      style={[
        styles.card,
        { borderLeftColor: accent },
        isToday && styles.todayCard,
        isDragging && styles.dragging,
        style,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]}>
            {isDone && <Text style={styles.statusDotText}>✓</Text>}
          </View>
          <View>
            <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{dayLabel}</Text>
            {dateLabel ? <Text style={styles.dateLabel}>{dateLabel}</Text> : null}
          </View>
        </View>
        <View style={[styles.typeChip, { backgroundColor: `${accent}18` }]}>
          <Text style={[styles.typeChipText, { color: accent }]}>{TYPE_LABELS[type]}</Text>
        </View>
      </View>

      {type !== 'rest' ? (
        <>
          <View style={styles.statsRow}>
            {duration_min > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{duration_min}</Text>
                <Text style={styles.statUnit}>min</Text>
              </View>
            )}
            {distance_km > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{distance_km}</Text>
                <Text style={styles.statUnit}>km</Text>
              </View>
            )}
            {zones.length > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>Z{zones.join(' Z')}</Text>
                <Text style={styles.statUnit}>zona</Text>
              </View>
            )}
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </>
      ) : (
        <Text style={styles.restText}>Recuperação ativa — sem treino prescrito</Text>
      )}

      {isDragging && (
        <View style={styles.dragOverlay}>
          <Text style={styles.dragOverlayText}>☰ Solte em outro dia</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  todayCard: {
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderLeftWidth: 5,
  },
  dragging: {
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    opacity: 0.95,
    transform: [{ scale: 1.01 }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  dayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  dayLabelToday: { color: '#1e40af' },
  dateLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  statUnit: {
    fontSize: 11,
    color: '#94a3b8',
  },
  description: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  restText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  dragOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    backgroundColor: '#1e40af22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dragOverlayText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
  },
});
