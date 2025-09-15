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
      
      <div className="space-y-3">  <h2 className="text-xl font-semibold">Giriş / Kayıt</h2>
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

  const [newGoal, setNewGoal] = useState("");
  const [error, setError] = useState("");

  const isGuest = JSON.parse(localStorage.getItem("user") || "{}")?.isGuest;

 


  // 📌 Mevcut verileri yükle
  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const p = await api("/api/goals/today", { token });
      setProgress(p);
      const g = await api("/api/goals", { token });
      setGoal(typeof g === "number" ? g : g?.dailyGoal ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token, uiTick]);

  // 📌 Güncelle butonu
  const updateGoal = async () => {
    // boş veya negatif sayı kontrolü
    if (!newGoal.trim()) {
      setError("Lütfen bir sayı girin.");
      return;
    }

    const v = parseInt(newGoal, 10);
    if (isNaN(v) || v < 0) {
      setError("Lütfen geçerli bir sayı girin.");
      return;
    }

    try {
      await api("/api/goals", {
        method: "PUT",
        token,
        body: { dailyGoal: v },
      });

      setGoal(v);
      setProgress((p) =>
        p
          ? { ...p, dailyGoal: v, achieved: p.completedToday >= v }
          : { completedToday: 0, dailyGoal: v, achieved: v <= 0 }
      );

      setNewGoal("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-lg font-semibold">
          Hedef:{" "}
          {progress
            ? `${progress.completedToday} / ${progress.dailyGoal}`
            : `${0} / ${goal}`}
        </div>

        {progress?.achieved && (
          <span title="Hedefe ulaşıldı" className="text-2xl">
            🏆
          </span>
        )}

        <div className="ml-auto flex items-center w-full max-w-sm gap-6">
          <div className="flex flex-col flex-1">
            <Input
              type="number"
              min="0"
              placeholder="Günlük hedef"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateGoal();
              }}
              disabled={isGuest}
              className="w-32"
            />
            {error && (
              <div className="text-red-600 text-sm mt-1">{error}</div>
            )}
          </div>

          <Button
            onClick={() => {
              if (isGuest) {
                setError("Bu işlemi yapmak için yetkiniz yok.");
                return;
              }
              updateGoal();
            }}
            disabled={isGuest}
            className={`px-4 py-2 rounded-md shadow-md transition text-white ${
              isGuest ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            Kaydet
          </Button>
        </div>
        {isGuest && (
          <div className="text-red-600 text-sm mt-2">
            Bu işlemi yapmak için yetkiniz yok. (Misafir kullanıcılar hedef belirleyemez)
          </div>
        )}
      </div>
    </Card>
  );
};



// ✅ Sadece yeni görev oluşturma ve etiket ekleme işi burada
const TodoCreateForm = ({ token, onCreated, allTags, reloadTags, isGuest }) => {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);   // yeni görev için
  const [newTag, setNewTag] = useState("");
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const [tagError, setTagError] = useState("");
  const [pendingTagDelete, setPendingTagDelete] = useState(null);

  const toggleSelTag = (id) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const createTag = async () => {
    try {
      setTagError("");
      const name = (newTag || "").trim();
      if (!name) {
        setTagError("Etiket adı boş olamaz.");
        return;
      }

      // Aynı isimde etiket var mı kontrol et
      if (allTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        setTagError("Bu isimde bir etiket zaten var.");
        return;
      }

      await api("/api/tags", { method: "POST", token, body: { name } });
      setNewTag("");
      await reloadTags(); 
    } catch (e) {
      setTagError(e.message || "Etiket oluşturulamadı.");
    }
  };

  const create = async () => {
    try {
      setError("");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.isGuest) {
        const existing = await api("/api/todos", { token });
        if (existing.length >= 10) {
          setError("Misafir kullanıcı en fazla 10 görev oluşturabilir.");
          return;
        }
      }

      const titleTrimmed = title.trim();
      if (!titleTrimmed) {
        setError("Başlık boş olamaz.");
        return;
      }

      // ⛔ Aynı başlığa sahip görev var mı kontrolü
      const existing = await api("/api/todos", { token });
      const sameTitle = existing.some(
        (t) => t.title.trim().toLowerCase() === titleTrimmed.toLowerCase()
      );
      if (sameTitle) {
        setError("Bu başlığa sahip bir görev zaten var.");
        return;
      }

      const body = {
        title: titleTrimmed,
        isCompleted: false,
        dueDate: dueDate ? new Date(dueDate).toLocaleDateString("en-CA") : null

      };

      const t = await api("/api/todos", { method: "POST", token, body });

      if (selectedTags.length) {
        await api(`/api/todos/${t.id}/tags`, {
          method: "PUT",
          token,
          body: { tagIds: selectedTags }
        });
      }

      setTitle("");
      setDueDate("");
      setSelectedTags([]);
      onCreated?.();
    } catch (e) {
      setError(e.message);
    }
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

        {/* 📅 Tarih */}
        <div className="form-group">
          <label className="block text-sm mb-1">Tarih</label>
          <DatePicker
            selected={dueDate ? new Date(dueDate) : null}
            onChange={(date) => setDueDate(date ? date.toISOString() : "")}
            dateFormat="dd.MM.yyyy"
            placeholderText="Tarih seç"
            className="input"
          />
        </div>

        {/* 🏷️ Etiket seçici */}
        <div className="form-group mt-2">
          <Button
            type="button"
            onClick={() => setTagPanelOpen((v) => !v)}
            className="px-4 py-2 border rounded-md bg-white shadow-sm"
          >
            Etiket Seç
          </Button>

          {tagPanelOpen && (
            <div
              className="
                absolute z-20 mt-2 w-72
                bg-white border border-gray-200 rounded-lg shadow-xl
                p-4 flex flex-col gap-3
                max-h-64 overflow-y-auto
                
              "
            >
              {/* ❌ Sağ üst köşe kapatma butonu */}
              <button
                type="button"
                onClick={() => setTagPanelOpen(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg"
              >
                ×
              </button>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allTags.length === 0 && (
                  <div className="text-sm text-gray-500">Hiç etiket yok</div>
                )}

                <div className="tag-chip-container flex flex-wrap gap-2">
                  {allTags.map(tag => {
                    const selected = selectedTags.includes(tag.id);
                    return (
                      <div
                        key={tag.id}
                        className={`tag-chip ${selected ? "selected" : ""}`}
                      >
                        <span
                          className="tag-label"
                          onClick={() => toggleSelTag(tag.id)}
                        >
                          #{tag.name}
                        </span>
                        <button
                          type="button"
                          className="tag-remove"
                          onClick={() => setPendingTagDelete(tag)}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ➕ Yeni etiket */}
              {!JSON.parse(localStorage.getItem("user") || "{}")?.isGuest && (
                <>
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
                      className="tag-add-input px-3 py-1.5 border border-gray-300 rounded-full text-sm bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <Button type="button" onClick={createTag}>Ekle</Button>
                  </div>
                  {tagError && <div className="text-red-600 text-sm mt-1">{tagError}</div>}
                </>
              )}

              {tagError && <div className="text-red-600 text-sm mt-1">{tagError}</div>}
            </div>
          )}
        </div>
        {error && <div className="text-red-600 text-sm mt-2 whitespace-pre-wrap">{error}</div>}
        <button type="button" onClick={create} className="ekle-btn">Ekle</button>
      </div>

    {pendingTagDelete && (
      <div className="modal-backdrop">
        <div className="modal">
          <h3 className="modal__title">Etiketi Sil</h3>
          <p className="modal__text">
            “{pendingTagDelete.name}” etiketini silmek istediğine emin misiniz?
          </p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setPendingTagDelete(null)}>
              İptal
            </button>
            <button
              className="btn btn--danger"
              onClick={async () => {
                await api(`/api/tags/${pendingTagDelete.id}`, { method: "DELETE", token });
                await reloadTags();
                setPendingTagDelete(null);
              }}
            >
              Sil
            </button>
          </div>
        </div>
      </div>
    )}  
    </Card>
  );
};



// ---- Todos list / create ----
  const TodoList = ({ 
  token, scope, filterTagIds = [], setFilterTagIds, 
  tab, setTab, isTagPanelOpen, setIsTagPanelOpen, onChanged,
  allTags, reloadTags, uiTick, isGuest
}) => {
  const [todos, setTodos] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingComplete, setPendingComplete] = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [tagError, setTagError] = useState("");
  const [editError, setEditError] = useState("");
  const [pendingTagDelete, setPendingTagDelete] = useState(null);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tg = await api("/api/tags", { token });
        setTags(tg);
      } catch (e) {
        console.error("Etiketler yüklenemedi:", e);
      }
    };
    if (token) loadTags();
  }, [token, uiTick]);

    // Chip picker için toggle helper

  const deleteTodo = async (id) => {
    try {
      setError("");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.isGuest) {
        setError("Misafir kullanıcı görev silemez.");
        return;
      }
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
     
      
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); }, [path, filterTagIds.join(","), uiTick]);



  const toggle = async (todo) => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.isGuest) {
        setError("Misafir kullanıcı görev tamamlayamaz.");
        return;
      }
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
  // Düzenleme modalında "Yeni etiket" eklemek için helper
    const createNewTag = async () => {
      const name = (newTag || "").trim();

      // 1) Boş kontrolü
      if (!name) {
        setTagError("Etiket adı boş olamaz.");
        return;
      }

      // 2) İsteğe bağlı: Frontend kopya adı kontrolü
      if (allTags.some(t => (t.name || "").toLowerCase() === name.toLowerCase())) {
        setTagError("Bu adla bir etiket zaten var.");
        return;
      }

      try {
        // 3) Sunucuya eklet
        await api("/api/tags", { method: "POST", token, body: { name } });

        // 4) Temizle + listeyi yenile
        setNewTag("");
        setTagError("");
        await reloadTags();
      } catch (e) {
        // 5) Sunucu hata mesajını göster
        setTagError(e.message || "Etiket eklenemedi.");
      }
    };








  return (
    <div className="space-y-6">
      {/* ✅ Görevler + sekme toolbar kutusu */}
      <Card>
        {/* Sekmeler buraya taşındı */}
        <div className="toolbar mb-4 flex justify-between items-center">
          <div className="flex gap-2">
            {[
              { key: "inbox", label: "Inbox" },
              { key: "today", label: "Today" },
              { key: "upcoming", label: "Upcoming" },
            ].map(x => {
              const isGuest = JSON.parse(localStorage.getItem("user") || "{}")?.isGuest;
              const disabled = isGuest && x.key !== "inbox";
              return (
                <Button
                  key={x.key}
                  variant={tab === x.key ? "primary" : "default"}
                  onClick={() => !disabled && setTab(x.key)}
                  disabled={disabled}
                  className={disabled ? "opacity-50 cursor-not-allowed" : ""}
                >
                  {x.label}
                </Button>
              );
            })}

          </div>

          {/* Etiket filtresi dropdown aynı şekilde buraya */}
          <div className="relative ml-auto">
            <Button
              onClick={() => {
                if (!JSON.parse(localStorage.getItem("user") || "{}")?.isGuest) {
                  setIsTagPanelOpen(v => !v);
                }
              }}
              className={JSON.parse(localStorage.getItem("user") || "{}")?.isGuest ? "opacity-50 cursor-not-allowed" : ""}
            >
              Etiket Filtresi
            </Button>

            {isTagPanelOpen && (
              <div className="absolute right-0 mt-2 z-20 w-64 bg-white rounded-lg shadow-md border p-3">
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => {
                    const selected = filterTagIds.includes(Number(tag.id));
                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          const id = Number(tag.id);
                          setFilterTagIds(prev =>
                            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm border transition ${
                          selected
                            ? "bg-blue-50 border-blue-400 text-blue-800"
                            : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        #{tag.name}
                      </button>
                    );
                  })}
                </div>

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
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-gray-200">
          <table className="todo-table min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b w-1/2">Görev</th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b w-1/4">Durum</th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b w-1/4">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {todos.map(t => (
                <tr key={t.id} className="border-b">
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
                  <td className="px-4 py-2">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => !isGuest && !t.isCompleted && setPendingComplete(t)}
                        disabled={isGuest || t.isCompleted}
                        className={`min-w-[90px] px-3 py-1.5 rounded-md text-sm font-medium text-white ${
                          isGuest || t.isCompleted
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-blue-500 hover:bg-blue-600"
                        }`}
                      >
                        Tamamlandı
                      </button>

                      <button
                        onClick={() => !isGuest && setPendingDelete({ id: t.id, title: t.title })}
                        disabled={isGuest}
                        className={`min-w-[90px] px-3 py-1.5 rounded-md text-sm font-medium text-white ${
                          isGuest
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600"
                        }`}
                      >
                        Sil
                      </button>

                      <button
                        onClick={() => {
                          if (!isGuest) {
                            setEditingTodo({
                              ...t,
                              tagIds: (t.tags || []).map(tag => tag.id)
                            });
                          }
                        }}
                        disabled={isGuest}
                        className={`min-w-[90px] px-3 py-1.5 rounded-md text-sm font-medium text-white ${
                          isGuest
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-yellow-400 hover:bg-yellow-500"
                        }`}
                      >
                        Düzenle
                      </button>
                    </div>
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
      {editingTodo && !JSON.parse(localStorage.getItem("user") || "{}")?.isGuest && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal__title text-2xl font-bold text-gray-900">
              Görevi Düzenle
            </h3>

            <div className="space-y-3">
              <label className="block text-sm">
                Başlık
                <Input
                  value={editingTodo.title}
                  onChange={(e)=>setEditingTodo({...editingTodo, title: e.target.value})}
                />
              </label>

              {/* 📅 Tarih */}
              <div className="form-group">
                <div className="mb-1">
                  <label className="block text-sm">Tarih</label>
                </div>
                <DatePicker
                  selected={editingTodo.dueDate ? new Date(editingTodo.dueDate) : null}
                  onChange={(date)=>setEditingTodo({...editingTodo, dueDate: date ? date.toISOString() : null})}
                  dateFormat="dd.MM.yyyy"
                  className="input block w-full"
                  placeholderText="Tarih seç"
                />
              </div>

              {/* ✅ Tamamlandı */}
              <div className="form-group">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editingTodo.isCompleted}
                    onChange={(e)=>setEditingTodo({...editingTodo, isCompleted: e.target.checked})}
                  />
                  Tamamlandı
                </label>
              </div>


              {/* 🏷️ Etiket seçici */}
              <div className="form-group relative">
                <Button
                  type="button"
                  onClick={() => setShowTagPanel((v) => !v)}
                  className="px-4 py-2 border rounded-md bg-white shadow-sm"
                >
                  Etiket Seç
                </Button>
                

                {showTagPanel && (
                  <div className="
                      absolute z-20 mt-2 w-72
                      bg-white border border-gray-200 rounded-lg shadow-xl
                      p-4 flex flex-col gap-3
                      max-h-64 overflow-y-auto
                      
                    ">  
                    
                    {/* ❌ Kapat butonu */}
                    <button
                      type="button"
                      onClick={() => setShowTagPanel(false)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg"
                    >
                      ✕
                    </button>

                    <div className="tag-chip-container flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {allTags.length === 0 && (
                        <div className="text-sm text-gray-500">Hiç etiket yok</div>
                      )}

                      {allTags.map(tag => {
                        const selected = editingTodo.tagIds?.includes(tag.id);
                        return (
                          <div
                            key={tag.id}
                            className={`tag-chip ${selected ? "selected" : ""}`}
                          >
                            <span
                              className="tag-label"
                              onClick={() => {
                                const ids = editingTodo.tagIds || [];
                                setEditingTodo({
                                  ...editingTodo,
                                  tagIds: selected
                                    ? ids.filter(x => x !== tag.id)
                                    : [...ids, tag.id]
                                });
                              }}
                            >
                              #{tag.name}
                            </span>
                            <button
                              type="button"
                              className="tag-remove"
                              onClick={() => setPendingTagDelete(tag)}
                            >
                              ✕
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
                        onChange={(e) => {
                          setNewTag(e.target.value);
                          setTagError(""); 
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            await createNewTag();
                          }
                        }}
                        className="tag-add-input px-3 py-1.5 border border-gray-300 rounded-full text-sm bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <Button
                        type="button"
                        onClick={createNewTag}
                        className="px-2 py-1 border rounded-md text-sm bg-gray-100 hover:bg-gray-200"
                      >
                        Ekle
                      </Button>
                    </div>

                    {tagError && <div className="text-red-600 text-xs mt-1">{tagError}</div>}
                  </div>
                )}


              </div>

            </div>

            <div className="modal__actions mt-4 flex justify-end gap-2">
              <button
                className="btn"
                onClick={() => setEditingTodo(null)}
              >
                İptal
              </button>

              <button
                className="btn btn--primary"
                onClick={async () => {
                  const newTitle = editingTodo.title.trim();
                  setEditError("");

                  if (!newTitle) {
                    setEditError("Başlık boş olamaz.");
                    return;
                  }

                  // ⛔ Aynı isimde başka görev var mı?
                  const existing = await api("/api/todos", { token });
                  const sameTitle = existing.some(
                    (t) =>
                      t.id !== editingTodo.id &&
                      t.title.trim().toLowerCase() === newTitle.toLowerCase()
                  );

                  if (sameTitle) {
                    setEditError("Bu başlığa sahip başka bir görev zaten var.");
                    return;
                  }

                  await api(`/api/todos/${editingTodo.id}`, {
                    method: "PUT",
                    token,
                    body: {
                      title: newTitle,
                      dueDate: editingTodo.dueDate,
                      isCompleted: editingTodo.isCompleted,
                    },
                  });

                  await api(`/api/todos/${editingTodo.id}/tags`, {
                    method: "PUT",
                    token,
                    body: { tagIds: editingTodo.tagIds || [] },
                  });

                  setEditingTodo(null);
                  await load();
                  onChanged?.();
                }}
              >
                Kaydet
              </button>


            </div>
            {editError && (
              <div className="text-red-600 text-sm mt-2">{editError}</div>
            )}

          </div>
        </div>
        
      )}
      {pendingTagDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal__title">Etiketi Sil</h3>
            <p className="modal__text">
              “{pendingTagDelete.name}” etiketini silmek istediğine emin misin?
            </p>
            <div className="modal__actions">
              <button className="btn" onClick={() => setPendingTagDelete(null)}>
                İptal
              </button>
              <button
                className="btn btn--danger"
                onClick={async () => {
                  await api(`/api/tags/${pendingTagDelete.id}`, { method: "DELETE", token });
                  setPendingTagDelete(null);
                  await reloadTags();
                }}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );


};

// ---- Calendar ----
const CalendarView = ({ token, uiTick }) => {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); 
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [data, setData] = useState({});
  const [error, setError] = useState("");
  const isGuest = JSON.parse(localStorage.getItem("user") || "{}")?.isGuest;

  const load = async () => {
    try {
      setError("");
      const qs = new URLSearchParams({
        month,
        includeCompleted: includeCompleted ? "true" : "false"
      });
      const d = await api(`/api/todos/calendar?${qs.toString()}`, { token });
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  };

  // Guest değilse verileri yükle
  useEffect(() => {
    if (token && !isGuest) load();
  }, [month, includeCompleted, token, uiTick]);

  return (
    <Card>
      <h2 className="text-3xl font-semibold mb-4 flex items-center gap-2">Takvim</h2>

      {/* Filtre alanı */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="block text-sm mb-1">Ay</label>
          <DatePicker
            selected={month ? new Date(month + "-01") : null}
            onChange={(date) => setMonth(date ? date.toISOString().slice(0, 7) : "")}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            className="input"
            disabled={isGuest}
          />
        </div>

        {/* Modern Toggle */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">Tamamlananlar</label>
          <button
            onClick={() => !isGuest && setIncludeCompleted(v => !v)}
            disabled={isGuest}
            className={`relative w-12 h-6 rounded-full transition ${
              includeCompleted ? "bg-green-500" : "bg-gray-300"
            } ${isGuest ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
                includeCompleted ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {isGuest ? (
        <div className="text-red-600 text-sm mb-2">
          Bu işlemi yapmak için yetkiniz yok. (Misafir kullanıcılar takvime erişemez)
        </div>
      ) : (
        <>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

          {/* Günlere göre görev kartları */}
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
            {Object.keys(data).sort().map(day => (
              <div key={day} className="border rounded-xl p-4 shadow-sm bg-gray-50">
                <div className="text-base font-semibold mb-3">{day}</div>

                <div className="space-y-2">
                  {data[day].map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
                    >
                      <div>
                        <div className="font-medium">{item.title}</div>
                        {item.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {item.tags.map(t => (
                              <span
                                key={t.id}
                                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-300"
                              >
                                #{t.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {item.isCompleted && (
                        <span className="text-green-500 text-lg">✅</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(data).length === 0 && (
              <div className="text-sm text-gray-500">
                Bu ay için dueDate atanmış görev bulunamadı.
              </div>
            )}
          </div>
        </>
      )}
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);



 const loadAllTags = async () => {
    try {
      const tg = await api("/api/tags", { token });
      setAllTags(tg);
      // Etiket filtresi paneli için
      // (TodoList içinde prop olarak kullanılabilir)
    } catch (e) {
      console.error(e);
    }
  };


  useEffect(() => {
    if (token) loadAllTags();
  }, [token]);

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

    <header className="header w-full">
      <div className="header__inner flex items-center justify-between w-full px-8">
        
        {/* Sol */}
        <h1 className="text-xl font-semibold">Taskly</h1>

        {/* Sağ */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
              Merhaba,{" "}
              <b>
                {user?.username
                  ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
                  : ""}
              </b>
            </span>
          <Button onClick={() => setShowLogoutConfirm(true)}>
            Çıkış
          </Button>
        </div>

      </div>
    </header>





    {/* İçerik */}
    <main className="grid-layout">
      {/* Sol sütun */}
      <div className="left-col space-y-6">
        <GoalsHeader token={token} uiTick={uiTick}/>
        <TodoCreateForm
          token={token}
          isGuest={user?.isGuest}
          onCreated={bump}
          allTags={allTags}
          reloadTags={loadAllTags}
        />
      </div>

      {/* Orta sütun */}
      <div className="center-col">
        <TodoList
          token={token}
          isGuest={user?.isGuest}
          scope={tab}
          filterTagIds={filterTagIds}
          setFilterTagIds={setFilterTagIds}
          tab={tab}
          setTab={setTab}
          isTagPanelOpen={isTagPanelOpen}
          setIsTagPanelOpen={setIsTagPanelOpen}
          onChanged={bump}
          allTags={allTags}
          reloadTags={loadAllTags}
          uiTick={uiTick}
        />
      </div>

      {/* Sağ sütun */}
      <div className="right-col">
        <CalendarView token={token} uiTick={uiTick} />
      </div>
    {showLogoutConfirm && (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal">
          <h3 className="modal__title">Çıkış Yap</h3>
          <p className="modal__text">
            Uygulamadan çıkmak istediğinize emin misiniz?
          </p>
          <div className="modal__actions">
            <button
              className="btn"
              onClick={() => setShowLogoutConfirm(false)}
            >
              İptal
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                logout();
                setShowLogoutConfirm(false);
              }}
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    )}
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

