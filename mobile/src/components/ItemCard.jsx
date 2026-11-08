import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type, ui } from '../theme';
import StatusLabel from './StatusLabel';

// Turns an ISO date into the viewer's local date and time, e.g. "Oct 11, 2026, 3:28 PM".
const postedAt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// How long ago it was posted, for the stub: [big text, small text under it].
// "Now", "5m ago", "3h ago", "2d ago", then the date ("12 Oct") after a week.
export function age(iso, now = Date.now()) {
  const mins = Math.floor((now - new Date(iso)) / 60000);
  if (mins < 1) return ['Now', ''];
  if (mins < 60) return [`${mins}m`, 'ago'];
  if (mins < 60 * 24) return [`${Math.floor(mins / 60)}h`, 'ago'];
  if (mins < 60 * 24 * 7) return [`${Math.floor(mins / (60 * 24))}d`, 'ago'];
  const date = new Date(iso);
  return [String(date.getDate()), date.toLocaleString([], { month: 'short' })];
}

// Where it was found: "SW1 · 2nd floor, by the vending machines" (building is optional).
export const where = (item) => [item.building, item.location].filter(Boolean).join(' · ');

// A found item styled like a claim ticket: details on the left,
// a torn-off stub with how long ago it was posted on the right.
export default function ItemCard({ item, onPress }) {
  const [ageValue, ageLabel] = age(item.postedAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, found at ${where(item)}, ${postedAt(item.postedAt)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={type.meta}>{where(item)}</Text>
        {/* Open items need no label on the feed, unless your claim on it was turned down. */}
        {item.status !== 'open' || item.myClaim === 'rejected' ? <StatusLabel item={item} /> : null}
      </View>
      {/* Dashed divider between the details and the stub. */}
      <View style={styles.tear} />
      <View style={styles.stub}>
        <Text style={styles.ageValue}>{ageValue}</Text>
        {ageLabel ? <Text style={styles.ageLabel}>{ageLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...ui.card, flexDirection: 'row', marginBottom: spacing.md },
  pressed: { opacity: 0.85 },
  main: { flex: 1, padding: spacing.md, gap: 2 },
  title: { ...type.heading, marginBottom: 4 },
  tear: {
    width: 0,
    marginVertical: spacing.md,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  stub: { width: 72, alignItems: 'center', justifyContent: 'center' },
  ageValue: { fontSize: 20, fontWeight: '700', color: colors.teal },
  ageLabel: { fontSize: 13, color: colors.slate },
});
