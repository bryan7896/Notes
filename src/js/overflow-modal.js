/* ------------------------------------------------------------------
 * Entrega 4 — Modal de selección cuando un día supera los créditos
 * disponibles (más de 5, o de 7 si ya hay una tarea de prioridad
 * alta ese día). Muestra checkbox + tarea + botón "Hacer esto hoy".
 *
 * Las que el usuario NO marque se desplazan: se actualiza su "fecha
 * inicio" al siguiente día hábil contra el Sheet (tal como
 * confirmaste), lo que reinicia su ciclo de frecuencia/retraso desde
 * ese nuevo día.
 * ------------------------------------------------------------------ */

(function () {
  const overlay = document.getElementById("overflow-overlay");
  const listEl = document.getElementById("overflow-list");
  const dateEl = document.getElementById("overflow-date");
  const btnClose = document.getElementById("overflow-close");
  const btnConfirm = document.getElementById("overflow-confirm");

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  function formatDisplayDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  async function postToApi(body) {
    const res = await fetch(APP_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error desconocido");
    return data;
  }

  let currentDayKey = null;
  let currentEntries = [];

  function open(dayKey, entries) {
    currentDayKey = dayKey;
    currentEntries = entries;

    dateEl.textContent = `Tienes más créditos de los disponibles el ${formatDisplayDate(dayKey)}. Elige qué vas a hacer hoy:`;
    listEl.innerHTML = "";

    const tope = entries.some((e) => e.prioridadAplicada && e.prioridadAplicada.startsWith("alta"))
      ? window.Rules.CREDITOS_EXTENDIDOS
      : window.Rules.CREDITOS_BASE;

    // Pre-marca, en orden, las que alcanzan a caber en el tope (las
    // de prioridad alta/media siempre quedan premarcadas y bloqueadas:
    // ya están forzadas en este día por su propia regla).
    let acumulado = 0;
    entries.forEach((entry) => {
      const forzada = !!entry.prioridadAplicada;
      const cabe = forzada || acumulado + entry.valor <= tope;
      if (cabe) acumulado += entry.valor;

      const row = document.createElement("label");
      row.className = "overflow-row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = cabe;
      cb.disabled = forzada;
      cb.dataset.notaId = entry.nota.id;

      const span = document.createElement("span");
      span.className = "overflow-row__name";
      span.textContent = `${entry.nota.name || "(sin nombre)"} · ${entry.valor} crédito${entry.valor === 1 ? "" : "s"}`;
      if (forzada) span.textContent += entry.prioridadAplicada.startsWith("alta") ? " (prioridad alta)" : " (prioridad media)";

      row.appendChild(cb);
      row.appendChild(span);
      listEl.appendChild(row);
    });

    overlay.hidden = false;
    void overlay.offsetWidth;
    overlay.classList.add("is-open");
  }

  function close() {
    overlay.classList.remove("is-open");
    setTimeout(() => {
      overlay.hidden = true;
    }, 300);
  }

  async function handleConfirm() {
    const checkboxes = Array.from(listEl.querySelectorAll('input[type="checkbox"]'));
    const noSeleccionadas = checkboxes.filter((cb) => !cb.checked);

    if (!noSeleccionadas.length) {
      close();
      return;
    }

    btnConfirm.disabled = true;
    const notasCache = window.NotasApp.getNotasCache();
    const siguienteKey = window.Rules.dateKey(window.Rules.nextBusinessDate(window.Rules.parseKey(currentDayKey)));

    const actualizaciones = noSeleccionadas.map((cb) => {
      const id = cb.dataset.notaId;
      const nota = notasCache.find((n) => String(n.id) === String(id));
      return { cb, nota };
    });

    try {
      for (const { nota } of actualizaciones) {
        if (!nota) continue;
        await postToApi({ sheet: "notas", action: "update", id: nota.id, fechaInicio: siguienteKey });
        nota["fecha inicio"] = siguienteKey;
      }
      close();
      window.NotasApp.showToast("Tareas reorganizadas para el siguiente día hábil");
      window.NotasApp.rerenderFromCache();
    } catch (err) {
      window.NotasApp.showToast(`No se pudo reorganizar: ${err.message}`, 3000);
      window.NotasApp.refresh();
    } finally {
      btnConfirm.disabled = false;
    }
  }

  btnClose.addEventListener("click", close);
  btnConfirm.addEventListener("click", handleConfirm);
  overlay.addEventListener("click", (evt) => {
    if (evt.target === overlay) close();
  });

  window.OverflowModal = { open, close };
})();
