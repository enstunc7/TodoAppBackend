const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:7254"; // change if needed

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
      m = m.replace(
        /^The\s+field\s+(.+?)\s+must be a string or array type with a minimum length of '(\d+)'\.?$/i,
        (_, fld, n) => `${(FIELD_TR_MAP[fld] || fld)} en az ${n} karakter olmalıdır.`
      );
      m = m.replace(
        /^The\s+(.+?)\s+field must be at least (\d+) characters long\.?$/i,
        (_, fld, n) => `${(FIELD_TR_MAP[fld] || fld)} en az ${n} karakter olmalıdır.`
      );
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
  return Array.from(new Set(lines)).join("\n");
}

function translateProblem(message) {
  if (!message) return "";
  if (/One or more validation errors occurred/i.test(message)) return "Lütfen formu kontrol edin.";
  if (/Invalid username or password/i.test(message)) return "Kullanıcı adı veya şifre hatalı.";
  return message;
}

export const api = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "tr-TR",
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
