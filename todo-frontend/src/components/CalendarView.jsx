import { useState, useEffect } from "react";
import { Card } from "./UI";
import { api } from "../utils/api";
import DatePicker from "react-datepicker";

// 📌 Türkçe yerelleştirme eklendi
import { registerLocale } from "react-datepicker";
import tr from "date-fns/locale/tr";
registerLocale("tr", tr);

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
        includeCompleted: includeCompleted ? "true" : "false",
      });
      const d = await api(`/api/todos/calendar?${qs.toString()}`, { token });
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (token && !isGuest) load();
  }, [month, includeCompleted, token, uiTick]);

  return (
    <Card>
      <h2 className="text-3xl font-semibold mb-4 flex items-center gap-2">Takvim</h2>

      <div className="flex items-center gap-4 mb-4">
        {/* 📅 Ay seçici */}
        <div>
          <label className="block text-sm mb-1">Ay</label>
          <DatePicker
            selected={month ? new Date(month + "-01") : null}
            onChange={(date) => setMonth(date ? date.toISOString().slice(0, 7) : "")}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            locale="tr"                // 🌟 Türkçe takvim
            className="input"
            disabled={isGuest}
          />
        </div>

        {/* ✅ Tamamlananlar toggle */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">Tamamlananlar</label>
          <button
            onClick={() => !isGuest && setIncludeCompleted((v) => !v)}
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

      {/* ⚠️ Hata mesajı */}
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      {/* 📌 Görevler günlere göre listelenecek */}
      {!isGuest && (
        <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
          {Object.keys(data).sort().map((day) => (
            <div key={day} className="border rounded-xl p-4 shadow-sm bg-gray-50">
              <div className="text-base font-semibold mb-3">{day}</div>

              <div className="space-y-2">
                {data[day].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
                  >
                    <div>
                      <div className="font-medium">{item.title}</div>
                      {item.tags?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {item.tags.map((t) => (
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
                    {item.isCompleted && <span className="text-green-500 text-lg">✅</span>}
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
      )}
      {isGuest && (
        <div className="text-red-600 text-sm">
          Bu işlemi yapmak için yetkiniz yok. (Misafir kullanıcılar takvime erişemez)
        </div>
      )}
    </Card>
  );
};

export default CalendarView;
