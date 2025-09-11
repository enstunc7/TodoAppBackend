import React, { useEffect, useMemo, useState } from "react";
import "./app.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/**
 * Minimal React frontend for your .NET Todo backend
 * -------------------------------------------------
 * Features:
 * - Auth: register, login, guest login (JWT stored in localStorage)
 * - Todos: Inbox / Today / Upcoming (list, create, complete toggle)
 * - Tags: list, assign to todo
 * - Goals: header shows CompletedToday / DailyGoal (kupa when achieved)
 * - Calendar: month picker and grouped tasks by day
 *
 * How to use:
 * 1) Put this file as App.jsx in a Vite React project (or CRA), ensure Tailwind is set up (optional, but classes are included).
 * 2) Set BASE_URL below to your backend URL (e.g., https://localhost:7254).
 * 3) npm run dev
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:7254"; // change if needed
// Sol 2/3 görseli (kendi görselinle değiştir)




// ---- API helper ----
const FIELD_TR_MAP = {
  Username: "Kullanıcı adı",
  Password: "Şifre",
  Email: "E-posta",
  Title: "Başlık",
  DueDate: "Tarih",
};

const trField = (f) => FIELD_TR_MAP[f] || f;

// ModelState (payload.errors) içindeki İngilizce kalıpları TR’ye çevir
// ModelState (payload.errors) içindeki İngilizce kalıpları TR’ye çevir
function translateModelState(errorsObj) {
  const lines = [];
  for (const [field, arr] of Object.entries(errorsObj || {})) {
    for (let m of arr || []) {
      // Zorunlu alan
      m = m.replace(/^The\s+(.+?)\s+field is required\.?$/i, (_, fld) => {
        const tr = FIELD_TR_MAP[fld] || fld;
        return `${tr} zorunludur.`;
      });

      // Minimum uzunluk – çeşitli ASP.NET kalıpları:
      // 1) "The field Password must be a string or array type with a minimum length of '6'."
      m = m.replace(
        /^The\s+field\s+(.+?)\s+must be a string or array type with a minimum length of '(\d+)'\.?$/i,
        (_, fld, n) => `${(FIELD_TR_MAP[fld] || fld)} en az ${n} karakter olmalıdır.`
      );
      // 2) "The Password field must be at least 6 characters long."
      m = m.replace(
        /^The\s+(.+?)\s+field must be at least (\d+) characters long\.?$/i,
        (_, fld, n) => `${(FIELD_TR_MAP[fld] || fld)} en az ${n} karakter olmalıdır.`
      );
      // 3) "The Password must be at least 6 and at most 100 characters long."
      m = m.replace(
        /^The\s+(.+?)\s+must be at least (\d+)\s+and at (?:most|max)\s+(\d+)\s+characters long\.?$/i,
        (_, fld, n, max) => `${(FIELD_TR_MAP[fld] || fld)} en az ${n}, en fazla ${max} karakter olmalıdır.`
      );

      // Genel “geçersiz değer” kalıbı
      m = m.replace(
        /^The\s+(.+?)\s+field must be a string or array type/i,
        (_, fld) => `${(FIELD_TR_MAP[fld] || fld)} değeri geçersiz.`
      );

      // Son güvenlik: alan adlarını TR çevir
      m = m.replace(/Username/gi, "Kullanıcı adı").replace(/Password/gi, "Şifre");

      lines.push(m);
    }
  }
  // Alt alta görünsün diye \n ile birleştiriyoruz
  return Array.from(new Set(lines)).join("\n");
}


function translateProblem(message) {
  if (!message) return "";
  // Başlık / özet gibi tek satırlık İngilizce metinleri sadeleştir
  if (/One or more validation errors occurred/i.test(message)) return "Lütfen formu kontrol edin.";
  if (/Invalid username or password/i.test(message)) return "Kullanıcı adı veya şifre hatalı.";
  return message;
}

const api = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "tr-TR", // varsa backend lokalizasyonunu tetikler
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") || "";
  const looksJson = ct.includes("json");

  let payload = null;
  try {
    payload = looksJson ? await res.json() : await res.text();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    // string geldiyse JSON parse etmeyi dene
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch {}
    }

    let message = `${res.status} ${res.statusText}`;

    if (payload && typeof payload === "object") {
      if (payload.errors) {
        message = translateModelState(payload.errors);
      } else if (payload.detail) {
        message = translateProblem(payload.detail);
      } else if (payload.title) {
        message = translateProblem(payload.title);
      } else if (payload.message) {
        message = translateProblem(payload.message);
      }
    } else if (typeof payload === "string" && payload.trim()) {
      message = translateProblem(payload.trim());
    }

    // Statü bazlı Türkçe sadeleştirme
    if (res.status === 400 && !message) message = "Lütfen formu kontrol edin.";
    if (res.status === 401) message = "Kullanıcı adı veya şifre hatalı.";
    if (res.status === 403) message = "Bu işlemi yapmak için yetkiniz yok.";
    if (res.status === 404) message = "Kayıt bulunamadı.";
    if (res.status >= 500) message = "Sunucuda bir sorun oluştu. Lütfen tekrar deneyin.";

    const err = new Error(message);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
};




// ---- Auth hooks ----
const useAuth = () => {
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
};


// ---- Auth Forms ----
const AuthPanel = ({ onAuth }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    try {
      setLoading(true); setError("");
      const data = await api("/api/auth/login", { method: "POST", body: { username, password } });
      onAuth(data.token, { id: data.userId, username: data.username });
    } catch (e) {
      // e.message artık kısa ve temiz
      setError(e.message || "Giriş başarısız. Lütfen tekrar deneyin.");
    } finally { setLoading(false); }
  };

  const register = async () => {
    try {
      setLoading(true); setError("");
      await api("/api/auth/register", { method: "POST", body: { username, password } });
      await login();
    } catch (e) {
      // Örn. 400 model validasyonları burada satır satır görünecek
      setError(e.message || "Kayıt başarısız. Lütfen bilgilerinizi kontrol edin.");
    } finally { setLoading(false); }
  };

  const guest = async () => {
    try {
      setLoading(true); setError("");
      const data = await api("/api/auth/guest-login", { method: "POST" });
      onAuth(data.token, { id: data.userId, username: data.username, isGuest: true });
    } catch (e) {
      setError(e.message || "Misafir girişi başarısız.");
    } finally { setLoading(false); }
  };


  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Giriş / Kayıt</h2>
        <Input placeholder="Kullanıcı adı" value={username} onChange={e=>setUsername(e.target.value)} />
        <Input placeholder="Şifre" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <div className="flex gap-2">
          <Button onClick={login} disabled={loading}>Giriş</Button>
          <Button onClick={register} disabled={loading}>Kayıt Ol</Button>
          <Button onClick={guest} disabled={loading} className="ml-auto">Misafir Girişi</Button>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>
    </Card>
  );
};

// ---- Goals header ----
const GoalsHeader = ({ token, uiTick }) => {
  const [progress, setProgress] = useState(null);
  const [goal, setGoal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true); setError("");
      const p = await api("/api/goals/today", { token });
      setProgress(p);
      const g = await api("/api/goals", { token });
      setGoal(typeof g === 'number' ? g : g?.dailyGoal ?? 0);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); }, [token, uiTick]);

  const [newGoal, setNewGoal] = useState("");
  const updateGoal = async () => {
    try {
      const v = Math.max(0, parseInt(newGoal || "0", 10));
      await api("/api/goals", { method: "PUT", token, body: { dailyGoal: v } });

      // ⬇️ anında ekranda güncelle
      setGoal(v);
      setProgress(p => p
        ? { ...p, dailyGoal: v, achieved: p.completedToday >= v }
        : { completedToday: 0, dailyGoal: v, achieved: v <= 0 }
      );
      setNewGoal("");
      // İstersen sessiz arka plan senkronu da ekleyebilirsin:
      // load();
    } catch (e) { setError(e.message); }
  };


  return (
    <Card>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-lg font-semibold">Hedef: {progress ? `${progress.completedToday} / ${progress.dailyGoal}` : `${0} / ${goal}`}</div>
        {progress?.achieved && <span title="Hedefe ulaşıldı" className="text-2xl">🏆</span>}
        <div className="ml-auto flex items-center gap-2">
          <Input placeholder="Günlük hedef" value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") updateGoal(); }}style={{width:140}} />
          <Button onClick={updateGoal}>Kaydet</Button>
        </div>
      </div>
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
    </Card>
  );
};


// ✅ Sadece yeni görev oluşturma ve etiket ekleme işi burada
const TodoCreateForm = ({ token, onCreated }) => {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);   // yeni görev için
  const [newTag, setNewTag] = useState("");
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [error, setError] = useState("");

  // Etiketleri yükle
  const loadTags = async () => {
    try { setTags(await api("/api/tags", { token })); } catch {}
  };
  useEffect(() => { loadTags(); }, [token]);

  const toggleSelTag = (id) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const createTag = async () => {
    try {
      const name = (newTag || "").trim();
      if (!name) { setError("Etiket adı boş olamaz."); return; }
      await api("/api/tags", { method: "POST", token, body: { name } });
      setNewTag("");
      await loadTags();
    } catch (e) { setError(e.message); }
  };

  const create = async () => {
    try {
      setError("");
      const body = {
        title,
        isCompleted: false,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null
      };
      const t = await api("/api/todos", { method: "POST", token, body });

      if (selectedTags.length) {
        await api(`/api/todos/${t.id}/tags`, {
          method: "PUT",
          token,
          body: { tagIds: selectedTags }
        });
      }

      setTitle(""); setDueDate(""); setSelectedTags([]);
      onCreated?.(); // dışarıya haber ver (listeyi yenilesin)
    } catch (e) { setError(e.message); }
  };

  return (
        <Card className="create-card">
          <h2 className="text-lg font-semibold mb-3">Yeni Görev Ekle</h2>

          <div className="create-form">
            {/* Başlık */}
            <div className="form-group">
              <label className="block text-sm mb-1">Başlık</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Yeni görev"
              />
            </div>

            {/* 📅 Tarih (DatePicker ile) */}
            <div className="form-group">
              <label className="block text-sm mb-1">Tarih</label>
              <DatePicker
                selected={dueDate ? new Date(dueDate) : null}
                onChange={(date) =>
                  setDueDate(date ? date.toISOString() : "")
                }
                dateFormat="dd.MM.yyyy"
                placeholderText="Tarih seç"
                className="input"
              />
            </div>

            {/* 🏷️ Etiket seçici */}
            <div className="form-group relative">
              <Button
                type="button"
                onClick={() => setTagPanelOpen((v) => !v)}
                className="px-4 py-2 border rounded-md bg-white shadow-sm"
              >
                Etiket Seç
              </Button>

              {tagPanelOpen && (
                <div className="absolute z-20 mt-2 w-64 bg-white border rounded-lg shadow-lg p-3 space-y-2">
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {tags.length === 0 && (
                      <div className="text-sm text-gray-500">Hiç etiket yok</div>
                    )}

                    {tags.map(tag => {
                      const selected = selectedTags.includes(tag.id);
                      return (
                        <div key={tag.id} className="tag-item">
                          <button
                            type="button"
                            onClick={() => toggleSelTag(tag.id)}
                            className="flex-1 flex items-center gap-1 text-left"
                          >
                            <span className="text-gray-500">#</span>
                            <span>{tag.name}</span>
                            {selected && <span className="text-green-600 text-base">✅</span>}
                          </button>

                          <button
                            type="button"
                            className="delete-btn"
                            onClick={async () => {
                              if (confirm(`"${tag.name}" etiketini silmek istiyor musun?`)) {
                                await api(`/api/tags/${tag.id}`, { method: "DELETE", token });
                                await loadTags();
                              }
                            }}
                          >
                            Sil
                          </button>
                        </div>
                      );
                    })}

  

                  </div>

                  {/* ➕ Yeni etiket */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <input
                      type="text"
                      placeholder="Yeni etiket"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          await createTag();
                        }
                      }}
                      className="tag-add-input px-3 py-1.5 border border-gray-300 rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <Button
                      type="button"
                      onClick={createTag}
                      className="px-2 py-1 border rounded-md text-sm bg-gray-100 hover:bg-gray-200"
                    >
                      Ekle
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ Sağ alta sabitlenmiş mavi buton */}
            <button type="button" onClick={create} className="ekle-btn">
              Ekle
            </button>
          </div>

          {error && (
            <div className="text-red-600 text-sm mt-2 whitespace-pre-wrap">{error}</div>
          )}
        </Card>

  );
};


// ---- Todos list / create ----
  const TodoList = ({ token, scope, filterTagIds = [], setFilterTagIds, tab, setTab, isTagPanelOpen, setIsTagPanelOpen, onChanged }) => {
  const [todos, setTodos] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingComplete, setPendingComplete] = useState(null);

    // Chip picker için toggle helper

  const deleteTodo = async (id) => {
    try {
      setError("");
      await api(`/api/todos/${id}`, { method: "DELETE", token });
      await load();                 // listeyi yenile
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setPendingDelete(null);       // modalı kapat
    }
  };



  const path = useMemo(() => {
    if (scope === "inbox") return "/api/todos/inbox";
    if (scope === "today") return "/api/todos/today";
    if (scope === "upcoming") return "/api/todos/upcoming";
    return "/api/todos";
  }, [scope]);

  const load = async () => {
    try {
      setLoading(true); setError("");
      const data = await api(path, { token }); // her zaman sekmenin endpoint'i
      const filtered = (filterTagIds && filterTagIds.length)
        ? data.filter(todo => {
            const todoTagIds = new Set((todo.tags || []).map(x => x.id));
            return filterTagIds.every(id => todoTagIds.has(id)); // AND
          })
        : data;
      setTodos(filtered);
     
      const tg = await api("/api/tags", { token });
      setTags(tg);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); }, [path, filterTagIds.join(",")]);


  const toggle = async (todo) => {
    try {
      await api(`/api/todos/${todo.id}`, { method: "PUT", token, body: { title: todo.title, isCompleted: !todo.isCompleted, dueDate: todo.dueDate } });
      await load();
      onChanged?.();
    } catch(e){ setError(e.message); }
  };
  const remove = async (todoId) => {
  try {
    // (İstersen onay penceresi)
    // if (!window.confirm("Görevi silmek istediğine emin misin?")) return;

    await api(`/api/todos/${todoId}`, { method: "DELETE", token });
    await load(); // Listeyi yenile
  } catch (e) {
    setError(e.message);
  }
};

  const assignTags = async (todoId, tagIds) => { // tagIds: number[]
    try {
      await api(`/api/todos/${todoId}/tags`, { method: "PUT", token, body: { tagIds } });
      await load();
    } catch(e){ setError(e.message); }
  };

  // listedeki bir todo için tek tıkla tag aç/kapat + hemen kaydet
  const toggleTagForTodo = async (todo, tagId) => {
    const currentIds = (todo.tags || []).map(t => t.id);
    const nextIds = currentIds.includes(tagId)
      ? currentIds.filter(id => id !== tagId)
      : [...currentIds, tagId];

    await assignTags(todo.id, nextIds);
  };







  return (
    <div className="space-y-6">
      {/* ✅ Görevler + sekme toolbar kutusu */}
      <Card>
        {/* Sekmeler buraya taşındı */}
        <div className="toolbar mb-4">
          {[
            { key: "inbox", label: "Inbox" },
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
          ].map(x => (
            <Button
              key={x.key}
              variant={tab === x.key ? "primary" : "default"}
              onClick={() => setTab(x.key)}
            >
              {x.label}
            </Button>
          ))}

          {/* Etiket filtresi dropdown aynı şekilde buraya */}
          <div className="dropdown">
            <Button onClick={() => setIsTagPanelOpen(v => !v)}>Etiket Filtresi</Button>
            {isTagPanelOpen && (
              <div className="dropdown__panel p-3 bg-white rounded-lg shadow-md space-y-2">
                {tags.length === 0 && (
                  <div className="text-sm text-gray-500">Hiç etiket yok</div>
                )}

                {tags.map(tag => {
                  const selected = filterTagIds.includes(Number(tag.id));
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        const id = Number(tag.id);
                        setFilterTagIds(prev =>
                          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                        );
                      }}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium border transition ${
                        selected
                          ? "bg-blue-50 border-blue-400 text-blue-800"
                          : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span className="text-gray-500">#</span>
                        <span>{tag.name}</span>
                      </span>
                      {selected && <span className="text-green-600 text-base">✅</span>}
                    </button>
                  );
                })}

                {filterTagIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTagIds([])}
                    className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-md mt-2"
                  >
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            )}


          </div>
        </div>

       <h2 className="text-lg font-semibold mb-3">Görevler</h2>
        <div className="overflow-x-auto">
          <table className="todo-table min-w-full border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Görev</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Durum</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">İşlemler<table></table></th>
              </tr>
            </thead>
            <tbody>
              {todos.map(t => (
                <tr
                  key={t.id}
                  className={`border-b ${t.isCompleted ? "row-done" : ""}`}
                >
                  <td className="px-4 py-2 align-top">
                    <div className="font-medium">{t.title}</div>

                    {/* 📅 dueDate sadece inbox dışındaki tablarda */}
                    {scope !== "inbox" && t.dueDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(t.dueDate).toLocaleDateString("tr-TR")}
                      </div>
                    )}

                    {/* 🏷️ etiketler */}
                    {t.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.tags.map(tag => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-300"
                          >
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`status-badge ${t.isCompleted ? "status-done" : "status-pending"}`}>
                      {t.isCompleted ? "Tamamlandı" : "Bekliyor"}
                    </span>
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => !t.isCompleted && setPendingComplete(t)}
                      disabled={t.isCompleted}
                      className={`btn-complete ${t.isCompleted ? "btn-disabled" : ""}`}
                    >
                      Tamamlandı
                    </button>

                    <button
                      onClick={() => setPendingDelete({ id: t.id, title: t.title })}
                      className="btn-delete"
                    >
                      Sil
                    </button>
                  </td>

                </tr>
              ))}

              {todos.length === 0 && (
                <tr>
                  <td colSpan="3" className="text-center text-gray-500 py-3 text-sm">
                    Henüz görev yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </Card>

      
      {pendingDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3 className="modal__title">Görevi sil</h3>
            <p className="modal__text">
              “{pendingDelete.title}” görevini silmek istediğine emin misin?
            </p>
            <div className="modal__actions">
              <button className="btn" onClick={() => setPendingDelete(null)}>
                İptal
              </button>
              <button
                className="btn btn--danger"
                onClick={() => deleteTodo(pendingDelete.id)}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingComplete && (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal">
          <h3 className="modal__title">Görevi Tamamla</h3>
          <p className="modal__text">
            “{pendingComplete.title}” görevini tamamlandı olarak işaretlemek istiyor musunuz?
          </p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setPendingComplete(null)}>
              İptal
            </button>
            <button
              className="btn btn--primary"
              onClick={async () => {
                await toggle(pendingComplete);
                setPendingComplete(null);
              }}
            >
              Onayla
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );


};

// ---- Calendar ----
const CalendarView = ({ token }) => {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7)); // YYYY-MM
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [data, setData] = useState({});
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const qs = new URLSearchParams({ month, includeCompleted: includeCompleted ? "true" : "false" });
      const d = await api(`/api/todos/calendar?${qs.toString()}`, { token });
      setData(d);
    } catch(e){ setError(e.message); }
  };
  useEffect(()=>{ load(); }, []);

  return (
    <Card>
      <div className="flex items-end gap-2 mb-3">
        <div>
          <label className="block text-sm mb-1">Ay</label>
          <DatePicker
            selected={month ? new Date(month + "-01") : null}
            onChange={(date) => setMonth(date ? date.toISOString().slice(0, 7) : "")}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            className="input"
          />
        </div>
        <label className="flex items-center gap-2 mb-1">
          <input type="checkbox" checked={includeCompleted} onChange={e=>setIncludeCompleted(e.target.checked)} /> Tamamlananları dahil et
        </label>
        <Button onClick={load}>Getir</Button>
      </div>
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      <div className="space-y-3">
        {Object.keys(data).sort().map(day => (
          <div key={day} className="border rounded-xl p-3">
            <div className="text-sm font-semibold mb-2">{day}</div>
            <ul className="text-sm list-disc ml-5">
              {data[day].map(item => (
                <li key={item.id}>
                  {item.title} {item.isCompleted ? "✅" : ""}
                  {item.tags?.length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">[{item.tags.map(t=>t.name).join(", ")}]</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {Object.keys(data).length === 0 && <div className="text-sm text-gray-500">Bu ay için dueDate atanmış görev bulunamadı.</div>}
      </div>
    </Card>
  );
};

// ---- Main App ----
export default function App() {
  const { token, user, saveAuth, logout } = useAuth();
  const [tab, setTab] = useState("inbox"); // inbox | today | upcoming | calendar
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [filterTagIds, setFilterTagIds] = useState([]); // number[] (AND)
  const [uiTick, setUiTick] = useState(0);
  const bump = () => setUiTick(x => x + 1);

  const tabs = [
    { key: "inbox", label: "Inbox" },
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
  ];

  useEffect(() => {
    if (!token) return;
    (async () => {
      try { setAllTags(await api("/api/tags", { token })); } catch {}
    })();
  }, [token]);

  const toggleFilterTag = (id) => {
    setFilterTagIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };
  const clearAllFilters = () => setFilterTagIds([]);

  // BASE_URL'ın altında bir defa tanımlı olsun
  if (!token) {
  return (
    <div className="login-page">
      <div className="login-box">
        <h1 className="login-title">Todo App</h1>

        <AuthPanel onAuth={(tk, usr) => saveAuth(tk, usr)} />

        <p className="login-note">
          Not: Misafir kullanıcı sadece Inbox’ta görev açabilir.
        </p>
      </div>
    </div>
  );
}



  return (
  <div className="page">
    <header className="header">
      <div className="header__inner">
        <h1 className="text-xl font-semibold">Todo App</h1>
        <span className="text-sm text-slate-600">
          Merhaba, <b>{user?.username}</b>
        </span>
        <div className="ml-auto">
          <Button onClick={logout}>Çıkış</Button>
        </div>
      </div>
    </header>

    {/* İçerik */}
    <main className="grid-layout">
      {/* Sol sütun */}
      <div className="left-col space-y-6">
        <GoalsHeader token={token} uiTick={uiTick}/>
        <TodoCreateForm token={token} onCreated={bump} />
      </div>

      {/* Orta sütun */}
      <div className="center-col">
        <TodoList
          token={token}
          scope={tab}
          filterTagIds={filterTagIds}
          setFilterTagIds={setFilterTagIds}
          tab={tab}
          setTab={setTab}
          isTagPanelOpen={isTagPanelOpen}
          setIsTagPanelOpen={setIsTagPanelOpen}
          onChanged={bump}
        />
      </div>

      {/* Sağ sütun */}
      <div className="right-col">
        <CalendarView token={token} />
      </div>
    </main>
  </div>
);
 
}

// ---- UI helpers ----

const Card = ({ children, className = "" }) => (
  <div className={`card ${className}`}>{children}</div>
);

const Button = ({ children, className = "", variant = "default", ...props }) => {
  const cls =
    "btn " +
    (variant === "primary" ? "btn--primary " : variant === "ghost" ? "btn--ghost " : "") +
    className;
  return (
    <button className={cls} {...props}>{children}</button>
  );
};

const Input = ({ className = "", ...props }) => (
  <input className={`input ${className}`} {...props} />
);

const Select = ({ className = "", ...props }) => (
  <select className={`select ${className}`} {...props} />
);

