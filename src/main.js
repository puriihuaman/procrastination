import "./style.css";
import { clearAppStorage, initialState, loadState, saveState as persistState, clearDocuments, saveDocument, deleteDocument, getDocument } from "./data/storage.js";
import { showConfirm, showDialog } from "./ui/dialogs.js";
import { extractPdfText, MAX_PDF_SIZE } from "./data/pdf.js";
import { requestSuggestions } from "./data/ai.js";

let state = loadState();
let timerTick;
let documentProcessing = false;
let aiLoading = false;
let serviceWorkerRegistration;

function preferredTheme() {
  if (state.theme === "light" || state.theme === "dark") return state.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  document.documentElement.dataset.theme = preferredTheme();
}

function saveState() {
  persistState(state);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function icon(name, size = 20) {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.6 1.6-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2H11v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.6-1.6.1-.1A1.7 1.7 0 0 0 6.8 15a1.7 1.7 0 0 0-1.5-1H5v-2h.3a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L8 7.4l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V6h2v.3a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.6 1.6-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.3v2h-.3a1.7 1.7 0 0 0-1.3 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  };
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plus}</svg>`;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function subjectNames() {
  return state.subjects.map((subject) => subject.name);
}

function render() {
  const app = document.querySelector("#app");
  app.innerHTML = `
    <div class="app-shell min-h-[calc(100vh-200px)]">
      <header class="topbar flex h-[82px] items-center justify-between border-b border-[var(--line)] bg-[var(--header)] px-[5vw]">
        <button class="brand flex items-center gap-2.5 border-0 bg-transparent text-left text-[15px] leading-[.96] tracking-[-.03em] text-[var(--ink)]" data-view="home" aria-label="Ir al inicio"><span class="brand-mark grid h-[31px] w-[31px] place-items-center rounded-full border-2 border-[var(--purple)] text-[25px] leading-none text-[var(--purple)]">◎</span><span>Sprint<br><em class="not-italic text-[var(--purple)]">Inercial</em></span></button>
        <div class="topbar-actions flex items-center gap-[22px] text-[12px] capitalize text-[var(--muted)]"><span class="date-label">${new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><button class="avatar h-[34px] w-[34px] rounded-full border border-[var(--line)] bg-[var(--card)] text-[var(--purple)]" aria-label="Perfil">P</button></div>
      </header>
      <div class="layout flex min-h-[calc(100vh-282px)] max-w-[1440px] m-auto">
        <nav class="sidebar flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--header)] p-[34px_22px]" aria-label="Navegación principal">
          ${navItem("home", "Inicio", "home")} ${navItem("tasks", "Mis tareas", "list")} ${navItem("subjects", "Materias", "book")} ${navItem("history", "Historial", "clock")}
          <div class="sidebar-spacer"></div>${navItem("settings", "Configuración", "gear")}
        </nav>
        <main class="content w-full max-w-[1120px] px-[clamp(25px,6vw,90px)] pb-[90px] pt-[60px]">${renderView()}</main>
      </div>
    </div>
    <div class="ticks"></div>
    <footer id="next-steps">
      <div class="footer-inner">
        <div class="footer-intro">
          <span class="footer-mark">◎</span>
          <div><h2>Próximos pasos</h2><p>Continúa con tu progreso y no dejes de avanzar.</p></div>
        </div>
        <div id="social">
          <div>
          <h2>Conecta con nosotros</h2>
          </div>

          <ul>
            <li>
              <a href="https://github.com/puriihuaman" target="_blank" rel="noreferrer">
                <svg class="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                puriihuaman
              </a>
            </li>

            <li>
              <a href="https://github.com/puriihuaman" target="_blank" rel="noreferrer">
                <svg class="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>

            <li>
              <a href="https://github.com/puriihuaman" target="_blank" rel="noreferrer">
                <svg class="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
          </ul>
        </div>
        <div class="footer-bottom">
          <span>© 2026 Sprint Inercial</span>
          <span>Hecho para avanzar con calma.</span>
        </div>
      </div>
    </footer>
  `;
  bindEvents();
  syncTimer();
  if ("serviceWorker" in navigator && !serviceWorkerRegistration) {
    serviceWorkerRegistration = navigator.serviceWorker.register("/sw.js").catch(() => null);
  }
}

function navItem(view, label, iconName) {
  const active = state.activeView === view;
  return `<button class="nav-item mb-[5px] flex w-full items-center gap-[13px] rounded-[9px] border-0 px-[14px] py-3 text-left text-[13px] transition ${active ? "bg-[var(--hover)] font-semibold text-[var(--ink)]" : "bg-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"}" data-view="${view}">${icon(iconName)}<span>${label}</span></button>`;
}

function renderView() {
  if (state.timer) return renderTimer();
  const views = { home: renderHome, tasks: renderTasks, subjects: renderSubjects, history: renderHistory, settings: renderSettings };
  return (views[state.activeView] || renderHome)();
}

function renderHome() {
  const pending = state.tasks.filter((task) => task.status !== "completed");
  const selected = pending[0];
  return `<section class="page home-page">
    <div class="eyebrow">MARTES, 31 DE OCTUBRE <span class="status-dot"></span></div>
    <div class="hero-copy"><h1>Un pequeño comienzo<br><em>cambia todo.</em></h1><p>Tu espacio para dejar de postergar y avanzar con calma.</p></div>
    <section class="focus-card">
      <div><span class="card-kicker">LISTO PARA EMPEZAR</span><h2>¿Qué quieres lograr hoy?</h2><p>${selected ? `Sugerencia: <strong>${escapeHtml(selected.title)}</strong>` : "Puedes comenzar sin seleccionar una tarea específica."}</p></div>
      <button class="primary-btn start-btn" data-action="prepare">${icon("play", 18)} Iniciar enfoque</button>
    </section>
    <div class="home-grid">
      <section class="panel task-preview"><div class="panel-heading"><div><span class="card-kicker">PRÓXIMO EN TU LISTA</span><h2>Tareas pendientes</h2></div><button class="text-btn" data-view="tasks">Ver todas ${icon("arrow", 16)}</button></div>
        ${pending.slice(0, 3).map(taskRow).join("") || emptyState("No tienes tareas pendientes", "Añade una para organizar tu próximo paso.")}
        <button class="add-line" data-action="new-task">${icon("plus", 16)} Añadir tarea</button>
      </section>
      <section class="panel rhythm-card"><span class="card-kicker">TU RITMO</span><h2>Esta semana</h2><div class="stat-number">${state.history.filter((item) => item.status === "completed").length}<small> ciclos</small></div><div class="week-bars">${[0, 1, 2, 3, 4, 5, 6].map((day, i) => `<div class="bar-day"><div class="bar ${i === 1 ? "today" : ""}" style="height:${Math.max(14, (state.history.filter((item) => item.status === "completed").length + i) % 5 * 9 + 14)}px"></div><small>${["L", "M", "X", "J", "V", "S", "D"][i]}</small></div>`).join("")}</div></section>
    </div>
  </section>`;
}

function taskRow(task) {
  const completed = task.status === "completed";
  return `<div class="task-row"><button type="button" class="task-check ${completed ? "done" : ""}" data-action="toggle-task" data-id="${task.id}" aria-label="${completed ? "Reabrir" : "Completar"} tarea: ${escapeHtml(task.title)}">${completed ? icon("check", 14) : ""}</button><div class="task-info"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.subject || "Sin materia")} · ${task.duration || 30} min</small></div><button class="row-arrow" data-action="select-task" data-id="${task.id}" aria-label="Seleccionar tarea">${icon("arrow", 16)}</button></div>`;
}

function renderTasks() {
  const filters = [
    { key: "all", label: "Todas", count: state.tasks.length },
    { key: "pending", label: "Pendientes", count: state.tasks.filter((task) => task.status !== "completed").length },
    { key: "completed", label: "Completadas", count: state.tasks.filter((task) => task.status === "completed").length },
  ];
  const visibleTasks = state.tasks.filter((task) => state.taskFilter === "completed" ? task.status === "completed" : state.taskFilter === "pending" ? task.status !== "completed" : true);
  return pageHeader("Mis tareas", "Todo lo que quieres mover hacia adelante.", `<div class="header-actions"><button class="outline-btn" data-action="generate-ai">${aiLoading ? "Analizando…" : "Sugerencias IA"}</button><button class="primary-btn" data-action="new-task">${icon("plus", 17)} Nueva tarea</button></div>`) + `<div class="filter-tabs" role="tablist">${filters.map((filter) => `<button role="tab" aria-selected="${state.taskFilter === filter.key}" class="${state.taskFilter === filter.key ? "selected" : ""}" data-filter="${filter.key}">${filter.label} (${filter.count})</button>`).join("")}</div>${state.suggestions?.length ? `<section class="panel suggestions-panel"><div class="panel-heading"><div><span class="card-kicker">REVISIÓN NECESARIA</span><h2>Sugerencias académicas</h2></div><span class="privacy-badge">Generadas con IA</span></div>${state.suggestions.map(suggestionCard).join("")}</section>` : ""}<section class="panel task-list">${visibleTasks.map((task) => `${taskRow(task)}<div class="task-actions"><button data-action="start-task" data-id="${task.id}">Enfocarme</button><button data-action="toggle-task" data-id="${task.id}">${task.status === "completed" ? "Reabrir" : "Completar"}</button><button data-action="edit-task" data-id="${task.id}">Editar</button><button data-action="delete-task" data-id="${task.id}" aria-label="Eliminar">${icon("trash", 15)}</button></div>`).join("") || emptyState(state.taskFilter === "completed" ? "No hay tareas completadas" : state.taskFilter === "pending" ? "No hay tareas pendientes" : "Tu lista está vacía", "Crea o cambia el filtro para continuar.")}</section>`;
}

function suggestionCard(suggestion, index) {
  const labels = { identified: "Identificada", suggested: "Sugerida", confirmation: "Por confirmar" };
  return `<article class="suggestion-card"><div class="suggestion-heading"><span class="suggestion-category ${suggestion.category}">${labels[suggestion.category] || "Revisar"}</span><small>${escapeHtml(suggestion.subject || "Sin materia")}</small></div><h3>${escapeHtml(suggestion.title || "Sin título")}</h3><p>${escapeHtml(suggestion.description || "Sin descripción disponible.")}</p><small>${suggestion.estimatedMinutes || "—"} min · ${escapeHtml(suggestion.justification || "Revisa esta sugerencia antes de aceptarla.")}</small>${suggestion.warnings ? `<div class="suggestion-warning">${escapeHtml(suggestion.warnings)}</div>` : ""}<div class="suggestion-actions"><button data-action="accept-suggestion" data-index="${index}">Aceptar</button><button data-action="edit-suggestion" data-index="${index}">Editar</button><button data-action="discard-suggestion" data-index="${index}">Descartar</button></div></article>`;
}

function renderSubjects() {
  return pageHeader("Materias", "Un lugar claro para tu contexto académico.", `<button class="primary-btn" data-action="new-subject">${icon("plus", 17)} Nueva materia</button>`) + `<div class="subject-grid">${state.subjects.map((subject) => `<article class="subject-card"><span class="subject-symbol">${escapeHtml(subject.name.charAt(0).toUpperCase())}</span><h2>${escapeHtml(subject.name)}</h2><p>${escapeHtml(subject.teacher || "Profesor por registrar")}</p><small>${state.tasks.filter((task) => task.subject === subject.name && task.status !== "completed").length} tareas pendientes</small><div class="subject-schedule">${(subject.schedule || []).map((slot) => `${escapeHtml(slot.day)} · ${escapeHtml(slot.start)}–${escapeHtml(slot.end)}`).join("<br>") || "Horario por registrar"}</div><div class="subject-actions"><button data-action="edit-subject" data-id="${subject.id}">Editar</button><button data-action="delete-subject" data-id="${subject.id}">Eliminar</button></div></article>`).join("") || emptyState("Aún no tienes materias", "Añade tus materias para organizar tus tareas.")}</div>`;
}

function renderHistory() {
  const completed = state.history.filter((item) => item.status === "completed");
  const minutes = completed.reduce((sum, item) => sum + (item.duration || 0), 0);
  const completedBySubject = completed.reduce((groups, item) => {
    const subject = item.subject || "Sin materia";
    groups[subject] = (groups[subject] || 0) + 1;
    return groups;
  }, {});
  const subjectSummary = Object.entries(completedBySubject).sort((a, b) => b[1] - a[1]).map(([subject, count]) => `<div class="history-row"><span class="history-icon">${icon("book", 14)}</span><div><strong>${escapeHtml(subject)}</strong><small>Actividad completada</small></div><span class="history-duration">${count} ${count === 1 ? "ciclo" : "ciclos"}</span></div>`).join("") || emptyState("Aún no hay actividad por materia", "Completa un ciclo asociado a una materia para verlo aquí.");
  return pageHeader("Historial", "Mira lo que ya has conseguido, sin presión.", "") + `<div class="stats-grid"><div class="stat-card"><small>CICLOS COMPLETADOS</small><strong>${completed.length}</strong></div><div class="stat-card"><small>MINUTOS DE ENFOQUE</small><strong>${minutes}</strong></div><div class="stat-card"><small>SESIONES CANCELADAS</small><strong>${state.history.filter((item) => item.status === "cancelled").length}</strong></div><div class="stat-card"><small>ACTIVIDADES COMPLETADAS</small><strong>${completed.length}</strong></div></div><section class="panel history-list"><div class="panel-heading"><h2>Actividad por materia</h2></div>${subjectSummary}</section><section class="panel history-list"><div class="panel-heading"><h2>Actividad reciente</h2></div>${state.history.slice().reverse().map((item) => `<div class="history-row"><span class="history-icon">${item.status === "completed" ? "✓" : "—"}</span><div><strong>${item.status === "completed" ? "Ciclo completado" : "Ciclo cancelado"}</strong><small>${escapeHtml(item.taskTitle || "Enfoque libre")}${item.subject ? ` · ${escapeHtml(item.subject)}` : ""} · ${new Date(item.date).toLocaleDateString("es", { day: "numeric", month: "short" })}</small></div><span class="history-duration">${item.duration || 0} min</span></div>`).join("") || emptyState("Tu historial aparecerá aquí", "Completa un ciclo de enfoque para comenzar.")}</section>`;
}

function renderSettings() {
  return pageHeader("Configuración", "Ajustes sencillos para cuidar tu espacio.", "") + `<section class="settings-list"><div class="setting-row"><div><strong>Apariencia</strong><p>Automático sigue el modo preferido de tu navegador.</p></div><select class="theme-select" id="theme-select" aria-label="Elegir tema"><option value="system" ${state.theme === "system" ? "selected" : ""}>Automático</option><option value="light" ${state.theme === "light" ? "selected" : ""}>Claro</option><option value="dark" ${state.theme === "dark" ? "selected" : ""}>Oscuro</option></select></div><div class="setting-row"><div><strong>Almacenamiento local</strong><p>Tus materias, tareas e historial viven solo en este navegador.</p></div><span class="privacy-badge">Privado</span></div><div class="setting-row"><div><strong>Documentos académicos</strong><p>Los PDF se guardan en IndexedDB, no en localStorage. Límite: 10 MB por archivo.</p></div><div class="document-upload"><select id="document-subject" aria-label="Materia del documento"><option value="">Sin materia</option>${state.subjects.map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join("")}</select><label class="outline-btn file-button ${documentProcessing ? "disabled" : ""}">${documentProcessing ? "Procesando…" : `${icon("plus", 15)} Añadir PDF`}<input type="file" id="document-file" accept="application/pdf" ${documentProcessing ? "disabled" : ""}></label></div></div><div class="document-list">${state.documents.map((document) => `<div class="document-entry"><div class="reward-item"><span>▧</span><strong>${escapeHtml(document.name)}</strong><small>${document.pageCount ? `${document.pageCount} páginas · ` : ""}${Math.round(document.size / 1024)} KB</small></div><div class="document-meta">${document.subjectId ? escapeHtml(state.subjects.find((subject) => subject.id === document.subjectId)?.name || "Materia eliminada") : "Sin materia"} · ${document.hasText ? "Texto extraído y listo para usar" : "No se encontró texto extraíble"}</div><button data-action="view-document" data-id="${document.id}">Ver texto</button><button data-action="delete-document" data-id="${document.id}" aria-label="Eliminar documento">${icon("trash", 15)}</button></div>`).join("") || `<p class="storage-empty">No hay documentos almacenados.</p>`}</div><div class="setting-row"><div><strong>Recompensas</strong><p>Elige algo pequeño para celebrar cada ciclo terminado.</p></div><button class="outline-btn" data-action="new-reward">${icon("plus", 15)} Añadir</button></div><div class="reward-list">${state.rewards.map((reward) => `<div class="reward-item"><span>${reward.icon}</span><strong>${escapeHtml(reward.name)}</strong>${reward.custom ? `<button data-action="delete-reward" data-id="${reward.id}" aria-label="Eliminar recompensa">${icon("trash", 15)}</button>` : ""}</div>`).join("")}</div><div class="setting-row danger-row"><div><strong>Limpiar historial</strong><p>Conserva tus tareas y materias.</p></div><button class="outline-btn" data-action="clear-history">Limpiar</button></div><div class="setting-row danger-row"><div><strong>Eliminar todos los datos</strong><p>Esta acción no se puede deshacer.</p></div><button class="danger-btn" data-action="clear-all">Eliminar todo</button></div></section>`;
}

function pageHeader(title, subtitle, action) {
  return `<div class="page-header mb-[45px] flex items-end justify-between gap-5"><div><div class="eyebrow">ESPACIO PERSONAL</div><h1>${title}</h1><p>${subtitle}</p></div>${action || ""}</div>`;
}

function emptyState(title, text) {
  return `<div class="empty-state"><span>✦</span><strong>${title}</strong><p>${text}</p></div>`;
}

function renderTimer() {
  const timer = state.timer;
  const total = timer.stage === "inertia" ? 300 : 1500;
  const remaining = getRemaining(timer);
  const progress = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
  return `<section class="timer-page"><div class="timer-top"><button class="back-btn" data-action="cancel-timer">← Salir</button><span class="eyebrow">CICLO DE ENFOQUE · 30 MINUTOS</span><span></span></div><div class="timer-content"><span class="stage-label">${timer.stage === "inertia" ? "ROMPE LA INERCIA" : "ENFOQUE PROFUNDO"}</span><div class="timer-ring" style="--progress:${progress * 3.6}deg" role="timer" aria-label="Tiempo restante"><div><strong id="timer-value" aria-live="polite">${formatTime(remaining)}</strong><small>restante</small></div></div><h1>${timer.stage === "inertia" ? "Solo empieza." : "Estás en tu ritmo."}</h1><p>${escapeHtml(timer.taskTitle || "Este momento es solo para ti y tu próximo paso.")}</p><div class="timer-actions"><button class="primary-btn" data-action="toggle-timer">${timer.paused ? icon("play", 18) + " Reanudar" : icon("pause", 18) + " Pausar"}</button><button class="text-btn cancel-action" data-action="cancel-timer">Cancelar ciclo</button></div></div><div class="timer-note" aria-live="polite">${timer.stage === "inertia" ? "No tienes que terminarlo ahora. Solo quédate cinco minutos." : "Una cosa a la vez. El resto puede esperar."}</div></section>`;
}

function getRemaining(timer) {
  if (timer.paused) return timer.remaining;
  return Math.max(0, timer.remaining - (Date.now() - timer.updatedAt) / 1000);
}

function beginTimer(task) {
  state.timer = { stage: "inertia", remaining: 300, updatedAt: Date.now(), paused: false, taskId: task?.id || null, taskTitle: task?.title || "", subject: task?.subject || "" };
  saveState();
  render();
}

function syncTimer() {
  clearInterval(timerTick);
  if (!state.timer) return;
  timerTick = setInterval(() => {
    if (!state.timer || state.timer.paused) return;
    const remaining = getRemaining(state.timer);
    if (remaining <= 0) {
      if (state.timer.stage === "inertia") {
        state.timer = { ...state.timer, stage: "focus", remaining: 1500, updatedAt: Date.now() };
        saveState();
        render();
      } else {
        finishTimer();
      }
    } else {
      const el = document.querySelector("#timer-value");
      if (el) el.textContent = formatTime(remaining);
    }
  }, 250);
}

function finishTimer() {
  const timer = state.timer;
  state.history.push({ id: crypto.randomUUID(), date: new Date().toISOString(), status: "completed", duration: 30, taskTitle: timer.taskTitle, subject: timer.subject || "", reward: null });
  state.timer = null;
  saveState();
  renderCompletion(timer.taskTitle);
}

function renderCompletion(taskTitle) {
  document.querySelector(".content").innerHTML = `<section class="completion-page"><span class="completion-mark">✓</span><span class="stage-label">CICLO COMPLETADO</span><h1>Lo hiciste.</h1><p>Treinta minutos de atención es un gran paso${taskTitle ? ` para <strong>${escapeHtml(taskTitle)}</strong>` : ""}.</p><div class="panel reward-picker"><h2>Elige una recompensa</h2><div class="reward-options">${state.rewards.map((reward) => `<button data-action="choose-reward" data-id="${reward.id}"><span>${reward.icon}</span>${escapeHtml(reward.name)}</button>`).join("")}</div></div><button class="text-btn" data-view="home">Volver al inicio ${icon("arrow", 16)}</button></section>`;
  document.querySelectorAll("[data-view]").forEach((el) => el.addEventListener("click", () => { state.activeView = el.dataset.view; render(); }));
  document.querySelectorAll("[data-action='choose-reward']").forEach((el) => el.addEventListener("click", () => { const last = state.history.at(-1); last.reward = state.rewards.find((r) => r.id === el.dataset.id)?.name || null; saveState(); state.activeView = "home"; render(); }));
}

function openTaskForm(existing = null) {
  const isEditing = Boolean(existing?.id);
  showDialog({
    title: isEditing ? "Editar tarea" : "Nueva tarea",
    content: `<label>Nombre de la tarea<input name="title" required maxlength="120" value="${escapeHtml(existing?.title || "")}" placeholder="Ej. Leer capítulo 3"></label>
      <label>Materia<select name="subject"><option value="">Sin materia</option>${state.subjects.map((subject) => `<option ${existing?.subject === subject.name ? "selected" : ""}>${escapeHtml(subject.name)}</option>`).join("")}</select></label>
      <div class="form-grid"><label>Duración (minutos)<input name="duration" type="number" min="5" max="180" value="${existing?.duration || 30}"></label>
      <label>Prioridad<select name="priority"><option value="baja" ${existing?.priority === "baja" ? "selected" : ""}>Baja</option><option value="media" ${!existing || existing.priority === "media" ? "selected" : ""}>Media</option><option value="alta" ${existing?.priority === "alta" ? "selected" : ""}>Alta</option></select></label></div>
      <label>Fecha de entrega<input name="due" type="date" value="${existing?.due || ""}"></label>`,
    onSubmit: (form, close) => {
      const task = { id: existing?.id || crypto.randomUUID(), title: form.get("title").trim(), subject: form.get("subject"), status: existing?.status || "pending", duration: Number(form.get("duration")) || 30, priority: form.get("priority"), due: form.get("due") || "" };
      if (isEditing) state.tasks = state.tasks.map((item) => item.id === existing.id ? task : item); else state.tasks.push(task);
      saveState(); close(); render();
    },
  });
}

function openSubjectForm(existing = null) {
  showDialog({
    title: existing ? "Editar materia" : "Nueva materia",
    content: `<label>Nombre de la materia<input name="name" required maxlength="80" value="${escapeHtml(existing?.name || "")}" placeholder="Ej. Matemática"></label>
      <label>Profesor<input name="teacher" maxlength="80" value="${escapeHtml(existing?.teacher || "")}" placeholder="Opcional"></label>
      <label>Descripción<textarea name="description" rows="3" maxlength="240" placeholder="Notas o indicaciones conocidas">${escapeHtml(existing?.description || "")}</textarea></label>
      <fieldset><legend>Horario opcional</legend><div class="form-grid"><label>Día<select name="day"><option value="">Sin día</option>${["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((day) => `<option ${existing?.schedule?.[0]?.day === day ? "selected" : ""}>${day}</option>`).join("")}</select></label><label>Inicio<input name="start" type="time" value="${existing?.schedule?.[0]?.start || ""}"></label></div><label>Fin<input name="end" type="time" value="${existing?.schedule?.[0]?.end || ""}"></label></fieldset>`,
    onSubmit: (form, close) => {
      const schedule = form.get("day") ? [{ day: form.get("day"), start: form.get("start"), end: form.get("end") }] : [];
      const subject = { id: existing?.id || crypto.randomUUID(), name: form.get("name").trim(), teacher: form.get("teacher").trim(), description: form.get("description").trim(), schedule, createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (existing) state.subjects = state.subjects.map((item) => item.id === existing.id ? subject : item); else state.subjects.push(subject);
      saveState(); close(); render();
    },
  });
}

function openRewardForm() {
  showDialog({
    title: "Nueva recompensa",
    content: `<label>¿Cómo quieres celebrar?<input name="name" required maxlength="60" placeholder="Ej. Ver un episodio"></label>`,
    onSubmit: (form, close) => {
      state.rewards.push({ id: crypto.randomUUID(), name: form.get("name").trim(), icon: "✦", custom: true });
      saveState(); close(); render();
    },
  });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((el) => el.addEventListener("click", () => { state.activeView = el.dataset.view; render(); }));
  document.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("click", () => {
    state.taskFilter = el.dataset.filter;
    saveState();
    render();
  }));
  document.querySelector("#theme-select")?.addEventListener("change", (event) => {
    state.theme = event.target.value;
    saveState();
    applyTheme();
    render();
  });
  document.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", () => {
    const { action, id } = el.dataset;
    if (action === "prepare") {
      const task = state.tasks.find((item) => item.status !== "completed");
      showConfirm({ title: "Prepara tu entorno", message: "Coloca el teléfono fuera de la vista, silencia las notificaciones y prepara tus materiales. ¿Tu entorno está listo?", confirmLabel: "Empezar", onConfirm: () => beginTimer(task) });
    }
    if (action === "new-task") openTaskForm();
    if (action === "generate-ai") generateAiSuggestions();
    if (action === "edit-task") openTaskForm(state.tasks.find((task) => task.id === id));
    if (action === "new-subject") openSubjectForm();
    if (action === "edit-subject") openSubjectForm(state.subjects.find((subject) => subject.id === id));
    if (action === "start-task" || action === "select-task") beginTimer(state.tasks.find((task) => task.id === id));
    if (action === "toggle-task") { const task = state.tasks.find((item) => item.id === id); if (task) task.status = task.status === "completed" ? "pending" : "completed"; saveState(); render(); }
    if (action === "delete-task") { state.tasks = state.tasks.filter((task) => task.id !== id); saveState(); render(); }
    if (action === "delete-subject") {
      const subject = state.subjects.find((item) => item.id === id);
      const relatedTasks = state.tasks.filter((task) => task.subject === subject?.name);
      showConfirm({ title: "Eliminar materia", message: relatedTasks.length ? `Esta materia tiene ${relatedTasks.length} tarea(s) asociada(s). Se conservarán, pero quedarán sin materia.` : "La materia no tiene tareas asociadas. ¿Quieres eliminarla?", confirmLabel: "Eliminar materia", onConfirm: () => { state.tasks = state.tasks.map((task) => task.subject === subject.name ? { ...task, subject: "" } : task); state.subjects = state.subjects.filter((item) => item.id !== id); saveState(); render(); } });
    }
    if (action === "toggle-timer") { const remaining = getRemaining(state.timer); state.timer = { ...state.timer, remaining, updatedAt: Date.now(), paused: !state.timer.paused }; saveState(); render(); }
    if (action === "cancel-timer") showConfirm({ title: "Cancelar ciclo", message: "El ciclo se registrará como interrumpido, sin penalizaciones.", confirmLabel: "Cancelar ciclo", onConfirm: () => { state.history.push({ id: crypto.randomUUID(), date: new Date().toISOString(), status: "cancelled", duration: Math.max(0, Math.round((30 * 60 - getRemaining(state.timer)) / 60)), taskTitle: state.timer.taskTitle, subject: state.timer.subject || "" }); state.timer = null; saveState(); render(); } });
    if (action === "new-reward") openRewardForm();
    if (action === "delete-reward") { state.rewards = state.rewards.filter((reward) => reward.id !== id); saveState(); render(); }
    if (action === "accept-suggestion") {
      const suggestion = state.suggestions?.[Number(el.dataset.index)];
      if (suggestion) { state.tasks.push({ id: crypto.randomUUID(), title: suggestion.title || "Tarea sugerida", description: suggestion.description || "", subject: suggestion.subject || "", status: "pending", duration: Number(suggestion.estimatedMinutes) || 30, priority: suggestion.priority || "media", due: suggestion.dueDate || "", source: suggestion.source || "IA", sourcePage: suggestion.sourcePage || null }); state.suggestions.splice(Number(el.dataset.index), 1); saveState(); render(); }
    }
    if (action === "discard-suggestion") { state.suggestions.splice(Number(el.dataset.index), 1); saveState(); render(); }
    if (action === "edit-suggestion") {
      const suggestion = state.suggestions?.[Number(el.dataset.index)];
      if (suggestion) openTaskForm({ ...suggestion, id: null, status: "pending", duration: suggestion.estimatedMinutes || 30, priority: suggestion.priority || "media", due: suggestion.dueDate || "" });
    }
    if (action === "delete-document") {
      showConfirm({ title: "Eliminar documento", message: "Se eliminará el PDF y el texto extraído de este navegador. Esta acción no se puede deshacer.", confirmLabel: "Eliminar documento", onConfirm: async () => {
        await deleteDocument(id);
        state.documents = state.documents.filter((document) => document.id !== id);
        saveState(); render();
      } });
    }

    if (action === "view-document") {
      const metadata = state.documents.find((item) => item.id === id);
      getDocument(id).then((document) => {
        showDialog({ title: escapeHtml(metadata?.name || "Documento"), content: `<p class="dialog-message document-text">${escapeHtml(document?.text || "Este documento no contiene texto extraíble. Si es un escaneo, esta versión no incluye OCR.")}</p>`, confirmLabel: "Cerrar", cancelLabel: "Cerrar", onSubmit: (_, close) => close() });
      }).catch((error) => {
        showDialog({ title: "No se pudo leer el documento", content: `<p class="dialog-message">${escapeHtml(error.message)}</p>`, confirmLabel: "Cerrar", cancelLabel: "Cerrar", onSubmit: (_, close) => close() });
      });
    }
    if (action === "clear-history") showConfirm({ title: "Limpiar historial", message: "Se eliminarán ciclos completados e interrumpidos. Tus materias y tareas se conservarán.", confirmLabel: "Limpiar historial", onConfirm: () => { state.history = []; saveState(); render(); } });
    if (action === "clear-all") showConfirm({ title: "Eliminar todos los datos", message: "Se eliminarán materias, tareas, historial, recompensas personalizadas y el temporizador. Esta acción no se puede deshacer.", confirmLabel: "Eliminar todo", onConfirm: async () => { await clearDocuments(); clearAppStorage(); state = structuredClone(initialState); saveState(); render(); } });
  }));
  document.querySelector("#document-file")?.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > MAX_PDF_SIZE) {
      showDialog({ title: "No se pudo añadir el PDF", content: "<p class=\"dialog-message\">Selecciona un archivo PDF de máximo 10 MB.</p>", confirmLabel: "Entendido", cancelLabel: "Cerrar", onSubmit: (_, close) => close() });
      event.target.value = "";
      return;
    }
    documentProcessing = true;
    render();
    try {
      const extracted = await extractPdfText(file);
        const documentRecord = { id: crypto.randomUUID(), name: file.name, size: file.size, addedAt: new Date().toISOString(), subjectId: document.querySelector("#document-subject")?.value || "", blob: file, ...extracted };
      await saveDocument(documentRecord);
      state.documents.push({ id: documentRecord.id, name: documentRecord.name, size: documentRecord.size, addedAt: documentRecord.addedAt, subjectId: documentRecord.subjectId, pageCount: extracted.pageCount, hasText: extracted.hasText });
    } catch (error) {
      showDialog({ title: "Almacenamiento no disponible", content: `<p class="dialog-message">${escapeHtml(error.message)}</p>`, confirmLabel: "Entendido", cancelLabel: "Cerrar", onSubmit: (_, close) => close() });
    }
    documentProcessing = false;
    saveState(); render();
  });
}

async function generateAiSuggestions() {
  if (aiLoading) return;
  aiLoading = true; render();
  try {
    state.suggestions = await requestSuggestions(state);
    saveState();
  } catch (error) {
    showDialog({ title: "No se pudieron generar sugerencias", content: `<p class="dialog-message">${escapeHtml(error.message)}<br><br>Las tareas existentes no se modificaron.</p>`, confirmLabel: "Entendido", cancelLabel: "Cerrar", onSubmit: (_, close) => close() });
  } finally {
    aiLoading = false; render();
  }
}

applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (state.theme === "system") applyTheme();
});
render();
