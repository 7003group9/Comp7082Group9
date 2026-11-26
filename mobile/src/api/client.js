// Address of the server API; set VITE_API_URL in mobile/.env (see .env.example).
const API_URL = import.meta.env.VITE_API_URL;

// An item's photo as a local blob: URL for <Image source={{ uri }}>. Fetched with the
// login token because the server only gives the finder, Campus Security and the approved
// owner the clear photo (a plain <Image src> can't send the token). Revoke the URL when
// done; usePhoto does. thumb: the small copy for feed cards instead of the large one.
export async function fetchPhotoUrl(itemId, token, thumb = false) {
  const res = await fetch(`${API_URL}/items/${itemId}/photo${thumb ? '?size=thumb' : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Photo failed to load (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

// Called when the server rejects our login token (expired, invalid, or the account was
// suspended) so the app can send the user back to the login screen, with the server's
// reason when it gave one. AuthProvider sets it.
let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

// Call the API and return the parsed reply ({} when there is no body);
// throws the server's error message, with err.fields = { field: message } when
// the server said which fields were wrong. Pass the login token for protected routes.
// A FormData body (posts with photos) is sent as a multipart form.
async function send(method, path, body, token) {
  if (!API_URL) throw new Error("API URL is not configured");
  const form = body instanceof FormData; // the browser sets the multipart header itself
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(!form && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: form ? body : body && JSON.stringify(body),
    });
  } catch {
    // No reply at all: offline, or the server is down. (The browser only says "Failed to fetch".)
    throw Object.assign(new Error("Can't reach the server. Check your connection and try again."), { retry: true });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onSessionExpired(data?.suspended ? data.error : null); // we sent a token and it was refused
  if (!res.ok) {
    // retry: trying again later could work (server error or too many attempts), unlike e.g. a 403.
    const retry = res.status >= 500 || res.status === 429;
    throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { fields: data?.fields, retry });
  }
  return data;
}
const post = (path, body, token) => send("POST", path, body, token);

// The newest public items, one page at a time: { items, hasMore }.
// q = search text, category = a category name or "All", location = a building,
// dateFrom/dateTo = YYYY-MM-DD, before = the id of the last item already shown (to get
// the next page). Empty filters are left out. The server does the filtering.
// With the login token, the user's own posts are left out (they're in My posts).
export function fetchItems({
  q,
  category,
  before,
  location,
  dateFrom,
  dateTo,
} = {}, token) {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (category && category !== "All") params.set("category", category);
  if (before) params.set("before", before);
  if (location) params.set("location", location);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  return send("GET", `/items?${params}`, undefined, token);
}
// The lists and limits the forms use: { categories, buildings, maxQuestions, maxPhotos,
// maxPhotoMb, photoTypes, reportReasons }. The server is the one place these live.
export const fetchOptions = () => send("GET", "/items/options");

// Login step 1: the server emails a code to this student email and replies
// { challenge }, a secret the app must send back with the code.
export const requestCode = (email) => post("/auth/request-code", { email });

// Login step 2: trade the emailed code (and the challenge) for { token, user }.
export const verifyCode = (email, code, challenge) =>
  post("/auth/verify-code", { email, code, challenge });

// Log in as a guest without a student email.
export const guestLogin = () => post("/auth/guest");

// Post a found item: { title, category, location, building?, latitude, longitude, questions: [{ question, answer }] },
// plus its photo (a File object in photos; the server requires one), sent as a multipart form.
export function createItem({ photos = [], ...item }, token) {
  if (!photos.length) return post("/items", item, token);
  const form = new FormData();
  for (const [key, value] of Object.entries(item)) {
    if (value == null) continue; // a form would send null as the text "null"
    form.append(key, key === "questions" ? JSON.stringify(value) : value);
  }
  photos.forEach((photo) => form.append("photos", photo));
  return post("/items", form, token);
}

// The logged-in user's own posts.
export const fetchMyItems = (token) => send("GET", "/items/mine", undefined, token);

// One item's public details (no questions or answers).
export const fetchItem = (id) => send("GET", `/items/${id}`);

// The claim form for an item: { questions: [{ id, question }], myClaim, itemStatus }. myClaim is
// 'pending', 'approved', 'rejected' or 'post hidden' if you already claimed it (one try per item), else null;
// itemStatus then says whether the item is at the security desk yet ('dropped off').
export const fetchClaimForm = (itemId, token) => send("GET", `/items/${itemId}/questions`, undefined, token);

// Your claims for Notifications, latest change first: each is an item (same shape as the
// feed, so it can be opened) plus myClaim (the claim's status) and updatedAt.
export const fetchMyClaims = (token) => send("GET", "/claims/mine", undefined, token);

// Claim an item: answers = [{ questionId, answer }]. Campus Security checks them later.
export const submitClaim = (itemId, answers, token) => post("/claims", { itemId, answers }, token);

// Campus Security only: pending claims with each answer beside the expected one, plus
// approved claims whose item hasn't been picked up yet (status 'approved'; itemStatus 'claimed' or 'dropped off').
// [{ id, status, itemId, itemStatus, title, location, building, claimantId, claimantEmail, claimantSuspended,
//    rejectedBefore, decidedBy, decidedAt, answers: [{ questionId, question, expected, answer }] }].
export const fetchClaimsToReview = (token) => send("GET", "/claims/review", undefined, token);

// Campus Security only: decision is "approved" or "rejected".
export const decideClaim = (claimId, decision, token) => post(`/claims/${claimId}/decision`, { decision }, token);

// Editing one of your own posts while nobody has claimed it. fetchItemForEdit gives
// { title, category, location, building, latitude, longitude, questions: [{ question, answer }] };
// updateItem saves the same shape back. Photos can't be changed.
export const fetchItemForEdit = (id, token) => send("GET", `/items/${id}/edit`, undefined, token);
export const updateItem = (id, item, token) => send("PUT", `/items/${id}`, item, token);

// Campus Security only: the finder handed this claimed item in at the desk. Records who and
// when. A mistake can be undone from Past posts (setItemStatus back to 'claimed').
export const markReceived = (itemId, token) => post(`/items/${itemId}/received`, undefined, token);

// Campus Security only: the owner picked the item up at the desk. Records who and when. Final.
export const markHandedOff = (itemId, token) => post(`/items/${itemId}/handed-off`, undefined, token);

// Campus Security only: every post, newest first, with building, finderEmail and, once collected,
// pickedUpBy, pickedUpAt and handedOverBy.
export const fetchHistory = (token) => send("GET", "/items/history", undefined, token);

// Campus Security only: change an item's status by hand ('dropped off', 'handed off', or
// back to 'claimed' to undo a mistaken "received"). The server only allows those changes.
export const setItemStatus = (itemId, status, token) => send("PATCH", `/items/${itemId}/status`, { status }, token);

// Delete one of your own posts.
export const deleteItem = (id, token) => send("DELETE", `/items/${id}`, undefined, token);

// Campus Security only: accounts that are locked out of claiming (3 rejected claims since
// their last unlock) or suspended: [{ id, email, role, suspendedAt, rejected, locked }].
export const fetchRestrictedUsers = (token) => send("GET", "/users/restricted", undefined, token);

// Campus Security only: let a locked-out person claim again (their old rejections stop counting).
export const unlockUser = (userId, token) => post(`/users/${userId}/unlock`, undefined, token);

// Campus Security only: suspend an account (logged out, can't log back in) or restore it.
export const suspendUser = (userId, token) => post(`/users/${userId}/suspend`, undefined, token);
export const unsuspendUser = (userId, token) => post(`/users/${userId}/unsuspend`, undefined, token);
// Reporting and Campus Security moderation.
export const reportItem = (id, reason, details, token) =>
  post(`/items/${id}/report`, { reason, details }, token);
export const fetchReportedPosts = (token) =>
  send("GET", "/reports", undefined, token);
export const hideReportedPost = (itemId, token) =>
  post(`/reports/${itemId}/hide`, undefined, token);
// Undo a hide: the post is public again and the claims hiding closed go back to pending.
export const unhidePost = (itemId, token) =>
  post(`/reports/${itemId}/unhide`, undefined, token);
export const dismissReportedPost = (itemId, token) =>
  post(`/reports/${itemId}/dismiss`, undefined, token);
