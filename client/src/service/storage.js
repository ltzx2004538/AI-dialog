// localStorage can throw or be unavailable (private window, blocked site data); values then just won't persist.
export function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Stored as 'true' / 'false'; anything else (never saved) gives the fallback.
export function readBooleanStorage(key, fallback) {
  const value = readStorage(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function writeStorage(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // See note above.
  }
}
