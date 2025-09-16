import { useState } from "react";

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const saveAuth = (tk, usr) => {
    setToken(tk);
    setUser(usr);
    localStorage.setItem("token", tk);
    localStorage.setItem("user", JSON.stringify(usr));
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return { token, user, saveAuth, logout };
}
