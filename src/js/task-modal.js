/* ------------------------------------------------------------------
 * Entrega 3 — Modal lateral de tarea.
 *
 * Crea y edita filas de la hoja "Notas" contra el backend. NO aplica
 * todavía el motor de reglas (eso llega en la Entrega 4): aquí solo
 * se capturan y validan los valores (frecuencia, máximo de retraso,
 * crédito, reglas) y se guardan tal cual en el Sheet.
 * ------------------------------------------------------------------ */

(function () {
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("task-modal");
  const titleEl = document.getElementById("modal-title");
  const selectedDateEl = document.getElementById("modal-selected-date");
  const errorEl = document.getElementById("modal-error");

  const fieldName = document.getElementById("field-name");
  const fieldFechaInicio = document.getElementById("field-fecha-inicio");
  const fieldFrecuencia = document.getElementById("field-frecuencia");
  const fieldMaxRetraso = document.getElementById("field-max-retraso");
  const fieldValor = document.getElementById("field-valor");

  const ruleCheckboxes = Array.from(document.querySelectorAll(".rule-check input[type=checkbox]"));

  const btnClose = document.getElementById("modal-close");
  const btnSave = document.getElementById("btn-save");
  const btnDelete = document.getElementById("btn-delete");

  let mode = "create"; // "create" | "edit"
  let currentNota = null; // la nota original cuando mode === "edit"

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  function formatDisplayDate(key) {
    if (!key) return "";
    const [y, m, d] = key.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function resetForm() {
    fieldName.value = "";
    fieldFechaInicio.value = "";
    fieldFrecuencia.value = "";
    fieldMaxRetraso.value = "0";
    fieldValor.value = "1";
    ruleCheckboxes.forEach((cb) => (cb.checked = false));
    clearError();
  }

  function setReglasFromString(reglaStr) {
    const activas = String(reglaStr || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    ruleCheckboxes.forEach((cb) => {
      cb.checked = activas.includes(cb.value);
    });
  }

  function getReglasAsString() {
    return ruleCheckboxes
      .filter((cb) => cb.checked)
      .map((cb) => cb.value)
      .join(",");
  }

  // Dentro de un mismo grupo (data-group) solo puede quedar una regla
  // marcada: "contar fin de semana" vs "contar un día del fin de
  // semana", y "prioridad alta" vs "prioridad media".
  ruleCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (!cb.checked) return;
      const group = cb.dataset.group;
      ruleCheckboxes
        .filter((other) => other !== cb && other.dataset.group === group)
        .forEach((other) => (other.checked = false));
    });
  });

  function openOverlay() {
    overlay.hidden = false;
    // forzar reflow para que la transición de entrada sí se vea
    void overlay.offsetWidth;
    overlay.classList.add("is-open");
  }

  function closeOverlay() {
    overlay.classList.remove("is-open");
    setTimeout(() => {
      overlay.hidden = true;
    }, 300);
  }

  function openForCreate(selectedDateKey) {
    mode = "create";
    currentNota = null;
    resetForm();
    titleEl.textContent = "Nueva tarea";
    selectedDateEl.textContent = `Fecha seleccionada: ${formatDisplayDate(selectedDateKey)}`;
    fieldFechaInicio.value = selectedDateKey || "";
    btnDelete.hidden = true;
    openOverlay();
    fieldName.focus();
  }

  function openForEdit(nota, selectedDateKey) {
    mode = "edit";
    currentNota = nota;
    clearError();
    titleEl.textContent = "Editar tarea";
    selectedDateEl.textContent = `Fecha seleccionada: ${formatDisplayDate(selectedDateKey)}`;

    fieldName.value = nota.name || "";
    fieldFechaInicio.value = (nota["fecha inicio"] || "").toString().slice(0, 10);
    fieldFrecuencia.value = nota.frecuencia || "";
    fieldMaxRetraso.value = nota.maxRetraso !== undefined && nota.maxRetraso !== "" ? nota.maxRetraso : "0";
    fieldValor.value = nota.valor || "1";
    setReglasFromString(nota.regla);

    btnDelete.hidden = false;
    openOverlay();
  }

  function validate() {
    if (!fieldName.value.trim()) return "El nombre es obligatorio.";
    if (!fieldFechaInicio.value) return "La fecha de inicio es obligatoria.";

    const frecuencia = Number(fieldFrecuencia.value);
    if (!Number.isInteger(frecuencia) || frecuencia < 1) {
      return "La frecuencia debe ser un número entero de 1 o más días.";
    }

    const maxRetraso = Number(fieldMaxRetraso.value || 0);
    if (!Number.isInteger(maxRetraso) || maxRetraso < 0) {
      return "El máximo de retraso debe ser un número entero de 0 o más días.";
    }

    const valor = Number(fieldValor.value);
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      return "El crédito debe ser un número entero entre 1 y 5.";
    }

    const prioridadAlta = document.getElementById("rule-prioridad-alta").checked;
    const prioridadMedia = document.getElementById("rule-prioridad-media").checked;
    if (prioridadAlta && prioridadMedia) {
      return "Prioridad alta y prioridad media no se pueden seleccionar juntas.";
    }

    const finde = document.getElementById("rule-finde").checked;
    const unDiaFinde = document.getElementById("rule-un-dia-finde").checked;
    if (finde && unDiaFinde) {
      return "Las dos reglas de fin de semana no se pueden seleccionar juntas.";
    }

    return null;
  }

  async function postToApi(body) {
    const res = await fetch(APP_CONFIG.API_URL, {
      method: "POST",
      // Apps Script no maneja preflight de CORS con JSON "de verdad";
      // text/plain evita el preflight y Apps Script igual lo parsea
      // con JSON.parse(e.postData.contents).
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error desconocido");
    return data;
  }

  async function handleSave() {
    const error = validate();
    if (error) {
      showError(error);
      return;
    }
    clearError();

    const payload = {
      sheet: "notas",
      action: mode === "edit" ? "update" : "add",
      name: fieldName.value.trim(),
      fechaInicio: fieldFechaInicio.value,
      frecuencia: Number(fieldFrecuencia.value),
      maxRetraso: Number(fieldMaxRetraso.value || 0),
      valor: Number(fieldValor.value),
      regla: getReglasAsString()
    };
    if (mode === "edit") payload.id = currentNota.id;

    btnSave.disabled = true;
    try {
      await postToApi(payload);
      closeOverlay();
      window.NotasApp.showToast(mode === "edit" ? "Tarea actualizada" : "Tarea creada");
      window.NotasApp.refresh();
    } catch (err) {
      showError(`No se pudo guardar: ${err.message}`);
    } finally {
      btnSave.disabled = false;
    }
  }

  async function handleDelete() {
    if (!currentNota) return;
    const ok = window.confirm(`¿Eliminar "${currentNota.name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    btnDelete.disabled = true;
    try {
      await postToApi({ sheet: "notas", action: "delete", id: currentNota.id });
      closeOverlay();
      window.NotasApp.showToast("Tarea eliminada");
      window.NotasApp.refresh();
    } catch (err) {
      showError(`No se pudo eliminar: ${err.message}`);
    } finally {
      btnDelete.disabled = false;
    }
  }

  btnClose.addEventListener("click", closeOverlay);
  btnSave.addEventListener("click", handleSave);
  btnDelete.addEventListener("click", handleDelete);

  // Tocar el 20% izquierdo (el fondo visible) cierra el modal, igual
  // que tocar fuera de un menú lateral.
  overlay.addEventListener("click", (evt) => {
    if (evt.target === overlay) closeOverlay();
  });

  window.TaskModal = { openForCreate, openForEdit, close: closeOverlay };
})();
