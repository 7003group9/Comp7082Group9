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
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
