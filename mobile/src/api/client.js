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
export function fetchItems({ q, category, before } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category && category !== "All") params.set("category", category);
  if (before) params.set("before", before);
  return send("GET", `/items?${params}`);
}

// What the post form and filters offer: { categories, maxQuestions }.
// The server is the one place these live.
export const fetchOptions = () => send("GET", "/items/options");

// Login step 1: the server emails a code to this student email and replies
// { challenge }, a secret the app must send back with the code.
export const requestCode = (email) => post("/auth/request-code", { email });

// Login step 2: trade the emailed code (and the challenge) for { token, user }.
export const verifyCode = (email, code, challenge) =>
  post("/auth/verify-code", { email, code, challenge });

// Post a found item: { title, category, location, questions: [{ question, answer }] },
// plus optional photos (up to 3 File objects), which are sent as a multipart form.
export function createItem({ photos = [], ...item }, token) {
  if (!photos.length) return post("/items", item, token);
  const form = new FormData();
  for (const [key, value] of Object.entries(item)) {
    form.append(key, key === "questions" ? JSON.stringify(value) : value);
  }
  photos.forEach((photo) => form.append("photos", photo));
  return post("/items", form, token);
}

// The user's unfinished post, kept on the server (one per user), or null:
// { title, building, detail, category, questions }. Photos aren't saved in drafts.
export const fetchDraft = (token) => send("GET", "/items/draft", undefined, token);
export const putDraft = (draft, token) => send("PUT", "/items/draft", draft, token);
export const deleteDraft = (token) => send("DELETE", "/items/draft", undefined, token);

// The logged-in user's own posts (including ID/card/phone items kept off the public list).
export const fetchMyItems = (token) => send("GET", "/items/mine", undefined, token);

// Delete one of your own posts.
export const deleteItem = (id, token) => send("DELETE", `/items/${id}`, undefined, token);
