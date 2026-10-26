/* ------------------------------------------------------------------
 * Entrega 5 — Modal informativo genérico (felicitación al marcar una
 * tarea como hecha). Reutiliza el mismo patrón lateral 80/20 de todos
 * los modales de la app, pero sin botones: se cierra solo a los 2s.
 * ------------------------------------------------------------------ */

(function () {
  const overlay = document.getElementById("congrats-overlay");
  const textEl = document.getElementById("congrats-text");
  let closeTimer = null;

  function show(message, duration = 2000) {
    textEl.textContent = message;
    overlay.hidden = false;
    void overlay.offsetWidth;
    overlay.classList.add("is-open");

    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, duration);
  }

  function close() {
    overlay.classList.remove("is-open");
    setTimeout(() => {
      overlay.hidden = true;
    }, 300);
  }

  overlay.addEventListener("click", (evt) => {
    if (evt.target === overlay) close();
  });

  window.CongratsModal = { show, close };
})();
