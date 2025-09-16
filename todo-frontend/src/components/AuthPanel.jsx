import React, { useState } from "react";
import { api } from "../utils/api";

// UI yardımcıları (şimdilik App.jsx içinde tanımlı olanları burada da kullanıyoruz)
const Card = ({ children, className = "" }) => (
  <div className={`card ${className}`}>{children}</div>
);

const Button = ({ children, className = "", ...props }) => (
  <button className={`btn ${className}`} {...props}>{children}</button>
);

const Input = ({ className = "", ...props }) => (
  <input className={`input ${className}`} {...props} />
);

export default function AuthPanel({ onAuth }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api("/api/auth/login", {
        method: "POST",
        body: { username, password },
      });
      onAuth(data.token, { id: data.userId, username: data.username });
    } catch (e) {
      setError(e.message || "Giriş başarısız. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    try {
      setLoading(true);
      setError("");
      await api("/api/auth/register", {
        method: "POST",
        body: { username, password },
      });
      await login();
    } catch (e) {
      setError(e.message || "Kayıt başarısız. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const guest = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api("/api/auth/guest-login", { method: "POST" });
      onAuth(data.token, {
        id: data.userId,
        username: data.username,
        isGuest: true,
      });
    } catch (e) {
      setError(e.message || "Misafir girişi başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-center">Giriş / Kayıt</h2>

        <Input
          placeholder="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <Input
          placeholder="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex gap-2">
          <Button onClick={login} disabled={loading}>Giriş</Button>
          <Button onClick={register} disabled={loading}>Kayıt Ol</Button>
          <Button onClick={guest} disabled={loading} className="ml-auto">Misafir Girişi</Button>
        </div>

        {error && <div className="error-box text-red-600 text-sm">{error}</div>}
      </div>
    </Card>
  );
}
