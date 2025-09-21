import { useState, useEffect, useRef } from "react";
import { Card, Button } from "./UI";
import { api } from "../utils/api";

// FullCalendar importları
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import trLocale from "@fullcalendar/core/locales/tr";

const CalendarView = ({ token, uiTick }) => {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const isGuest = !!JSON.parse(localStorage.getItem("user") || "{}")?.isGuest;
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // 📌 Görevleri API’den çekip FullCalendar formatına çevir
  const load = async () => {
    try {
      setError("");
      const data = await api("/api/todos", { token });
      const mapped = data
        .filter((t) => !!t.dueDate) // sadece dueDate olanlar
        .map((t) => ({
          id: t.id,
          title: t.title,
          start: t.dueDate,
          backgroundColor: t.isCompleted ? "#6b7280" : "#3b82f6", // gri = tamamlanan, mavi = aktif
          borderColor: "transparent",  // kenar çizgisi kaldır
          textColor: "white"           // yazı rengi beyaz
        }));
      setEvents(mapped);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (token && !isGuest) load();
  }, [token, uiTick]);

  // 📌 Küçük calendar ayarları
  const smallCalendar = (
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      locales={[trLocale]}
      locale="tr"
      height="auto"
      events={events}
      showNonCurrentDates={false}    // diğer ayın günleri gözükmesin
      fixedWeekCount={false}         // fazla satır olmasın
      displayEventTime={false}       // saat gizli
      headerToolbar={{
        left: "prev,next",
        center: "title",
        right: ""
      }}
      eventDisplay="block" // 👈 kutucuk içinde göster
      eventTextColor="white" // 👈 yazı rengi beyaz
      datesSet={(arg) => {
        const newDate = arg.start;
        if (newDate.toISOString().slice(0, 10) !== currentDate.toISOString().slice(0, 10)) {
          setCurrentDate(newDate);
        }
      }}
    />
  );

  // 📌 Büyük calendar ayarları
  const largeCalendar = (
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      initialDate={currentDate} 
      locales={[trLocale]}
      locale="tr"
      events={events}
      headerToolbar={{
        left: "prev,next",
        center: "title",
        right: ""
      }}
      showNonCurrentDates={false}
      fixedWeekCount={false}
      displayEventTime={false}
      height="100%"
      contentHeight="100%"
      aspectRatio={1.35}
      eventDisplay="block" // 👈 kutucuk içinde göster
      eventTextColor="white" // 👈 yazı rengi beyaz
    />
  );


  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-2xl font-semibold">Takvim</h2>
        {!isGuest && (
          <Button onClick={() => setExpanded(true)}>Büyüt</Button>
        )}
      </div>

      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      {!isGuest ? smallCalendar : (
        <div className="text-red-600 text-sm">
          Bu işlemi yapmak için yetkiniz yok. (Misafir kullanıcılar takvime erişemez)
        </div>
      )}

      {/* 📌 Büyük takvim modalı */}
      {expanded && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[90vw] h-[90vh] p-6 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-3xl font-bold">Takvim</h3>
              <Button onClick={() => setExpanded(false)}>Kapat</Button>
            </div>
            <div className="flex-1">{largeCalendar}</div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default CalendarView;
