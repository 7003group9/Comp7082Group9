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
  // Campus Security hid the post (moderation). hidden is only sent to the finder (My
  // posts) and staff (Past posts); claimants it affected get myClaim 'post hidden'.
  if (item.hidden) return ['Hidden by Campus Security', 'rejected'];
  if (item.myClaim === 'post hidden') return ['Removed by Campus Security', 'rejected'];
  // Someone whose claim was turned down sees that, whatever happened to the item since.
  if (item.myClaim === 'rejected') return ["Your claim wasn't approved", 'rejected'];
  switch (item.status) {
    case 'open':
      // Nobody has claimed it in 30 days: time for Campus Security to deal with it.
      return item.flaggedUnclaimed ? ['Unclaimed 30+ days', 'rejected'] : ['Unclaimed', 'unclaimed'];
    case 'claim pending':
      return ['Claim pending', 'pending'];
    case 'claimed':
      return [approved ? 'Approved' : 'Claimed', 'claimed'];
    case 'dropped off':
      return [mine ? 'Dropped off' : approved ? 'Ready to pick up' : 'Claimed', 'claimed'];
    case 'handed off':
      return ['Picked up', 'claimed'];
    default:
      return null;
  }
}

const CLAIM = {
  pending: ['Pending review', 'pending'],
  approved: ['Approved', 'claimed'],
  rejected: ['Rejected', 'rejected'],
  'post hidden': ['Closed: post hidden', 'rejected'],
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
