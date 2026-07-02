// Perfil de Intensidade — componente-assinatura da identidade Velo.
// Uma barra por segmento do treino: largura proporcional aos minutos,
// altura proporcional à intensidade da zona, cor da zona. Reutilizado no
// hero da home (mini), detalhe do treino (detail com eixo + legenda), chat
// (proposta de estrutura) e treino concluído.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, useTheme, type Theme, type ZoneCode } from '../lib/theme';
import type { WorkoutStructureData } from './WorkoutStructure';

export interface ProfileSegment {
  zone: ZoneCode;
  minutes: number;
}

// Altura relativa de cada zona no perfil (spec do handoff).
const ZONE_HEIGHT: Record<ZoneCode, number> = {
  Z1: 0.2,
  Z2: 0.38,
  Z3: 0.6,
  Z4: 0.82,
  Z5: 1,
};

export const ZONE_NAMES: Record<ZoneCode, string> = {
  Z1: 'Recuperação',
  Z2: 'Base aeróbica',
  Z3: 'Tempo',
  Z4: 'Limiar',
  Z5: 'VO₂máx',
};

// Expande a estrutura vinda da API (aquecimento / parte principal com
// repetições / desaquecimento) na sequência linear de segmentos do perfil.
// Ex.: Cruise Intervals 65min → Z2·15 / [Z4·8 + Z1·2]×4 / Z1·10.
export function segmentsFromStructure(data: WorkoutStructureData): ProfileSegment[] {
  const segments: ProfileSegment[] = [];

  if (data.aquecimento) {
    segments.push({ zone: data.aquecimento.zona, minutes: data.aquecimento.duracao_min });
  }

  const main = data.parte_principal;
  if (main) {
    const reps = main.repeticoes && main.repeticoes > 1 ? main.repeticoes : 1;
    const workMin = main.duracao_repeticao_min ?? 0;
    for (let i = 0; i < reps; i++) {
      if (workMin > 0) segments.push({ zone: main.zona_alvo, minutes: workMin });
      // Recuperação entre repetições (não após a última)
      if (i < reps - 1 && main.recuperacao_min) {
        segments.push({ zone: main.recuperacao_zona ?? 'Z1', minutes: main.recuperacao_min });
      }
    }
  }

  if (data.desaquecimento) {
    segments.push({ zone: data.desaquecimento.zona, minutes: data.desaquecimento.duracao_min });
  }

  return segments;
}

export function WorkoutProfile({
  segments,
  variant = 'detail',
}: {
  segments: ProfileSegment[];
  variant?: 'detail' | 'mini';
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (segments.length === 0) return null;

  const barsHeight = variant === 'mini' ? 34 : 104;
  const totalMin = Math.round(segments.reduce((acc, s) => acc + s.minutes, 0));
  const zonesUsed = ([...new Set(segments.map((s) => s.zone))] as ZoneCode[]).sort();

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Perfil de intensidade do treino, ${totalMin} minutos`}
    >
      <View style={[styles.bars, { height: barsHeight }]}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                flexGrow: seg.minutes,
                height: `${ZONE_HEIGHT[seg.zone] * 100}%`,
                backgroundColor: theme.colors.zones[seg.zone].color,
              },
            ]}
          />
        ))}
      </View>

      {variant === 'detail' ? (
        <>
          <View style={styles.axis}>
            <Text style={styles.axisText}>0</Text>
            <Text style={styles.axisText}>{Math.round(totalMin / 2)}</Text>
            <Text style={styles.axisText}>{totalMin}min</Text>
          </View>
          <View style={styles.legend}>
            {zonesUsed.map((zone) => (
              <View key={zone} style={styles.legendItem}>
                <View
                  style={[styles.legendSwatch, { backgroundColor: theme.colors.zones[zone].color }]}
                />
                <Text style={styles.legendCode}>{zone}</Text>
                <Text style={styles.legendName}>{ZONE_NAMES[zone]}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 2,
      borderBottomWidth: 1.5,
      borderBottomColor: theme.colors.border,
    },
    bar: {
      flexBasis: 0,
      minWidth: 2,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
    },
    axis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 5,
    },
    axisText: {
      fontFamily: Fonts.data,
      fontSize: 10,
      color: theme.colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 3,
    },
    legendCode: {
      fontFamily: Fonts.dataSemiBold,
      fontSize: 11,
      color: theme.colors.textPrimary,
    },
    legendName: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
  });
