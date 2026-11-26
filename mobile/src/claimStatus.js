// What a claimant is told about their claim: a highlighted headline in the status colour,
// then what to do next. Used by the item screen and Notifications, so they always agree.
import { colors } from './theme';

export const CLAIM_STATUS = {
  pending: { headline: 'Your claim was sent.', next: 'Campus Security will check your answers. Check back here for the result.', color: colors.tagWait, text: colors.tagWaitText },
  approved: { headline: 'Your claim was approved.', next: "The finder is dropping it off at Campus Security. Check back here to see when it's ready to pick up.", color: colors.tagDone, text: colors.tagDoneText },
  // Approved, and Campus Security has marked the item received.
  ready: { headline: 'Your item is ready to pick up.', next: 'Collect it from the Campus Security desk.', color: colors.tagDone, text: colors.tagDoneText },
  // Approved, and Campus Security recorded that you picked it up.
  collected: { headline: 'You picked this up.', next: 'Glad you got it back!', color: colors.tagDone, text: colors.tagDoneText },
  rejected: { headline: "Your claim wasn't approved.", next: 'If this really is yours, visit Campus Security with proof.', color: colors.tagNo, text: colors.tagNoText },
  // The post was hidden while this claim was pending.
  'post hidden': { headline: 'This post was hidden by Campus Security.', next: "Your claim was closed and doesn't count against you. If this is yours, visit Campus Security.", color: colors.tagNo, text: colors.tagNoText },
};

// Which CLAIM_STATUS entry applies: the claim's status, except an approved claim moves on
// as the item does (at the desk = ready to pick up, handed off = collected).
export const claimStage = (myClaim, itemStatus) =>
  myClaim !== 'approved' ? myClaim : ({ 'dropped off': 'ready', 'handed off': 'collected' }[itemStatus] ?? 'approved');
