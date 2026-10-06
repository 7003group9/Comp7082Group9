import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

function timeAgo(iso) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// A found item styled like a claim ticket: details on the left,
// a torn-off stub with the item number on the right.
export default function ItemCard({ item, onPress }) {
  const pending = item.status !== 'open';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, found at ${item.location}, ${timeAgo(item.foundAt)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={type.meta}>{item.location}</Text>
        <Text style={type.meta}>{timeAgo(item.foundAt)}</Text>
        {pending && <Text style={styles.pending}>Claim pending</Text>}
      </View>
      <View style={styles.tear} />
      <View style={styles.stub}>
        <Text style={styles.no}>No.</Text>
        <Text style={styles.noValue}>{item.id}</Text>
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
  tear: {
    width: 0,
    marginVertical: spacing.md,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  stub: { width: 72, alignItems: 'center', justifyContent: 'center' },
  no: { fontSize: 13, color: colors.slate },
  noValue: { fontSize: 20, fontWeight: '700', color: colors.teal },
});
