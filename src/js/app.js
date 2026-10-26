/* ------------------------------------------------------------------
 * Entregas 4 y 5 — Home conectado al motor de reglas (js/rules.js).
 *
 * Ya NO se muestra una tarea solo en su "fecha inicio" literal: se usa
 * window.Rules.computeSchedule(...) para calcular dónde cae cada
 * ocurrencia según frecuencia, festivos, reglas de fin de semana,
 * créditos (5/día, +2 con prioridad alta) y "máximo de retraso".
 * ------------------------------------------------------------------ */

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const weekListEl = document.getElementById("week-list");
const toastEl = document.getElementById("toast");

// ---------- utilidades de fecha (home) ----------

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, days) {
  return window.Rules.addDays(date, days);
}

function dateKey(date) {
  return window.Rules.dateKey(date);
}

function normalizeToDateKey(value) {
  return window.Rules.normalizeToDateKey(value);
}

// Construye los 7 días a mostrar: 2 previos + hoy + 4 siguientes.
function buildWeekDays() {
  const today = toDateOnly(new Date());
  const days = [];
  for (let offset = -2; offset <= 4; offset++) {
    days.push(addDays(today, offset));
  }
  return days;
}

// ---------- toast ----------

let toastTimer = null;
function showToast(message, duration = 2000) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), duration);
}

// ---------- datos ----------

async function fetchNotas() {
  const url = `${APP_CONFIG.API_URL}?sheet=notas`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(body.error || "Error desconocido");
  return body.data; // [{id, name, "fecha inicio", frecuencia, estado, regla, valor, maxRetraso}, ...]
}

function isDoneOn(nota, key) {
  const estado = nota["estado"];
  if (!estado) return false;
  return String(estado)
    .split(",")
    .map((s) => normalizeToDateKey(s.trim()))
    .includes(key);
}

// Ordena: alfabético por nombre, con las marcadas como hechas (en ese
// día puntual) al final.
function sortEntriesForDay(entries, key) {
  return [...entries].sort((a, b) => {
    const doneA = isDoneOn(a.nota, key) ? 1 : 0;
    const doneB = isDoneOn(b.nota, key) ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    return String(a.nota.name || "").localeCompare(String(b.nota.name || ""), "es");
  });
}

// ---------- render ----------

let lastNotas = []; // cache en memoria para recalcular sin volver a pedir al backend
let autoOverflowShown = false; // solo auto-abrimos el modal de sobrecupo una vez por carga

function renderWeek(notas) {
  lastNotas = notas;
  const days = buildWeekDays();
  const todayKey = dateKey(toDateOnly(new Date()));

  const schedule = window.Rules.computeSchedule(notas, days[0], days[days.length - 1]);

  weekListEl.innerHTML = "";

  days.forEach((date) => {
    const key = dateKey(date);
    const esHabil = window.Rules.isBusinessDate(date);
    const esFestivo = window.Rules.isHoliday(date);
    const entries = sortEntriesForDay(schedule.byDay[key] || [], key);
    const enSobrecupo = schedule.overflowDays.has(key);

    const card = document.createElement("section");
    card.className =
      "day-card" +
      (key === todayKey ? " day-card--today" : "") +
      (!esHabil ? " day-card--festivo" : "");

    const dateCol = document.createElement("div");
    dateCol.className = "day-card__date";
    dateCol.innerHTML = `
      <span class="day-card__date-label">${DIAS[date.getDay()]}</span>
      <span class="day-card__date-number">${date.getDate()}</span>
      ${enSobrecupo ? '<span class="day-card__badge" title="Más de 5 créditos este día">⚠</span>' : ""}
    `;
    dateCol.addEventListener("click", () => {
      if (enSobrecupo) {
        window.OverflowModal.open(key, schedule.byDay[key] || []);
        return;
      }
      // Click en la fecha abre el modal de "agregar tarea" con esta
      // fecha precargada como fecha de inicio (los festivos quedan
      // deshabilitados para crear tareas nuevas en ellos).
      if (esHabil) window.TaskModal.openForCreate(key);
    });

    const tasksCol = document.createElement("div");
    tasksCol.className = "day-card__tasks";

    if (!esHabil) {
      const empty = document.createElement("p");
      empty.className = "day-card__empty";
      empty.textContent = esFestivo ? "Festivo" : "Fin de semana";
      tasksCol.appendChild(empty);
    } else if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "day-card__empty";
      empty.textContent = "Sin tareas";
      tasksCol.appendChild(empty);
    } else {
      entries.forEach((entry) => {
        const nota = entry.nota;
        const done = isDoneOn(nota, key);

        const wrap = document.createElement("div");
        wrap.className = "task-wrap";

        const btn = document.createElement("button");
        btn.className = "task-btn" + (done ? " is-done" : "");
        if (entry.prioridadAplicada && entry.prioridadAplicada.startsWith("alta")) {
          btn.classList.add("task-btn--alta");
        } else if (entry.prioridadAplicada === "media") {
          btn.classList.add("task-btn--media");
        }
        btn.type = "button";
        btn.textContent = nota.name || "(sin nombre)";
        btn.dataset.notaId = nota.id;
        btn.dataset.dayKey = key;

        btn.addEventListener("click", () => {
          // Si el click viene al final de un drag, drag.js detiene la
          // propagación antes de llegar acá.
          window.TaskModal.openForEdit(nota, key);
        });

        wrap.appendChild(btn);
        tasksCol.appendChild(wrap);

        // Entrega 5: habilita el gesto de arrastrar hacia la derecha
        // para marcar como hecha (si ya está hecha ese día no hace
        // falta volver a engancharlo).
        if (!done && window.DragDone) {
          window.DragDone.attach(btn, nota, key);
        }
      });
    }

    card.appendChild(dateCol);
    card.appendChild(tasksCol);
    weekListEl.appendChild(card);
  });

  // El modal de sobrecupo se muestra automáticamente al "entrar" al
  // día de hoy si hoy superó los créditos disponibles.
  if (!autoOverflowShown && schedule.overflowDays.has(todayKey)) {
    autoOverflowShown = true;
    window.OverflowModal.open(todayKey, schedule.byDay[todayKey] || []);
  }
}

// ---------- init ----------

async function init() {
  try {
    weekListEl.innerHTML = '<p class="state-msg">Cargando tus tareas…</p>';
    const notas = await fetchNotas();
    renderWeek(notas);
  } catch (err) {
    weekListEl.innerHTML = `<p class="state-msg">No pudimos cargar tus tareas.<br>${err.message}</p>`;
  }
}

// Vuelve a dibujar el Home con los datos ya cargados, sin golpear el
// backend otra vez (lo usa drag.js tras marcar una tarea como hecha
// de forma optimista).
function rerenderFromCache() {
  if (lastNotas.length) renderWeek(lastNotas);
}

document.getElementById("btn-home").addEventListener("click", init);
document.getElementById("btn-add").addEventListener("click", () => {
  const todayKey = dateKey(toDateOnly(new Date()));
  window.TaskModal.openForCreate(todayKey);
});

// Expuesto para que task-modal.js / drag.js / overflow-modal.js puedan
// refrescar el Home después de guardar, editar, borrar o marcar hecha
// una tarea.
window.NotasApp = {
  refresh: init,
  rerenderFromCache,
  showToast,
  getNotasCache: () => lastNotas
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* si falla el registro, la app sigue funcionando online */
    });
  });
}

init();
