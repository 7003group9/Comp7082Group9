// Usage: <StatusLabel item={item} mine? /> or <StatusLabel claim="pending" />
import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

const TONE = {
  unclaimed: colors.line,
  pending: colors.tag,
  claimed: colors.tagDone,
  rejected: colors.tagRejected,
};

// Wording depends on who's looking: mine = the finder, myClaim = the viewer's own claim.
function forItem(item, mine) {
  const approved = item.myClaim === 'approved';
  switch (item.status) {
    case 'open':
      return ['Unclaimed', 'unclaimed'];
    case 'claim pending':
      return ['Claim pending', 'pending'];
    case 'claimed':
      return [approved ? 'Approved' : 'Claimed', 'claimed'];
    case 'dropped off':
      return [mine ? 'Dropped off' : approved ? 'Ready to collect' : 'Claimed', 'claimed'];
    case 'handed off':
      return ['Handed off', 'claimed'];
    default:
      return null;
  }
}

const CLAIM = {
  pending: ['Pending review', 'pending'],
  approved: ['Approved', 'claimed'],
  rejected: ['Rejected', 'rejected'],
};

export default function StatusLabel({ item, claim, mine = false }) {
  const label = item ? forItem(item, mine) : CLAIM[claim];
  if (!label) return null;
  const [text, tone] = label;
  return (
    <Text style={[styles.label, { backgroundColor: TONE[tone] }]} accessibilityLabel={`Status: ${text}`}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
