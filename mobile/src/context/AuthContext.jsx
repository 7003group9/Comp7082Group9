import { createContext, useEffect, useState } from "react";
import { setSessionExpiredHandler } from "../api/client";
import { USER_KEY, securityTheme } from "../theme";

export const AuthContext = createContext(null);

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
  const [expired, setExpired] = useState(false); // after the server rejected our token: true, or its reason (e.g. suspended)

  function login(userData) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch {} // storage blocked: still logged in for this visit
    setExpired(false);
    setUser(userData);
    // Colours are picked at startup (theme.js): reload so security gets theirs.
    // Only if the login was saved, or the reload would log them straight out.
    if (readSavedUser() && (userData.role === "security") !== securityTheme) location.reload();
  }

  // reload=false keeps the page, e.g. to show the "session expired" note.
  function logout(reload = true) {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    setUser(null);
    if (reload && securityTheme) location.reload(); // back to the normal colours
  }

  // If any request comes back 401 (expired or invalid login), log out so the
  // app shows the login screen with a note, instead of a confusing error.
  useEffect(() => {
    setSessionExpiredHandler((reason) => {
      logout(false);
      setExpired(reason || true);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, expired }}>
      {children}
    </AuthContext.Provider>
  );
}
