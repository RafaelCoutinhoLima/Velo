import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Fonts, FontSize, FontWeight, Radii, Spacing, useTheme, type Theme } from '../lib/theme';

// Espelha o superset estruturado de apps/api/src/claude/schemas.ts
// (generation_spec.md §2.3). Campos opcionais — plano legado não os tem.
export type ZoneLabel = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';

export interface WarmCool {
  duracao_min: number;
  zona: ZoneLabel;
  pace_alvo?: string;
}

export interface PartePrincipal {
  descricao: string;
  zona_alvo: ZoneLabel;
  fc_alvo_bpm: { min: number; max: number };
  pace_alvo?: string;
  repeticoes?: number;
  duracao_repeticao_min?: number;
  recuperacao_min?: number;
  recuperacao_zona?: ZoneLabel;
}

export interface WorkoutStructureData {
  aquecimento?: WarmCool;
  parte_principal?: PartePrincipal;
  desaquecimento?: WarmCool;
  rtss_estimado?: number;
  notas_tecnicas?: string;
}

export function hasStructure(d: WorkoutStructureData): boolean {
  return !!(
    d.aquecimento ||
    d.parte_principal ||
    d.desaquecimento ||
    d.notas_tecnicas ||
    typeof d.rtss_estimado === 'number'
  );
}

function ZoneChip({ zona, styles }: { zona: ZoneLabel; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.zoneChip}>
      <Text style={styles.zoneChipText}>{zona}</Text>
    </View>
  );
}

function WarmCoolRow({
  label,
  block,
  styles,
}: {
  label: string;
  block: WarmCool;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <Text style={styles.rowDuration}>{block.duracao_min} min</Text>
          <ZoneChip zona={block.zona} styles={styles} />
          {block.pace_alvo ? <Text style={styles.rowPace}>{block.pace_alvo}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function MainRow({
  block,
  styles,
}: {
  block: PartePrincipal;
  styles: ReturnType<typeof createStyles>;
}) {
  const hasReps = typeof block.repeticoes === 'number' && block.repeticoes > 1;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>Parte principal</Text>
      <View style={styles.rowBody}>
        <Text style={styles.mainDesc}>{block.descricao}</Text>
        {hasReps ? (
          <View style={styles.repsBox}>
            <Text style={styles.repsText}>
              {block.repeticoes}×{' '}
              {block.duracao_repeticao_min ? `${block.duracao_repeticao_min} min ` : ''}
              <Text style={styles.repsZone}>{block.zona_alvo}</Text>
            </Text>
            {typeof block.recuperacao_min === 'number' ? (
              <Text style={styles.recoveryText}>
                recuperação {block.recuperacao_min} min
                {block.recuperacao_zona ? ` · ${block.recuperacao_zona}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.rowMeta}>
          <ZoneChip zona={block.zona_alvo} styles={styles} />
          <Text style={styles.rowPace}>
            {block.fc_alvo_bpm.min}–{block.fc_alvo_bpm.max} bpm
          </Text>
          {block.pace_alvo ? <Text style={styles.rowPace}>{block.pace_alvo}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export function WorkoutStructure({
  data,
  advancedMode,
}: {
  data: WorkoutStructureData;
  advancedMode: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(false);

  if (!hasStructure(data)) return null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Recolher estrutura do treino' : 'Ver estrutura do treino'}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.headerLabel}>Estrutura do treino</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          {data.aquecimento ? (
            <WarmCoolRow label="Aquecimento" block={data.aquecimento} styles={styles} />
          ) : null}
          {data.parte_principal ? <MainRow block={data.parte_principal} styles={styles} /> : null}
          {data.desaquecimento ? (
            <WarmCoolRow label="Desaquecimento" block={data.desaquecimento} styles={styles} />
          ) : null}

          {typeof data.rtss_estimado === 'number' ? (
            <View style={styles.loadGroup}>
              <View style={styles.loadChip}>
                <Text style={styles.loadChipText}>
                  Carga estimada · {Math.round(data.rtss_estimado)} rTSS
                </Text>
              </View>
              <Text style={styles.loadHint}>
                rTSS mede o peso total deste treino na sua semana de carga.
              </Text>
            </View>
          ) : null}

          {advancedMode && data.notas_tecnicas ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notas técnicas</Text>
              <Text style={styles.notesText}>{data.notas_tecnicas}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: Spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    headerLabel: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    chevron: { fontSize: FontSize.xs, color: theme.colors.textMuted },
    body: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },
    row: { gap: 4 },
    rowLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rowBody: { gap: Spacing.xs },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    rowDuration: {
      fontFamily: Fonts.data,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    rowPace: {
      fontFamily: Fonts.data,
      fontSize: FontSize.sm,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    mainDesc: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: theme.colors.textPrimary,
      lineHeight: 21,
    },
    repsBox: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: Radii.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      gap: 2,
    },
    repsText: {
      fontFamily: Fonts.data,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    repsZone: { color: theme.colors.primary },
    recoveryText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: theme.colors.textSecondary,
    },
    zoneChip: {
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    zoneChipText: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: theme.colors.primary,
    },
    loadGroup: { gap: Spacing.xs },
    loadChip: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentLight,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: 4,
    },
    loadChipText: {
      fontFamily: Fonts.data,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: theme.colors.accent,
      fontVariant: ['tabular-nums'],
    },
    loadHint: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: theme.colors.textMuted,
      lineHeight: 17,
    },
    notesBox: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: Spacing.sm,
      gap: 4,
    },
    notesLabel: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    notesText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: theme.colors.textSecondary,
      lineHeight: 19,
      fontStyle: 'italic',
    },
  });
