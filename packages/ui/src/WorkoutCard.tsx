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

// Performance Dark — espelha apps/mobile/lib/theme.ts Colors
const TYPE_ACCENT: Record<WorkoutType, string> = {
  easy: '#3DDC84',
  interval: '#FF5C5C',
  tempo: '#F5A623',
  long: '#5B8DEF',
  rest: '#5C6B7A',
  cross: '#A98BFF',
};

const STATUS_ACCENT: Record<WorkoutStatus, string> = {
  done: '#3DDC84',
  today: '#C8FF3D',
  future: '#5C6B7A',
  rest: '#5C6B7A',
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
    backgroundColor: '#131A24',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#232C38',
    borderLeftWidth: 4,
  },
  todayCard: {
    backgroundColor: '#161F12',
    borderColor: '#33414F',
    borderLeftWidth: 5,
    shadowColor: '#C8FF3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  dragging: {
    shadowColor: '#C8FF3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
    opacity: 0.97,
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
  statusDotText: { fontSize: 10, color: '#0A0E14', fontWeight: '900' },
  dayLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E8EDF2',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayLabelToday: { color: '#C8FF3D' },
  dateLabel: {
    fontSize: 11,
    color: '#5C6B7A',
    marginTop: 1,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E8EDF2',
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 11,
    color: '#5C6B7A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    color: '#9AA7B5',
    lineHeight: 19,
  },
  restText: {
    fontSize: 13,
    color: '#5C6B7A',
    fontStyle: 'italic',
  },
  dragOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    backgroundColor: 'rgba(200,255,61,0.16)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dragOverlayText: {
    fontSize: 11,
    color: '#C8FF3D',
    fontWeight: '800',
  },
});
