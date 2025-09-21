import React, { useEffect, useState } from "react";
import "./app.css";

import { useAuth } from "./hooks/useAuth";
import { api } from "./utils/api";

import { Button } from "./components/UI";
import AuthPanel from "./components/AuthPanel";
import GoalsHeader from "./components/GoalsHeader";
import TodoCreateForm from "./components/TodoCreateForm";
import TodoList from "./components/TodoList";
import CalendarView from "./components/CalendarView";


// ---- Main App ----
export default function App() {
  const { token, user, saveAuth, logout } = useAuth();
  const isGuest = user?.isGuest;
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
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) loadAllTags();
  }, [token]);
  useEffect(() => {
    if (token) {
      setTab("inbox");
    }
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

  if (!token) {
    return (
      <div className="login-page flex h-screen">
      {/* Sol 2/3 - Görsel */}
      <div className="w-2/3 h-full">
        <img
          src="/login-illustration.jpg"
          alt="Taskly Illustration"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Sağ 1/3 - Giriş paneli */}
      <div className="w-1/3 flex items-center justify-center bg-white">
        <div className="login-box w-full max-w-sm px-8">
          <h1 className="login-title text-3xl font-bold mb-6 text-center">Taskly</h1>
          <p className="text-center text-slate-500 mb-4">Her şey kontrol altında...</p>

          <AuthPanel onAuth={(tk, usr) => saveAuth(tk, usr)} />

          <p className="login-note text-center text-sm mt-4 text-gray-500">
            Not: Misafir kullanıcı sadece Inbox’ta görev açabilir.
          </p>
        </div>
      </div>
    </div>
    );
  }


  return (
    <div className="page">

      <header className="header w-full">
        <div className="header__inner flex items-center justify-between w-full px-8">
          
          {/* Sol */}
          <h1 className="text-3xl font-semibold">Taskly</h1>

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
      <main className={`grid-layout ${user?.isGuest ? "has-2-cols" : "has-3-cols"}`}>
        
        {/* Sol sütun */}
        <div className="left-col space-y-6">
          {!user?.isGuest && <GoalsHeader token={token} uiTick={uiTick} />}
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
        {!user?.isGuest && (
          <div className="right-col">
            <CalendarView token={token} uiTick={uiTick} />
          </div>
        )}

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
