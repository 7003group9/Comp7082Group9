import { createContext, useEffect, useState } from "react";
import { setSessionExpiredHandler } from "../api/client";

export const AuthContext = createContext(null);

const USER_KEY = "campusclaim_user";

// Reads the saved login. Anything missing, corrupted or blocked by the
// browser counts as "not logged in" instead of crashing the app.
function readSavedUser() {
  try {
    const saved = JSON.parse(localStorage.getItem(USER_KEY));
    return saved?.token ? saved : null; // a save without a token is no use
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSavedUser);
  const [expired, setExpired] = useState(false); // true after the server rejected our token

  function login(userData) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch {} // storage blocked: still logged in for this visit
    setExpired(false);
    setUser(userData);
  }

  function logout() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    setUser(null);
  }

  // If any request comes back 401 (expired or invalid login), log out so the
  // app shows the login screen with a note, instead of a confusing error.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout();
      setExpired(true);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, expired }}>
      {children}
    </AuthContext.Provider>
  );
}
