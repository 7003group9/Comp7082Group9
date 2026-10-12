// Address of the server API; set VITE_API_URL in mobile/.env (see .env.example).
const API_URL = import.meta.env.VITE_API_URL;

// Returns the public list of found items.
export async function fetchItems() {
  if (!API_URL) throw new Error("API URL is not configured");
  const res = await fetch(`${API_URL}/items`);
  if (!res.ok) throw new Error(`Could not load items (${res.status})`);
  return res.json();
}

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
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { fields: data?.fields });
  }
  return data;
}
const post = (path, body, token) => send("POST", path, body, token);

// Login step 1: the server emails a code to this student email.
export const requestCode = (email) => post("/auth/request-code", { email });

// Login step 2: trade the emailed code for { token, user }.
export const verifyCode = (email, code) =>
  post("/auth/verify-code", { email, code });

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
