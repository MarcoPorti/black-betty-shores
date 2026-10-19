import { BoatState } from "../types";

const DB_NAME = "tideboard-local";
const STORE_NAME = "app-state";
const STATE_KEY = "current";
const FALLBACK_KEY = "tideboard-state";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<BoatState | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve((request.result as BoatState | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    const backup = localStorage.getItem(FALLBACK_KEY);
    return backup ? JSON.parse(backup) as BoatState : null;
  }
}

export async function saveState(state: BoatState): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(state, STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  }
}
