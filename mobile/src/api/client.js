import { mockItems } from '../data/mockItems';

// Set EXPO_PUBLIC_API_URL in .env (for example http://192.168.1.20:8000).
// On a real phone, use your computer's LAN IP, not localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function fetchItems() {
  if (!API_URL) {
    await new Promise((r) => setTimeout(r, 400)); // simulate network
    return mockItems;
  }
  const res = await fetch(`${API_URL}/items`);
  if (!res.ok) throw new Error(`Could not load items (${res.status})`);
  return res.json();
}
