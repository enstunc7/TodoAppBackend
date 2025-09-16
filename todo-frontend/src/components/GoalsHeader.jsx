import React, { useState, useEffect } from "react";
import { api } from "../utils/api"; // api yardımcı fonksiyonunu buradan import edeceğiz

// UI yardımcıları App.jsx içinde tanımlıysa App.jsx'ten import et veya oradan çıkarıp ayrı bir ui klasörüne taşıyabilirsin
import { Card, Button, Input } from "./UI"; 
// ⚠️ Eğer Card, Button, Input bileşenleri henüz ayrı dosyada değilse şimdilik App.jsx içinden export edip buraya import etmen yeterli olur.

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

export default GoalsHeader;
