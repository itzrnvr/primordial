// ============================================================
// PERSIST - tiny helpers to keep sim state across page refreshes
// in localStorage. Weights are stored as base64 of Float32Array.
// Everything is guarded: a corrupt or missing save just means a
// fresh start, never a crash.
// ============================================================

export function f32ToB64(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

export function b64ToF32(b64, len) {
  try {
    const s = atob(b64);
    if (s.length !== len * 4) return null;
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return new Float32Array(bytes.buffer, 0, len);
  } catch {
    return null;
  }
}

export function saveJSON(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch { return false; }
}

export function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearKey(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
