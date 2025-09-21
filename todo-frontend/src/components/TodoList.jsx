import React, { useState, useEffect, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { api } from "../utils/api";
import { Card, Button, Input } from "./UI"; 
// ⚠️ Not: Card, Button, Input bileşenlerini App.jsx içinden export etmen veya ayrı UI dosyalarına taşıman gerekir

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

  const deleteTodo = async (id) => {
    try {
      setError("");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.isGuest) {
        setError("Misafir kullanıcı görev silemez.");
        return;
      }
      await api(`/api/todos/${id}`, { method: "DELETE", token });
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setPendingDelete(null);
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
      setLoading(true);
      setError("");
      const data = await api(path, { token });
      const filtered = (filterTagIds && filterTagIds.length)
        ? data.filter(todo => {
            const todoTagIds = new Set((todo.tags || []).map(x => x.id));
            return filterTagIds.every(id => todoTagIds.has(id));
          })
        : data;
      setTodos(filtered);
    } catch (e) { 
      setError(e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { load(); }, [path, filterTagIds.join(","), uiTick]);

  const toggle = async (todo) => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.isGuest) {
        setError("Misafir kullanıcı görev tamamlayamaz.");
        return;
      }
      await api(`/api/todos/${todo.id}`, { 
        method: "PUT", 
        token, 
        body: { title: todo.title, isCompleted: !todo.isCompleted, dueDate: todo.dueDate } 
      });
      await load();
      onChanged?.();
    } catch(e){ setError(e.message); }
  };

  const remove = async (todoId) => {
    try {
      await api(`/api/todos/${todoId}`, { method: "DELETE", token });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const assignTags = async (todoId, tagIds) => {
    try {
      await api(`/api/todos/${todoId}/tags`, { method: "PUT", token, body: { tagIds } });
      await load();
    } catch(e){ setError(e.message); }
  };

  const toggleTagForTodo = async (todo, tagId) => {
    const currentIds = (todo.tags || []).map(t => t.id);
    const nextIds = currentIds.includes(tagId)
      ? currentIds.filter(id => id !== tagId)
      : [...currentIds, tagId];
    await assignTags(todo.id, nextIds);
  };

  const createNewTag = async () => {
    const name = (newTag || "").trim();
    if (!name) {
      setTagError("Etiket adı boş olamaz.");
      return;
    }
    if (allTags.some(t => (t.name || "").toLowerCase() === name.toLowerCase())) {
      setTagError("Bu adla bir etiket zaten var.");
      return;
    }
    try {
      await api("/api/tags", { method: "POST", token, body: { name } });
      setNewTag("");
      setTagError("");
      await reloadTags();
    } catch (e) {
      setTagError(e.message || "Etiket eklenemedi.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="toolbar mb-4 flex justify-between items-center">
          <div className="flex gap-2">
            {[
              { key: "inbox", label: "Inbox" },
              { key: "today", label: "Today" },
              { key: "upcoming", label: "Upcoming" },
            ]
              .filter(x => {
                const isGuest = JSON.parse(localStorage.getItem("user") || "{}")?.isGuest;
                return isGuest ? x.key === "inbox" : true;
              })
              .map(x => (
                <Button
                  key={x.key}
                  variant={tab === x.key ? "primary" : "default"}
                  onClick={() => setTab(x.key)}
                >
                  {x.label}
                </Button>
              ))}
          </div>

          <div className="relative ml-auto">
            {!JSON.parse(localStorage.getItem("user") || "{}")?.isGuest && (
              <Button
                onClick={() => setIsTagPanelOpen(v => !v)}
              >
                Etiket Filtresi
              </Button>
            )}

            {isTagPanelOpen && (
              <div className="absolute right-0 mt-2 z-20 w-64 bg-white rounded-lg shadow-md border p-3">
                {/* Eğer hiç etiket yoksa uyarı */}
                {allTags.length === 0 ? (
                  <div className="text-sm text-gray-500 py-1">
                    Hiç etiket yok
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map(tag => {
                        const selected = filterTagIds.includes(Number(tag.id));
                        return (
                          <button
                            key={tag.id}
                            onClick={() => {
                              const id = Number(tag.id);
                              setFilterTagIds(prev =>
                                prev.includes(id)
                                  ? prev.filter(x => x !== id)
                                  : [...prev, id]
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
                  </>
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
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b w-1/2">
                  Görev
                </th>
                {!isGuest && (
                  <>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b w-1/4">
                      Durum
                    </th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b w-1/4">
                      İşlemler
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {todos.map(t => (
                <tr key={t.id} className="border-b">
                  {/* Görev sütunu */}
                  <td className="px-4 py-2 align-top">
                    <div className="font-medium">{t.title}</div>
                    {scope !== "inbox" && t.dueDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(t.dueDate).toLocaleDateString("tr-TR")}
                      </div>
                    )}
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

                  {/* ✅ Sadece normal kullanıcılar için */}
                  {!isGuest && (
                    <>
                      <td className="px-4 py-2">
                        <span className={`status-badge ${t.isCompleted ? "status-done" : "status-pending"}`}>
                          {t.isCompleted ? "Tamamlandı" : "Bekliyor"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center gap-2">
                          {/* Tamamla butonu */}
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

                          {/* Sil butonu */}
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

                          {/* Düzenle butonu */}
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
                    </>
                  )}
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </Card>

      {/* ✅ Silme modalı */}
      {pendingDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal__title">Görevi sil</h3>
            <p className="modal__text">
              “{pendingDelete.title}” görevini silmek istediğine emin misin?
            </p>
            <div className="modal__actions">
              <button className="btn" onClick={() => setPendingDelete(null)}>İptal</button>
              <button className="btn btn--danger" onClick={() => deleteTodo(pendingDelete.id)}>Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Tamamlama modalı */}
      {pendingComplete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal__title">Görevi Tamamla</h3>
            <p className="modal__text">
              “{pendingComplete.title}” görevini tamamlandı olarak işaretlemek istiyor musunuz?
            </p>
            <div className="modal__actions">
              <button className="btn" onClick={() => setPendingComplete(null)}>İptal</button>
              <button className="btn btn--primary" onClick={async () => {
                await toggle(pendingComplete);
                setPendingComplete(null);
              }}>Onayla</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Düzenleme modalı */}
      {editingTodo && !JSON.parse(localStorage.getItem("user") || "{}")?.isGuest && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal__title text-2xl font-bold text-gray-900">Görevi Düzenle</h3>
            <div className="space-y-3">
              <label className="block text-sm">
                Başlık
                <Input
                  value={editingTodo.title}
                  onChange={(e)=>setEditingTodo({...editingTodo, title: e.target.value})}
                />
              </label>

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

            {/* Düzenle içinde Etiket seçici (daima açık) */}
            <div className="flex flex-col border rounded-lg bg-white mt-2">
              <div className="px-3 py-2 border-b font-medium text-gray-700">
                Etiket Seç
              </div>

              <div className="flex-1 max-h-24 overflow-y-auto flex flex-wrap gap-2 p-3 scrollbar-white">
                {allTags.length === 0 && (
                  <div className="text-sm text-gray-500">Hiç etiket yok</div>
                )}
                {allTags.map(tag => {
                  const selected = editingTodo.tagIds?.includes(tag.id);
                  return (
                    <div key={tag.id} className={`tag-chip ${selected ? "selected" : ""}`}>
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

              <div className="flex items-center gap-2 pt-2 border-t px-3 pb-3">
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
                  className="tag-add-input flex-1 px-3 py-1.5 border border-gray-300 rounded-full text-sm bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <Button
                  type="button"
                  onClick={createNewTag}
                  className="px-3 py-1.5 border rounded-md text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Ekle
                </Button>
              </div>

              {tagError && <div className="text-red-600 text-xs mt-1 px-3">{tagError}</div>}
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

      {/* ✅ Etiket silme modalı */}
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

export default TodoList;

