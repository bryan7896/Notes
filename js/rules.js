/* ------------------------------------------------------------------
 * Entrega 4 — Motor de reglas y créditos.
 *
 * Este archivo NO toca el Sheet (solo lee las notas que app.js ya
 * trajo). Calcula, de forma 100% derivada y en memoria, en qué día
 * aparece cada ocurrencia de cada tarea recurrente, respetando:
 *   - Festivos quemados en código (2026-2028, los que diste).
 *   - Frecuencia + las 2 reglas de fin de semana.
 *   - Tope de 5 créditos/día, +2 con "prioridad alta" (sin doble
 *     extensión en cascada el mismo día).
 *   - "Prioridad media": fuerza su día pero no amplía el tope.
 *   - "Máximo de retraso": si una tarea normal se corre más días de
 *     los permitidos buscando cupo, se vuelve automáticamente
 *     "prioridad alta" ese día (sin que el usuario la haya marcado así).
 *
 * SUPUESTOS que tomé para destrabar partes ambiguas del enunciado
 * (quedan documentados aquí para que los ajustes, si quieres otro
 * comportamiento, sean puntuales):
 *   1) "Contar un día del fin de semana": el bloque sábado+domingo (o
 *      festivo pegado al fin de semana, "puente") cuenta como 1 solo
 *      día de frecuencia en vez de contarse cada día por separado.
 *   2) Una tarea "normal" que no tiene regla de fin de semana marcada
 *      cuenta la frecuencia SOLO en días hábiles (fines de semana y
 *      festivos son invisibles para el conteo).
 *   3) La frecuencia de la SIGUIENTE ocurrencia siempre se calcula
 *      desde la fecha "natural" anterior (no desde el día real donde
 *      terminó cayendo por falta de cupo), para que el ritmo de la
 *      tarea no se desordene por congestión de créditos.
 *   4) Cuando "prioridad alta" fuerza su día y aun con el cupo
 *      ampliado (7) no alcanza, se corren al día siguiente hábil las
 *      tareas normales que ya estaban puestas ese día (las últimas en
 *      entrar, primeras en salir).
 *   5) El desplazamiento "manual" (el usuario destilda una tarea en el
 *      modal de más de 5 créditos) sí se guarda en el Sheet: se hace
 *      update de "fecha inicio" al día siguiente, tal como confirmaste.
 *      El resto de corrimientos (por cupo o por prioridad alta) son
 *      solo de cálculo/visualización, no se escriben en el Sheet.
 * ------------------------------------------------------------------ */

(function () {
  // ---------- Festivos (Colombia, los que diste; puedes seguir
  // agregando más tú mismo en el Sheet más adelante si decides mover
  // esto a una hoja — por ahora, tal como pediste, quedan quemados). ----------
  const FESTIVOS = new Set([
    // 2026
    "2026-11-02", // Todos los Santos
    "2026-11-16", // Independencia de Cartagena
    "2026-12-08", // Inmaculada Concepción
    "2026-12-25", // Navidad
    // 2027
    "2027-01-01", // Año Nuevo
    "2027-01-11", // Reyes Magos
    "2027-03-22", // Día de San José
    "2027-03-25", // Jueves Santo
    "2027-03-26", // Viernes Santo
    "2027-05-01", // Día del trabajo
    "2027-05-10", // Ascensión de Jesús
    "2027-05-31", // Corpus Christi
    "2027-06-07", // Sagrado Corazón de Jesús
    "2027-07-05", // San Pedro y San Pablo
    "2027-07-12", // Día de la Virgen de Chiquinquirá
    "2027-07-20", // Día de la independencia
    "2027-08-07", // Batalla de Boyacá
    "2027-08-16", // Asunción de la Virgen
    "2027-10-18", // Día de la raza
    "2027-11-01", // Todos los Santos
    "2027-11-15", // Independencia de Cartagena
    "2027-12-08", // Inmaculada Concepción
    "2027-12-25", // Navidad
    // 2028
    "2028-01-01", // Año Nuevo
    "2028-01-10", // Reyes Magos
    "2028-03-20", // Día de San José
    "2028-04-13", // Jueves Santo
    "2028-04-14", // Viernes Santo
    "2028-05-01", // Día del trabajo
    "2028-05-29", // Ascensión de Jesús
    "2028-06-19", // Corpus Christi
    "2028-06-26", // Sagrado Corazón de Jesús
    "2028-07-03", // San Pedro y San Pablo
    "2028-07-10", // Día de la Virgen de Chiquinquirá
    "2028-07-20", // Día de la independencia
    "2028-08-07", // Batalla de Boyacá
    "2028-08-21", // Asunción de la Virgen
    "2028-10-16", // Día de la raza
    "2028-11-06", // Todos los Santos
    "2028-11-13", // Independencia de Cartagena
    "2028-12-08", // Inmaculada Concepción
    "2028-12-25"  // Navidad
  ]);

  const CREDITOS_BASE = 5;
  const CREDITOS_EXTENDIDOS = 7; // base + 2 de prioridad alta

  // ---------- utilidades de fecha (self-contained, no dependen de app.js) ----------
  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function normalizeToDateKey(value) {
    if (!value) return null;
    if (value instanceof Date) return dateKey(value);
    const str = String(value).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return dateKey(parsed);
    return null;
  }

  function isHoliday(date) {
    return FESTIVOS.has(dateKey(date));
  }

  function isWeekend(date) {
    const dow = date.getDay();
    return dow === 0 || dow === 6;
  }

  function isBusinessDate(date) {
    return !isWeekend(date) && !isHoliday(date);
  }

  function nextBusinessDate(date) {
    let d = addDays(date, 1);
    while (!isBusinessDate(d)) d = addDays(d, 1);
    return d;
  }

  function sameOrNextBusinessDate(date) {
    return isBusinessDate(date) ? date : nextBusinessDate(addDays(date, -1));
  }

  function parseReglas(reglaStr) {
    return String(reglaStr || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ---------- cálculo de la SIGUIENTE fecha "natural" (sin créditos) ----------
  function computeNaturalNext(fromDate, frecuencia, reglas) {
    if (reglas.includes("contar_fin_semana")) {
      // Cuenta el fin de semana como días normales; si el resultado cae
      // en día no hábil, se corre al siguiente hábil.
      let candidate = addDays(fromDate, frecuencia);
      while (!isBusinessDate(candidate)) candidate = addDays(candidate, 1);
      return candidate;
    }

    if (reglas.includes("contar_un_dia_fin_semana")) {
      // El bloque completo de días no hábiles seguidos (fin de semana,
      // o "puente" si hay festivo pegado) cuenta como 1 solo día.
      let count = 0;
      let cur = fromDate;
      let dentroDeBloque = false;
      while (count < frecuencia) {
        cur = addDays(cur, 1);
        if (isBusinessDate(cur)) {
          count++;
          dentroDeBloque = false;
        } else if (!dentroDeBloque) {
          count++;
          dentroDeBloque = true;
        } // si ya estábamos dentro del bloque, este día no suma
      }
      while (!isBusinessDate(cur)) cur = addDays(cur, 1);
      return cur;
    }

    // Sin regla de fin de semana: los fines de semana y festivos son
    // invisibles, solo se cuentan días hábiles.
    let count = 0;
    let cur = fromDate;
    while (count < frecuencia) {
      cur = addDays(cur, 1);
      if (isBusinessDate(cur)) count++;
    }
    return cur;
  }

  // Genera las fechas "ancla" (naturales, sin créditos) de una tarea
  // desde su fecha de inicio hasta el horizonte pedido.
  function buildAnchors(nota, horizonEnd) {
    const reglas = parseReglas(nota.regla);
    const frecuencia = Math.max(1, Number(nota.frecuencia) || 1);
    const fechaInicioKey = normalizeToDateKey(nota["fecha inicio"]);
    if (!fechaInicioKey) return [];

    const first = sameOrNextBusinessDate(parseKey(fechaInicioKey));
    const anchors = [first];

    let guard = 0;
    while (anchors[anchors.length - 1] < horizonEnd && guard < 400) {
      anchors.push(computeNaturalNext(anchors[anchors.length - 1], frecuencia, reglas));
      guard++;
    }
    return anchors;
  }

  // ---------- simulación global de créditos/prioridades ----------
  // notas: array crudo tal como lo entrega el backend (incluye id, name,
  // "fecha inicio", frecuencia, estado, regla, valor, maxRetraso).
  // windowStart/windowEnd: objetos Date (solo fecha) del rango visible.
  function computeSchedule(notas, windowStart, windowEnd) {
    const porDia = {}; // dateKey -> array de instancias colocadas
    const creditos = {}; // dateKey -> créditos usados
    const altaExtendido = {}; // dateKey -> ya se usó la extensión de +2

    // 1) fechas ancla por tarea (independiente de créditos)
    let queue = [];
    notas.forEach((nota) => {
      const reglas = parseReglas(nota.regla);
      let prioridadExplicita = null;
      if (reglas.includes("prioridad_alta")) prioridadExplicita = "alta";
      else if (reglas.includes("prioridad_media")) prioridadExplicita = "media";

      const anchors = buildAnchors(nota, windowEnd);
      anchors.forEach((anchorDate) => {
        if (anchorDate > windowEnd) return; // no hace falta colocarla, cae después del rango visible
        queue.push({
          nota,
          day: anchorDate,
          anchorKey: dateKey(anchorDate),
          prioridadExplicita,
          retraso: 0
        });
      });
    });

    // orden cronológico; a igual fecha, alta > media > normal > alfabético
    const rango = { alta: 0, media: 1, normal: 2 };
    queue.sort((a, b) => {
      if (a.day - b.day !== 0) return a.day - b.day;
      const ra = rango[a.prioridadExplicita || "normal"];
      const rb = rango[b.prioridadExplicita || "normal"];
      if (ra !== rb) return ra - rb;
      return String(a.nota.name || "").localeCompare(String(b.nota.name || ""), "es");
    });

    function pushResult(dKey, inst, extra) {
      const entry = {
        nota: inst.nota,
        fecha: dKey,
        fechaAncla: inst.anchorKey,
        valor: extra.valor,
        prioridadAplicada: extra.prioridadAplicada,
        retraso: extra.retraso
      };
      if (!porDia[dKey]) porDia[dKey] = [];
      porDia[dKey].push(entry);
      return entry;
    }

    let i = 0;
    let safety = 0;
    while (i < queue.length && safety < 5000) {
      safety++;
      const inst = queue[i];
      i++;
      let currentDay = inst.day;
      const maxRetraso = Number(inst.nota.maxRetraso) || 0;
      const valor = Math.min(5, Math.max(1, Number(inst.nota.valor) || 1));

      // tope de búsqueda de cupo, para no entrar en bucles eternos
      let intentos = 0;
      while (intentos < 60) {
        intentos++;
        const dKey = dateKey(currentDay);

        let priority = inst.prioridadExplicita;
        let escaladaPorRetraso = false;
        if (!priority && maxRetraso > 0 && inst.retraso >= maxRetraso) {
          priority = "alta";
          escaladaPorRetraso = true;
        }

        const altaYaUsada = !!altaExtendido[dKey];
        const usados = creditos[dKey] || 0;

        if (priority === "alta") {
          if (!altaYaUsada) {
            altaExtendido[dKey] = true;
            let proyectado = usados + valor;
            if (proyectado > CREDITOS_EXTENDIDOS) {
              // Desplaza al día hábil siguiente las tareas normales que
              // ya estaban puestas hoy (últimas en entrar, primeras en salir).
              const colocadasHoy = (porDia[dKey] || []).filter((r) => !r.prioridadAplicada);
              let exceso = proyectado - CREDITOS_EXTENDIDOS;
              while (exceso > 0 && colocadasHoy.length) {
                const bump = colocadasHoy.pop();
                creditos[dKey] = (creditos[dKey] || 0) - bump.valor;
                exceso -= bump.valor;
                const arr = porDia[dKey];
                const idx = arr.indexOf(bump);
                if (idx > -1) arr.splice(idx, 1);
                queue.splice(i, 0, {
                  nota: bump.nota,
                  day: nextBusinessDate(currentDay),
                  anchorKey: bump.fechaAncla,
                  prioridadExplicita: null,
                  retraso: bump.retraso + 1
                });
              }
            }
            creditos[dKey] = (creditos[dKey] || 0) + valor;
            pushResult(dKey, inst, {
              valor,
              prioridadAplicada: escaladaPorRetraso ? "alta-por-retraso" : "alta",
              retraso: inst.retraso
            });
            break;
          } else {
            // ya hay una tarea de prioridad alta usando la extensión hoy:
            // esta se corre al siguiente día hábil (sin apilar extensiones).
            currentDay = nextBusinessDate(currentDay);
            inst.retraso++;
            continue;
          }
        }

        if (priority === "media") {
          // fuerza su ubicación, no amplía cupo (puede dejar el día en
          // sobrecupo; eso se resuelve con el modal de selección).
          creditos[dKey] = usados + valor;
          pushResult(dKey, inst, { valor, prioridadAplicada: "media", retraso: inst.retraso });
          break;
        }

        // normal
        const capacity = CREDITOS_BASE + (altaYaUsada ? 2 : 0);
        if (usados + valor <= capacity) {
          creditos[dKey] = usados + valor;
          pushResult(dKey, inst, { valor, prioridadAplicada: null, retraso: inst.retraso });
          break;
        }
        currentDay = nextBusinessDate(currentDay);
        inst.retraso++;
      }
    }

    // días que quedaron por encima del tope (típicamente por varias
    // "prioridad media" acumuladas) -> disparan el modal de selección.
    const overflowDays = new Set();
    Object.keys(porDia).forEach((dKey) => {
      const tope = (altaExtendido[dKey] ? CREDITOS_EXTENDIDOS : CREDITOS_BASE);
      if ((creditos[dKey] || 0) > tope) overflowDays.add(dKey);
    });

    const byDay = {};
    Object.keys(porDia).forEach((dKey) => {
      const d = parseKey(dKey);
      if (d >= windowStart && d <= windowEnd) byDay[dKey] = porDia[dKey];
    });

    return { byDay, overflowDays, creditos };
  }

  window.Rules = {
    FESTIVOS,
    CREDITOS_BASE,
    CREDITOS_EXTENDIDOS,
    dateKey,
    parseKey,
    addDays,
    normalizeToDateKey,
    isBusinessDate,
    isHoliday,
    isWeekend,
    nextBusinessDate,
    parseReglas,
    computeNaturalNext,
    computeSchedule
  };
})();
