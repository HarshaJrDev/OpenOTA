import type { RuntimeState } from '@openota/shared';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { stateColors } from '../theme/theme';

const MAIN_CHAIN: RuntimeState[] = ['EMBEDDED', 'DOWNLOADED', 'VERIFIED', 'EXTRACTED', 'INSTALLED', 'ACTIVATED', 'ROLLBACK'];

interface Props {
  active: RuntimeState | null;
}

export function StateMachineDiagram({ active }: Props): React.JSX.Element {
  const theme = useTheme();

  return (
    <View>
      <View style={styles.chain}>
        {MAIN_CHAIN.map((state, index) => (
          <React.Fragment key={state}>
            <StateNode state={state} isActive={state === active} />
            {index < MAIN_CHAIN.length - 1 ? (
              <Text style={[styles.arrow, { color: theme.colors.onSurfaceVariant }]}>↓</Text>
            ) : null}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.branchRow}>
        <Text style={[styles.arrow, { color: theme.colors.onSurfaceVariant }]}>⇥</Text>
        <StateNode state="FAILED" isActive={active === 'FAILED'} compact />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          reachable from any non-terminal state
        </Text>
      </View>
    </View>
  );
}

function StateNode({ state, isActive, compact }: { state: RuntimeState; isActive: boolean; compact?: boolean }) {
  const theme = useTheme();
  const color = stateColors[state];

  return (
    <View
      style={[
        styles.node,
        compact && styles.nodeCompact,
        {
          borderColor: color,
          backgroundColor: isActive ? color : theme.colors.surface,
        },
      ]}>
      <Text
        variant={compact ? 'labelMedium' : 'titleSmall'}
        style={{ color: isActive ? theme.colors.surface : color, fontWeight: isActive ? '700' : '500' }}>
        {state}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chain: {
    alignItems: 'center',
    gap: 2,
  },
  node: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  nodeCompact: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  arrow: {
    fontSize: 18,
    lineHeight: 20,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});
