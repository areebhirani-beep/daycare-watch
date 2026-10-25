import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from 'react-native';

import { useLastSync } from '@/lib/api';
import { formatCheckedAt } from '@/lib/format';
import { minTap, radius, space, useColors } from '@/theme';
import { haptic } from '@/theme/haptics';

import { Icon, type IconName } from './Icon';
import { T } from './T';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  kind?: 'primary' | 'secondary' | 'plain';
  icon?: IconName;
  style?: ViewStyle;
};

export function Button({ label, kind = 'primary', icon, style, onPress, disabled, ...rest }: ButtonProps) {
  const c = useColors();
  // Disabled reads as inert paper rather than faded teal.
  const bg = disabled && kind !== 'plain' ? c.sunken : kind === 'primary' ? c.accent : kind === 'secondary' ? c.surface : 'transparent';
  const fg = disabled ? c.textTertiary : kind === 'primary' ? c.onAccent : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={(e) => {
        haptic.select();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: pressed && !disabled ? 0.8 : 1 },
        kind === 'secondary' && { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
        style,
      ]}
      {...rest}
    >
      {icon ? <Icon name={icon} color={fg} size={16} weight="semibold" /> : null}
      <T variant="headline" color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** A full-width tappable row with a chevron, 44 pt minimum. */
export function RowLink({
  title,
  detail,
  onPress,
  external,
  accessibilityHint,
  flush,
}: {
  title: string;
  detail?: string;
  onPress: () => void;
  external?: boolean;
  accessibilityHint?: string;
  /** No side padding, for rows set straight on the page under a heading rather than in a Surface. */
  flush?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, flush && { paddingHorizontal: 0 }, pressed && { backgroundColor: c.sunken }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="headline">{title}</T>
        {detail ? (
          <T variant="footnote" tone="secondary">
            {detail}
          </T>
        ) : null}
      </View>
      <Icon name={external ? 'external' : 'chevronRight'} size={14} color={c.textTertiary} />
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <T variant="caption" tone="secondary" accessibilityRole="header" style={styles.sectionLabel}>
      {children.toUpperCase()}
    </T>
  );
}

export function Rule({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

export function Surface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: c.surface, borderColor: c.hairline },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Required on every data screen (CONTRACT 3): read from ops.sync_runs via last_sync(). */
export function LastChecked({ fallback }: { fallback?: string | null }) {
  const { data } = useLastSync();
  const ts = data?.finished_at ?? fallback ?? null;
  return (
    <T variant="callout" tone="tertiary" style={styles.lastChecked}>
      Last checked with the state {formatCheckedAt(ts)}
    </T>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTap + 4,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  row: {
    minHeight: minTap + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  sectionLabel: { marginBottom: space.sm },
  surface: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  lastChecked: { paddingVertical: space.lg },
});
