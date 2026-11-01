import { getDocument } from "./storage.js";

const MAX_CONTEXT_CHARS = 24000;

export async function buildAcademicContext(state) {
  const subjects = state.subjects.map(({ name, teacher, description, schedule }) => ({
    name, teacher, description, schedule,
  }));
  const tasks = state.tasks.map(({ title, description, subject, status, due, priority }) => ({
    title, description, subject, status, due, priority,
  }));
  const documents = await Promise.all(state.documents.map(async ({ id, name, subjectId }) => {
    const stored = await getDocument(id).catch(() => null);
    return { id, name, subjectId, text: stored?.text || "" };
  }));
  return JSON.stringify({ subjects, tasks, documents }).slice(0, MAX_CONTEXT_CHARS);
}

export async function requestSuggestions(state) {
  const response = await fetch("/.netlify/functions/generate-suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: await buildAcademicContext(state) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudieron generar sugerencias.");
  return Array.isArray(payload.suggestions) ? payload.suggestions : [];
}
