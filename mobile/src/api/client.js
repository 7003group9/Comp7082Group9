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
export async function loginUser(email, password) {
  if (!API_URL) {
    throw new Error("API URL is not configured");
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  return data.user;
}
export async function registerUser(email, studentId, password) {
  if (!API_URL) {
    throw new Error("API URL is not configured");
  }

  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      studentId,
      password,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Could not create account");
  }

  return data.user;
}
