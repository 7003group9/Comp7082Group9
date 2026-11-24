import { useContext } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { usePhoto } from '../hooks';
import { colors, spacing, type, ui } from '../theme';
import StatusLabel from './StatusLabel';

// Turns an ISO date into the viewer's local date and time, e.g. "Oct 11, 2026, 3:28 PM".
export const postedAt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

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
  const photo = usePhoto(item.id, item.hasPhoto); // blurred by the server unless you may see it clearly
  const security = useContext(AuthContext).user?.role === 'security';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, found at ${where(item)}, ${postedAt(item.postedAt)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Thumbnail when the post has a photo (only the home feed sends hasPhoto).
          An empty square holds the space while it loads, so the card doesn't jump. */}
      {item.hasPhoto ? (
        photo ? <Image source={{ uri: photo }} style={styles.photo} accessibilityIgnoresInvertColors /> : <View style={styles.photo} />
      ) : null}
      <View style={styles.main}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={type.meta}>{where(item)}</Text>
        {/* Open items need no label on the feed, unless your claim on it was turned down,
            or (for Campus Security) it has sat unclaimed for 30+ days. */}
        {item.status !== 'open' || item.myClaim === 'rejected' || (security && item.flaggedUnclaimed) ? (
          <StatusLabel item={item} />
        ) : null}
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
  // Square thumbnail on the left, kept off the card's edges by its margins.
  photo: { width: 96, height: 96, borderRadius: 10, alignSelf: 'center', marginLeft: spacing.md, marginVertical: spacing.sm, backgroundColor: colors.mist },
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
  ageValue: { fontSize: 20, fontWeight: '700', color: colors.accent },
  ageLabel: { fontSize: 13, color: colors.slate },
});
