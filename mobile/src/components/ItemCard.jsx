import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

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

// Status badge for anything not 'open'. Claimed items are green. The person whose
// claim was approved sees "Approved", then "Ready to collect" once the finder has
// dropped it off; the finder (mine, in My posts) sees "Dropped off"; others see "Claimed".
export function StatusBadge({ item, mine = false }) {
  const done = (text) => <Text style={[styles.pending, styles.done]}>{text}</Text>;
  const approved = item.myClaim === 'approved';
  if (item.status === 'claimed') return done(approved ? 'Approved' : 'Claimed');
  if (item.status === 'dropped off') return done(mine ? 'Dropped off' : approved ? 'Ready to collect' : 'Claimed');
  if (item.status === 'claim pending') return <Text style={styles.pending}>Claim pending</Text>;
  return null;
}

// A found item styled like a claim ticket: details on the left,
// a torn-off stub with how long ago it was posted on the right.
export default function ItemCard({ item, onPress }) {
  const [ageValue, ageLabel] = age(item.postedAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, found at ${[item.building, item.location].filter(Boolean).join(' · ')}, ${postedAt(item.postedAt)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={type.meta}>{[item.building, item.location].filter(Boolean).join(' · ')}</Text>
        <StatusBadge item={item} />
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
  card: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: 12,
    marginBottom: spacing.md,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: { opacity: 0.85 },
  main: { flex: 1, padding: spacing.md, gap: 2 },
  title: { ...type.heading, marginBottom: 4 },
  pending: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.tag,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
  done: { backgroundColor: colors.tagDone },
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
