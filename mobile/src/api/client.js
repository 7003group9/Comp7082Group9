// Address of the server API; set VITE_API_URL in mobile/.env (see .env.example).
const API_URL = import.meta.env.VITE_API_URL;

// Called when the server rejects our login token (expired or invalid) so the
// app can send the user back to the login screen. AuthProvider sets it.
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
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(!form && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: form ? body : body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onSessionExpired(); // we sent a token and it was refused
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { fields: data?.fields });
  }
  return data;
}
const post = (path, body, token) => send("POST", path, body, token);

// The newest public items, one page at a time: { items, hasMore }.
// q = search text, category = a category name or "All", before = the id of the
// last item already shown (to get the next page). The server does the filtering.
// With the login token, the user's own posts are left out (they're in My posts).
export function fetchItems({ q, category, before } = {}, token) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category && category !== "All") params.set("category", category);
  if (before) params.set("before", before);
  return send("GET", `/items?${params}`, undefined, token);
}

// What the post form and filters offer: { categories, buildings, maxQuestions }.
// The server is the one place these live.
export const fetchOptions = () => send("GET", "/items/options");

// Login step 1: the server emails a code to this student email and replies
// { challenge }, a secret the app must send back with the code.
export const requestCode = (email) => post("/auth/request-code", { email });

// Login step 2: trade the emailed code (and the challenge) for { token, user }.
export const verifyCode = (email, code, challenge) =>
  post("/auth/verify-code", { email, code, challenge });

// Post a found item: { title, category, location, building?, latitude, longitude, questions: [{ question, answer }] },
// plus an optional photo (a File object in photos), which is sent as a multipart form.
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
// 'pending', 'approved' or 'rejected' if you already claimed it (one try per item), else null;
// itemStatus then says whether the item is at the security desk yet ('dropped off').
export const fetchClaimForm = (itemId, token) => send("GET", `/items/${itemId}/questions`, undefined, token);

// Claim an item: answers = [{ questionId, answer }]. Campus Security checks them later.
export const submitClaim = (itemId, answers, token) => post("/claims", { itemId, answers }, token);

// Campus Security only: pending claims with each answer beside the expected one, plus
// approved claims whose item hasn't been picked up yet (status 'approved'; itemStatus 'claimed' or 'dropped off').
// [{ id, status, itemId, itemStatus, title, location, building, claimantEmail, answers: [{ question, expected, answer }] }].
export const fetchClaimsToReview = (token) => send("GET", "/claims/review", undefined, token);

// Campus Security only: decision is "approved" or "rejected".
export const decideClaim = (claimId, decision, token) => post(`/claims/${claimId}/decision`, { decision }, token);

// Editing one of your own posts while nobody has claimed it. fetchItemForEdit gives
// { title, category, location, building, latitude, longitude, questions: [{ question, answer }] };
// updateItem saves the same shape back. Photos can't be changed.
export const fetchItemForEdit = (id, token) => send("GET", `/items/${id}/edit`, undefined, token);
export const updateItem = (id, item, token) => send("PUT", `/items/${id}`, item, token);

// Campus Security only: the finder handed this claimed item in at the desk. Final.
export const markReceived = (itemId, token) => post(`/items/${itemId}/received`, undefined, token);

// Campus Security only: the owner picked the item up at the desk. Records who and when. Final.
export const markHandedOff = (itemId, token) => post(`/items/${itemId}/handed-off`, undefined, token);

// Campus Security only: every post, newest first, with finderEmail and, once collected,
// pickedUpBy, pickedUpAt and handedOverBy.
export const fetchHistory = (token) => send("GET", "/items/history", undefined, token);

// Delete one of your own posts.
export const deleteItem = (id, token) => send("DELETE", `/items/${id}`, undefined, token);
