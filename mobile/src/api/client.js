import { mockItems } from "../data/mockItems";

// Empty VITE_API_URL falls back to mock data (see .env.example).
const API_URL = import.meta.env.VITE_API_URL;

// Returns the public list of found items (mock data when no API URL is set).
export async function fetchItems() {
  if (!API_URL) {
    // Mock mode: fake a short delay so the loading spinner is visible.
    await new Promise((r) => setTimeout(r, 400)); // simulate network
    return mockItems;
  }
  const res = await fetch(`${API_URL}/items`);
  if (!res.ok) throw new Error(`Could not load items (${res.status})`);
  return res.json();
}

// POST JSON and return the parsed reply; throws the server's error message.
async function post(path, body) {
  if (!API_URL) throw new Error("API URL is not configured");
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Login step 1: the server emails a code to this student email.
export const requestCode = (email) => post("/auth/request-code", { email });

// Login step 2: trade the emailed code for { token, user }.
export const verifyCode = (email, code) =>
  post("/auth/verify-code", { email, code });
