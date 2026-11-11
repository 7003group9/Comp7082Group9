// A rejected claim counts as a wrong attempt. After this many, the person can't
// make new claims in the app and is sent to Campus Security instead.
export const MAX_REJECTED_CLAIMS = 3;
export const isLockedOut = (rejectedClaims) => rejectedClaims >= MAX_REJECTED_CLAIMS;
