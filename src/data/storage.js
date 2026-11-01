const STORAGE_KEY = "sprint-inercial-v1";
const DATABASE_NAME = "sprint-inercial-documents";
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = "documents";

export const DEFAULT_REWARDS = [
  { id: "coffee", name: "Tomar un café", icon: "☕", custom: false },
  { id: "song", name: "Escuchar una canción", icon: "♫", custom: false },
  { id: "walk", name: "Dar una caminata", icon: "↗", custom: false },
];

export const SEED_TASKS = [
  { id: "task-1", title: "Revisar apuntes de la semana", subject: "Estudio personal", status: "pending", duration: 30, priority: "media", due: "" },
];

export const initialState = {
  schemaVersion: 1,
  subjects: [],
  tasks: SEED_TASKS,
  history: [],
  rewards: DEFAULT_REWARDS,
  documents: [],
  timer: null,
  activeView: "home",
  taskFilter: "all",
  theme: "system",
};

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...structuredClone(initialState), ...saved, timer: saved?.timer || null };
  } catch {
    return structuredClone(initialState);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: 1 }));
}

export function clearAppStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DOCUMENT_STORE)) {
        request.result.createObjectStore(DOCUMENT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento de documentos."));
  });
}

export async function saveDocument(document) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, "readwrite");
    transaction.objectStore(DOCUMENT_STORE).put(document);
    transaction.oncomplete = () => { database.close(); resolve(document); };
    transaction.onerror = () => { database.close(); reject(new Error("No se pudo guardar el documento.")); };
  });
}

export async function listDocuments() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(DOCUMENT_STORE, "readonly").objectStore(DOCUMENT_STORE).getAll();
    request.onsuccess = () => { database.close(); resolve(request.result); };
    request.onerror = () => { database.close(); reject(new Error("No se pudieron consultar los documentos.")); };
  });
}

export async function getDocument(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(DOCUMENT_STORE, "readonly").objectStore(DOCUMENT_STORE).get(id);
    request.onsuccess = () => { database.close(); resolve(request.result); };
    request.onerror = () => { database.close(); reject(new Error("No se pudo leer el documento.")); };
  });
}

export async function deleteDocument(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, "readwrite");
    transaction.objectStore(DOCUMENT_STORE).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(new Error("No se pudo eliminar el documento.")); };
  });
}

export async function clearDocuments() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, "readwrite");
    transaction.objectStore(DOCUMENT_STORE).clear();
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(new Error("No se pudieron eliminar los documentos.")); };
  });
}
