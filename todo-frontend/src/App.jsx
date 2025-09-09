import React, { useEffect, useMemo, useState } from "react";

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

// ---- API helper ----
const api = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get("content-type");
  return ct && ct.includes("application/json") ? res.json() : res.text();
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

// ---- UI helpers ----
const Card = ({ children }) => (
  <div className="rounded-2xl shadow p-4 bg-white border" >{children}</div>
);
const Button = ({ children, className = "", ...props }) => (
  <button className={`px-3 py-2 rounded-xl border hover:shadow ${className}`} {...props}>{children}</button>
);
const Input = (props) => (
  <input {...props} className={`px-3 py-2 rounded-xl border w-full ${props.className||""}`} />
);
const Select = (props) => (
  <select {...props} className={`px-3 py-2 rounded-xl border w-full ${props.className||""}`} />
);

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
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const register = async () => {
    try {
      setLoading(true); setError("");
      await api("/api/auth/register", { method: "POST", body: { username, password } });
      await login();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const guest = async () => {
    try {
      setLoading(true); setError("");
      const data = await api("/api/auth/guest-login", { method: "POST" });
      onAuth(data.token, { id: data.userId, username: data.username, isGuest: true });
    } catch (e) { setError(e.message); } finally { setLoading(false); }
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
        {error && <div className="text-red-600 text-sm whitespace-pre-wrap">{error}</div>}
        <div className="text-xs text-gray-500">BASE_URL: {BASE_URL}</div>
      </div>
    </Card>
  );
};

// ---- Goals header ----
const GoalsHeader = ({ token }) => {
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
  useEffect(()=>{ load(); }, [token]);

  const [newGoal, setNewGoal] = useState("");
  const updateGoal = async () => {
    try {
      const v = parseInt(newGoal || "0", 10);
      await api("/api/goals", { method: "PUT", token, body: { dailyGoal: v } });
      setNewGoal("");
      await load();
    } catch(e){ setError(e.message); }
  };

  return (
    <Card>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-lg font-semibold">Hedef: {progress ? `${progress.completedToday} / ${progress.dailyGoal}` : `${0} / ${goal}`}</div>
        {progress?.achieved && <span title="Hedefe ulaşıldı" className="text-2xl">🏆</span>}
        <div className="ml-auto flex items-center gap-2">
          <Input placeholder="Günlük hedef" value={newGoal} onChange={e=>setNewGoal(e.target.value)} style={{width:140}} />
          <Button onClick={updateGoal}>Kaydet</Button>
          <Button onClick={load}>Yenile</Button>
        </div>
      </div>
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
    </Card>
  );
};

// ---- Todos list / create ----
const TodoList = ({ token, scope, filterTagIds = [] }) => {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [selectedTags, setSelectedTags] = useState([]); // number[]  (yeni todo için)
  const [tagPanelOpenFor, setTagPanelOpenFor] = useState(null); // number | null (liste öğesi için etiket düzen paneli)
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

    // Chip picker için toggle helper
  const toggleSelTag = (id) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const createTag = async () => {
    try {
      setError("");
      const name = (newTag || "").trim();
      if (!name) { setError("Etiket adı boş olamaz."); return; }
      await api("/api/tags", { method: "POST", token, body: { name } });
      setNewTag("");
      const tg = await api("/api/tags", { token });
      setTags(tg);
    } catch (e) { setError(e.message); }
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
  useEffect(()=>{ load(); }, [path, [...filterTagIds].sort().join(",")]);

  const create = async () => {
    try {
      setError("");
      const body = { title, isCompleted: false, dueDate: dueDate ? new Date(dueDate).toISOString() : null };
      const t = await api("/api/todos", { method: "POST", token, body });
      if (selectedTags.length) {
       await api(`/api/todos/${t.id}/tags`, { method: "PUT", token, body: { tagIds: selectedTags } }); // number[]
      }
      setTitle(""); setDueDate(""); setSelectedTags([]);
      await load();
    } catch(e){ setError(e.message); }
  };

  const toggle = async (todo) => {
    try {
      await api(`/api/todos/${todo.id}`, { method: "PUT", token, body: { title: todo.title, isCompleted: !todo.isCompleted, dueDate: todo.dueDate } });
      await load();
    } catch(e){ setError(e.message); }
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
    <Card>
      <div className="space-y-4">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm mb-1">Başlık</label>
            <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Yeni görev" />
          </div>
          <div>
            <label className="block text-sm mb-1">Tarih (DueDate)</label>
            <Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-sm mb-1">Etiketler</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(t => {
                const picked = selectedTags.includes(t.id); // number[]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleSelTag(t.id)}
                    aria-pressed={picked}
                    className={`px-2 py-1 rounded-full border text-sm transition
                      ${picked
                        ? "bg-black text-white border-black ring-2 ring-blue-400"
                        : "bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200"} 
                      focus:outline-none`}
                    title="Tıkla: etiketi seç/çıkar (sadece yeni todo için)"
                  >
                    #{t.name}{picked && <span className="ml-1">✓</span>}
                  </button>
                );
              })}
              {tags.length === 0 && (
                <span className="text-xs text-gray-500">Henüz etiket yok.</span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Bu bölüm sadece yeni todo için etiket seçer. Filtreleme üstteki “Etiket Filtresi” panelinden yapılır.
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-sm mb-1">Yeni etiket</label>
              <Input value={newTag} onChange={(e)=>setNewTag(e.target.value)} placeholder="#etiket" style={{width:180}}/>
            </div>
            <Button onClick={createTag}>Etiket Ekle</Button>
          </div>
          <Button onClick={create}>Ekle</Button>
          <Button onClick={load}>Yenile</Button>
        </div>

        {error && <div className="text-red-600 text-sm whitespace-pre-wrap">{error}</div>}

        <ul className="divide-y">
          {todos.map(t => (
            <li key={t.id} className="py-3 flex items-start gap-3">
              <input type="checkbox" checked={t.isCompleted} onChange={()=>toggle(t)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-gray-500">Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "(Inbox)"}</div>
                <div className="mt-1">
                  <Button
                    className="text-sm"
                    onClick={() => setTagPanelOpenFor(prev => prev === t.id ? null : t.id)}
                  >
                    Etiketler
                  </Button>
                </div>

                <div className="flex gap-2 mt-1 flex-wrap">
                  {(t.tags || []).map(tag => (
                    <span key={tag.id} className="text-xs px-2 py-1 rounded-full border bg-gray-50">#{tag.name}</span>
                  ))}
                </div>
                {tagPanelOpenFor === t.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const picked = (t.tags || []).some(x => x.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTagForTodo(t, tag.id)}
                          aria-pressed={picked}
                          className={`px-2 py-1 rounded-full border text-sm transition
                            ${picked
                              ? "bg-black text-white border-black ring-2 ring-blue-400"
                              : "bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200"}
                            focus:outline-none`}
                          title="Tıkla: etiketi seç/çıkar"
                        >
                          #{tag.name}{picked && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                    {tags.length === 0 && (
                      <span className="text-xs text-gray-500">Henüz etiket yok.</span>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
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
          <Input type="month" value={month} onChange={e=>setMonth(e.target.value)} />
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

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Todo App (Frontend)</h1>
          <AuthPanel onAuth={(tk, usr) => saveAuth(tk, usr)} />
          <div className="text-xs text-gray-500">Not: Guest kullanıcı güncelleme yapamaz, sadece Inbox'ta görev açabilir.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Todo App</h1>
          <div className="text-sm text-gray-600">Merhaba, <b>{user?.username}</b></div>
          <Button className="ml-auto" onClick={logout}>Çıkış</Button>
        </div>

        <GoalsHeader token={token} />

        <div className="flex gap-2">
          {[
            {key:"inbox", label:"Inbox"},
            {key:"today", label:"Today"},
            {key:"upcoming", label:"Upcoming"},
            {key:"calendar", label:"Calendar"},
          ].map(x => (
            <Button key={x.key} onClick={()=>setTab(x.key)} className={tab===x.key?"bg-black text-white":""}>{x.label}</Button>
          ))}
          <Button onClick={()=>setIsTagPanelOpen(v=>!v)}>Etiket Filtresi</Button>
          {filterTagIds.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {allTags.filter(t => filterTagIds.includes(t.id)).map(t => (
                  <Button key={t.id} className="bg-amber-100 border-amber-300"
                          onClick={()=>toggleFilterTag(t.id)}>
                    #{t.name} ✕
                  </Button>
                ))}
              </div>
              <Button onClick={clearAllFilters}>Temizle</Button>
              <span className="text-xs text-gray-600 self-center">(AND)</span>
            </>
          )}
        </div>

        {isTagPanelOpen && (
          <Card>
            <div className="flex flex-wrap gap-2">
              {allTags.map(t => {
                const active = filterTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={()=>toggleFilterTag(t.id)}
                    className={`px-2 py-1 rounded-full border text-sm
                      ${active ? "bg-black text-white" : "bg-gray-50 hover:bg-gray-100"}`}
                    title="Filtreye ekle/çıkar"
                  >
                    #{t.name}
                  </button>
                );
              })}
              {allTags.length === 0 && <span className="text-xs text-gray-500">Etiket yok</span>}
            </div>
            <div className="text-[11px] text-gray-500 mt-2">
              Seçilen TÜM etiketlere sahip görevler listelenir (AND).
            </div>
          </Card>
        )}
        

        {tab !== "calendar" ? (
          <TodoList
            token={token}
            scope={tab}
            filterTagIds={filterTagIds} // AND filtresi
          />
        ) : (
          <CalendarView token={token} />
        )}
      </div>
    </div>
  );
}
