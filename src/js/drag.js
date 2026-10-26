/* ------------------------------------------------------------------
 * Entrega 5 — Arrastrar una tarea hacia la derecha para marcarla hecha.
 *
 * Gesto táctil nativo (Pointer Events, sin librería externa). Al pasar
 * el umbral:
 *   1) Optimista: se marca "hecha" de inmediato en pantalla (clase
 *      .is-done: fondo claro, cursiva + subrayado) y se guarda la
 *      fecha del día en nota.estado en el caché local.
 *   2) Se muestra el modal "Felicidades" 2 segundos con la próxima
 *      fecha en la que esa tarea volverá a aparecer.
 *   3) En paralelo se persiste contra el Sheet (update de "estado").
 *      Si falla, se revierte el cambio local y se avisa con un toast.
 * ------------------------------------------------------------------ */

(function () {
  const UMBRAL_RATIO = 0.42; // % del ancho del botón que hay que arrastrar

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

  function attach(btn, nota, dayKey) {
    let startX = 0;
    let dx = 0;
    let dragging = false;
    let pointerId = null;

    function onPointerDown(evt) {
      // Solo el botón principal / un dedo, y solo si aún no está hecha hoy.
      if (evt.button !== undefined && evt.button !== 0) return;
      dragging = true;
      pointerId = evt.pointerId;
      startX = evt.clientX;
      dx = 0;
      btn.classList.add("is-dragging");
      btn.setPointerCapture && btn.setPointerCapture(pointerId);
    }

    function onPointerMove(evt) {
      if (!dragging || evt.pointerId !== pointerId) return;
      dx = evt.clientX - startX;
      if (dx < 0) dx = 0; // solo se arrastra hacia la derecha
      const max = btn.offsetWidth;
      const clamped = Math.min(dx, max);
      btn.style.transform = `translateX(${clamped}px)`;
      btn.style.opacity = String(1 - (clamped / max) * 0.35);
    }

    function resetVisual() {
      btn.style.transition = "transform 0.25s ease, opacity 0.25s ease";
      btn.style.transform = "translateX(0)";
      btn.style.opacity = "1";
      setTimeout(() => {
        btn.style.transition = "";
      }, 260);
    }

    function suppressNextClick() {
      // El navegador dispara un "click" sintético justo después del
      // pointerup/touchend; si hubo arrastre real no queremos que ese
      // click además abra el modal de edición.
      const swallow = (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        btn.removeEventListener("click", swallow, true);
      };
      btn.addEventListener("click", swallow, true);
      setTimeout(() => btn.removeEventListener("click", swallow, true), 400);
    }

    function onPointerUp(evt) {
      if (!dragging || evt.pointerId !== pointerId) return;
      dragging = false;
      btn.classList.remove("is-dragging");
      btn.releasePointerCapture && btn.releasePointerCapture(pointerId);

      if (dx > 8) suppressNextClick();

      const threshold = btn.offsetWidth * UMBRAL_RATIO;
      if (dx >= threshold) {
        confirmDone();
      } else {
        resetVisual();
      }
    }

    function confirmDone() {
      btn.style.transition = "transform 0.2s ease";
      btn.style.transform = `translateX(${btn.offsetWidth}px)`;
      btn.style.opacity = "0.6";

      // 1) Optimista en memoria + repintado inmediato.
      const estadoPrevio = nota["estado"];
      const fechas = String(estadoPrevio || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!fechas.includes(dayKey)) fechas.push(dayKey);
      nota["estado"] = fechas.join(",");

      // 2) próxima fecha en que reaparece (para el mensaje de felicitación)
      const reglas = window.Rules.parseReglas(nota.regla);
      const frecuencia = Math.max(1, Number(nota.frecuencia) || 1);
      const hoyDate = window.Rules.parseKey(dayKey);
      const proxima = window.Rules.computeNaturalNext(hoyDate, frecuencia, reglas);
      const proximaKey = window.Rules.dateKey(proxima);
      const diffDias = Math.round((proxima - hoyDate) / 86400000);

      window.CongratsModal.show(
        `Felicidades por terminar la tarea ${nota.name}, esta volverás a verla el ${formatDisplayDate(
          proximaKey
        )}, es decir en ${diffDias} día${diffDias === 1 ? "" : "s"}.`
      );

      setTimeout(() => {
        window.NotasApp.rerenderFromCache();
      }, 150);

      // 3) persistencia en background, con fallback si falla.
      postToApi({ sheet: "notas", action: "update", id: nota.id, estado: nota["estado"] }).catch(
        (err) => {
          nota["estado"] = estadoPrevio || "";
          window.NotasApp.rerenderFromCache();
          window.NotasApp.showToast(`No se pudo guardar: ${err.message}`, 3000);
        }
      );
    }

    btn.addEventListener("pointerdown", onPointerDown);
    btn.addEventListener("pointermove", onPointerMove);
    btn.addEventListener("pointerup", onPointerUp);
    btn.addEventListener("pointercancel", onPointerUp);
  }

  window.DragDone = { attach };
})();
