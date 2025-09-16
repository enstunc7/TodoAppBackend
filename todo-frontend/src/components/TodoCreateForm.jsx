import React, { useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";  // 🌟 burada eklendi
import "react-datepicker/dist/react-datepicker.css";
import tr from "date-fns/locale/tr";
registerLocale("tr", tr);  // 📌 Türkçe takvim dili

import { api } from "../utils/api";
import { Card, Button, Input } from "./UI"; 
// ⚠️ Not: Card, Button, Input bileşenleri App.jsx içinde tanımlıysa oradan export etmen yeterli olur

const TodoCreateForm = ({ token, onCreated, allTags, reloadTags, isGuest }) => {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const [tagError, setTagError] = useState("");
  const [pendingTagDelete, setPendingTagDelete] = useState(null);

  const toggleSelTag = (id) => {
    setSelectedTags(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const createTag = async () => {
    try {
      setTagError("");
      const name = (newTag || "").trim();
      if (!name) {
        setTagError("Etiket adı boş olamaz.");
        return;
      }

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
        dueDate: dueDate ? new Date(dueDate).toLocaleDateString("en-CA") : null,
      };

      const t = await api("/api/todos", { method: "POST", token, body });

      if (selectedTags.length) {
        await api(`/api/todos/${t.id}/tags`, {
          method: "PUT",
          token,
          body: { tagIds: selectedTags },
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
            locale="tr" 
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
                  {allTags.map((tag) => {
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

              {!isGuest && (
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
                    <Button type="button" onClick={createTag}>
                      Ekle
                    </Button>
                  </div>
                  {tagError && (
                    <div className="text-red-600 text-sm mt-1">{tagError}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-600 text-sm mt-2 whitespace-pre-wrap">
            {error}
          </div>
        )}
        <button type="button" onClick={create} className="ekle-btn">
          Ekle
        </button>
      </div>

      {pendingTagDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal__title">Etiketi Sil</h3>
            <p className="modal__text">
              “{pendingTagDelete.name}” etiketini silmek istediğine emin misiniz?
            </p>
            <div className="modal__actions">
              <button
                className="btn"
                onClick={() => setPendingTagDelete(null)}
              >
                İptal
              </button>
              <button
                className="btn btn--danger"
                onClick={async () => {
                  await api(`/api/tags/${pendingTagDelete.id}`, {
                    method: "DELETE",
                    token,
                  });
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

export default TodoCreateForm;
