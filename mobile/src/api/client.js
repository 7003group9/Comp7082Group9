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
// throws the server's error message. Pass the login token for protected routes.
async function send(method, path, body, token) {
  if (!API_URL) throw new Error("API URL is not configured");
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const post = (path, body, token) => send("POST", path, body, token);

// Login step 1: the server emails a code to this student email.
export const requestCode = (email) => post("/auth/request-code", { email });

// Login step 2: trade the emailed code for { token, user }.
export const verifyCode = (email, code) =>
  post("/auth/verify-code", { email, code });

// Post a found item: { title, category, location, questions: [{ question, answer }] }.
export const createItem = (item, token) => post("/items", item, token);

// The logged-in user's own posts (including ID/card/phone items kept off the public list).
export const fetchMyItems = (token) => send("GET", "/items/mine", undefined, token);

// Delete one of your own posts.
export const deleteItem = (id, token) => send("DELETE", `/items/${id}`, undefined, token);
