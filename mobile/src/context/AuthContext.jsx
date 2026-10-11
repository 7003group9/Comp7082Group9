import { createContext, useState } from "react";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("campusclaim_user");

    if (savedUser) {
      return JSON.parse(savedUser);
    }

    return null;
  });

  function login(userData) {
    localStorage.setItem(
      "campusclaim_user",
      JSON.stringify(userData)
    );

    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("campusclaim_user");
    // Saved post drafts hold private answers, so don't leave them for the next person.
    Object.keys(localStorage)
      .filter((k) => k.startsWith("campusclaim_draft_"))
      .forEach((k) => localStorage.removeItem(k));
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
