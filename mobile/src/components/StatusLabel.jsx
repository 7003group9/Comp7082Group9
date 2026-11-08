// Coloured status label for an item or a claim (from Sami's StatusLabel).
// Usage: <StatusLabel item={item} mine? /> or <StatusLabel claim="pending" />
import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

// Each tone is a tinted background with bright text.
const TONE = {
  unclaimed: [colors.line, colors.slate],
  pending: [colors.tag, colors.tagText],
  claimed: [colors.tagDone, colors.tagDoneText],
  rejected: [colors.tagNo, colors.tagNoText],
};

// Wording depends on who's looking: mine = the finder, myClaim = the viewer's own claim.
function forItem(item, mine) {
  const approved = item.myClaim === 'approved';
  // Someone whose claim was turned down sees that, whatever happened to the item since.
  if (item.myClaim === 'rejected') return ["Your claim wasn't approved", 'rejected'];
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
  const [background, color] = TONE[tone];
  return (
    <Text style={[styles.label, { backgroundColor: background, color }]} accessibilityLabel={`Status: ${text}`}>
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
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
