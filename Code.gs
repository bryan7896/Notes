const SHEET_NAME = "Animes";
const SHEET_ERRORES = "Errores";
const SHEET_DESCARGAR = "Para descargar";

// Orden real de tu hoja: link ahora va al final
const HEADERS = ["id", "Nombre", "Descripción", "Temporada", "Episodio", "Estado",
                  "Imagen1", "Imagen2", "Imagen3",
                  "Cuándo estrenan episodio", "Cuándo sale la nueva temporada", "link"];

// Encabezados de las hojas nuevas "Porcentajes-en" / "Porcentajes-it"
// (crea estas 2 pestañas a mano en tu spreadsheet, cada una con esta fila
// 1 exacta). Son un LOG: cada vez que el English Trainer sincroniza, se
// agrega una fila nueva por cada regla EN LA HOJA DE SU IDIOMA — nunca se
// sobreescribe nada, así se puede graficar el historial. Al ser hojas
// separadas (en vez de una sola con columna "idioma"), inglés e italiano
// quedan físicamente aparte: abres la pestaña y ya ves solo ese idioma.
const HEADERS_PORCENTAJES = ["fecha", "reglaId", "regla", "porcentaje"];

// Encabezados de la hoja nueva "Listening" (créala a mano con esta fila 1
// exacta). Es el mismo patrón que "Porcentajes-en": un LOG append-only,
// una fila nueva por categoría cada vez que se cierra un bloque del Nivel
// 0 — nunca se sobreescribe nada. Una sola hoja (sin sufijo de idioma)
// porque el Nivel 0 de Listening es solo de inglés por ahora.
const SHEET_LISTENING = "Listening";
const HEADERS_LISTENING = ["fecha", "bloque", "categoria", "familia", "porcentaje", "intentos"];

// Encabezados de la hoja nueva "Notas" (créala a mano con esta fila 1
// exacta, el nombre de la pestaña debe ser exactamente "Notas"). A
// diferencia de Porcentajes/Listening, esta NO es un log: cada fila es
// una tarea viva que se actualiza (update) o se borra (delete), igual
// que Animes. "regla" guarda las reglas seleccionadas separadas por
// coma (ej. "prioridad_alta,contar_fin_semana") porque una tarea puede
// tener varias activas a la vez. "estado" guarda las fechas en que la
// tarea se marcó como terminada, separadas por coma (ej. "2026-10-26,
// 2026-11-02"), así se conserva el historial sin perder la tarea.
// "maxRetraso" se agregó AL FINAL (no en medio) para no correr las
// columnas que ya existían — si ya creaste la hoja "Notas" con los 7
// headers originales, solo agrega esta 8va columna "maxRetraso" al
// final de la fila 1. Es el número de días que una tarea puede
// atrasarse antes de convertirse en prioridad alta automáticamente.
const SHEET_NOTAS = "Notas";
const HEADERS_NOTAS = ["id", "name", "fecha inicio", "frecuencia", "estado", "regla", "valor", "maxRetraso"];

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

// ---------- GET: enruta según ?sheet=... ----------
function doGet(e) {
  const target = (e.parameter && e.parameter.sheet) ? e.parameter.sheet.toLowerCase() : "animes";

  if (target === "errores") return getErrores();
  if (target === "descargar") return getDescargar();
  if (target === "porcentajes") return getPorcentajes(e.parameter.idioma);
  if (target === "listening") return getListening();
  if (target === "notas") return getNotas();

  // ---- Lógica original de Animes, SIN CAMBIOS ----
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);

  const animes = rows
    .filter(row => row[0] !== "")
    .map(row => {
      let obj = {};
      HEADERS.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: animes }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- POST: enruta según body.sheet ----------
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const target = body.sheet ? body.sheet.toLowerCase() : "animes";

  if (target === "errores") return postErrores(body);
  if (target === "descargar") return postDescargar(body);
  if (target === "porcentajes") return postPorcentajes(body);
  if (target === "listening") return postListening(body);
  if (target === "notas") return postNotas(body);

  // ---- Lógica original de Animes, SIN CAMBIOS ----
  const sheet = getSheet();

  if (body.action === "add") {
    const data = sheet.getDataRange().getValues();
    const ids = data.slice(1).map(r => Number(r[0])).filter(n => !isNaN(n));
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    sheet.appendRow([
      newId,
      body.Nombre || "",
      body.Descripcion || "",
      body.Temporada || 1,
      body.Episodio || 0,
      body.Estado || "Pendiente",
      body.Imagen1 || "",
      body.Imagen2 || "",
      body.Imagen3 || "",
      body.CuandoEstrenanEpisodio || "",
      body.CuandoSaleNuevaTemporada || "",
      body.link || ""
    ]);

    return respond({ success: true, id: newId });
  }

  if (body.action === "update") {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (Number(data[i][0]) === Number(body.id)) {
        const rowNum = i + 1;
        if (body.Nombre !== undefined) sheet.getRange(rowNum, 2).setValue(body.Nombre);
        if (body.Descripcion !== undefined) sheet.getRange(rowNum, 3).setValue(body.Descripcion);
        if (body.Temporada !== undefined) sheet.getRange(rowNum, 4).setValue(body.Temporada);
        if (body.Episodio !== undefined) sheet.getRange(rowNum, 5).setValue(body.Episodio);
        if (body.Estado !== undefined) sheet.getRange(rowNum, 6).setValue(body.Estado);
        if (body.Imagen1 !== undefined) sheet.getRange(rowNum, 7).setValue(body.Imagen1);
        if (body.Imagen2 !== undefined) sheet.getRange(rowNum, 8).setValue(body.Imagen2);
        if (body.Imagen3 !== undefined) sheet.getRange(rowNum, 9).setValue(body.Imagen3);
        if (body.CuandoEstrenanEpisodio !== undefined) sheet.getRange(rowNum, 10).setValue(body.CuandoEstrenanEpisodio);
        if (body.CuandoSaleNuevaTemporada !== undefined) sheet.getRange(rowNum, 11).setValue(body.CuandoSaleNuevaTemporada);
        if (body.link !== undefined) sheet.getRange(rowNum, 12).setValue(body.link);

        return respond({ success: true });
      }
    }
    return respond({ success: false, error: "ID no encontrado" });
  }

  return respond({ success: false, error: "Acción no reconocida" });
}

// ---------- Helpers genéricos para hojas de una sola columna ----------
function getSingleColumnSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`No existe la hoja "${name}"`);
  return sheet;
}

function readSingleColumn(name) {
  const sheet = getSingleColumnSheet(name);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); // saltar encabezado

  return rows
    .map((row, i) => ({ id: i + 2, value: row[0] })) // id = número real de fila
    .filter(item => item.value !== "");
}

// ---------- Errores (columna: url) ----------
function getErrores() {
  const items = readSingleColumn(SHEET_ERRORES).map(item => ({ id: item.id, url: item.value }));
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: items }))
    .setMimeType(ContentService.MimeType.JSON);
}

function postErrores(body) {
  const sheet = getSingleColumnSheet(SHEET_ERRORES);

  if (body.action === "add") {
    sheet.appendRow([body.url || ""]);
    return respond({ success: true });
  }

  if (body.action === "delete") {
    if (body.id === undefined) return respond({ success: false, error: "Falta id" });
    sheet.deleteRow(Number(body.id));
    return respond({ success: true });
  }

  return respond({ success: false, error: "Acción no reconocida" });
}

// ---------- Para descargar (columna: general) ----------
function getDescargar() {
  const items = readSingleColumn(SHEET_DESCARGAR).map(item => ({ id: item.id, general: item.value }));
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: items }))
    .setMimeType(ContentService.MimeType.JSON);
}

function postDescargar(body) {
  const sheet = getSingleColumnSheet(SHEET_DESCARGAR);

  if (body.action === "add") {
    sheet.appendRow([body.general || ""]);
    return respond({ success: true });
  }

  if (body.action === "delete") {
    if (body.id === undefined) return respond({ success: false, error: "Falta id" });
    sheet.deleteRow(Number(body.id));
    return respond({ success: true });
  }

  return respond({ success: false, error: "Acción no reconocida" });
}

// ---------- Porcentajes (English Trainer): fecha | reglaId | regla | porcentaje ----------
// Una hoja POR IDIOMA ("Porcentajes-en", "Porcentajes-it", y así con
// cualquier idioma nuevo que agregues). Es un LOG append-only -> nunca se
// actualiza ni se borra una fila, solo se agregan filas nuevas. Así
// "getPorcentajes" devuelve TODO el historial de ESE idioma y el cliente
// (la PWA) calcula el último valor por regla, o grafica la serie
// completa para la gráfica de barras.
function getPorcentajesSheetName(idioma) {
  return "Porcentajes-" + String(idioma || "en").toLowerCase();
}

function getPorcentajesSheet(idioma) {
  const name = getPorcentajesSheetName(idioma);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`No existe la hoja "${name}" — créala con los encabezados: ${HEADERS_PORCENTAJES.join(" | ")}`);
  return sheet;
}

function getPorcentajes(idioma) {
  const sheet = getPorcentajesSheet(idioma);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); // saltar encabezado

  const items = rows
    .filter(row => row[0] !== "" && row[1] !== "")
    .map((row, i) => ({
      fila: i + 2,
      fecha: row[0],
      reglaId: row[1],
      regla: row[2],
      porcentaje: row[3]
    }));

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: items }))
    .setMimeType(ContentService.MimeType.JSON);
}

function postPorcentajes(body) {
  const idioma = body.idioma || "en";
  const sheet = getPorcentajesSheet(idioma);

  if (body.action === "add") {
    const fecha = new Date();
    const registros = Array.isArray(body.registros) ? body.registros : [];

    registros.forEach(r => {
      sheet.appendRow([fecha, r.reglaId, r.regla || "", r.porcentaje]);
    });

    return respond({ success: true, agregados: registros.length });
  }

  return respond({ success: false, error: "Acción no reconocida" });
}

// ---------- Listening (Nivel 0): fecha | bloque | categoria | familia | porcentaje | intentos ----------
// Igual que getPorcentajes/postPorcentajes: LOG append-only, el cliente
// calcula el score (ya tiene las fórmulas de tolerancia por familia) y
// solo sube el historial. El GET es para traer ese historial y mostrar
// progreso entre dispositivos/sesiones, nunca para calcular nada aquí.
function getListeningSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LISTENING);
  if (!sheet) throw new Error(`No existe la hoja "${SHEET_LISTENING}" — créala con los encabezados: ${HEADERS_LISTENING.join(" | ")}`);
  return sheet;
}

function getListening() {
  const sheet = getListeningSheet();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); // saltar encabezado

  const items = rows
    .filter(row => row[0] !== "" && row[1] !== "")
    .map((row, i) => ({
      fila: i + 2,
      fecha: row[0],
      bloque: row[1],
      categoria: row[2],
      familia: row[3],
      porcentaje: row[4],
      intentos: row[5]
    }));

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: items }))
    .setMimeType(ContentService.MimeType.JSON);
}

function postListening(body) {
  const sheet = getListeningSheet();

  if (body.action === "add") {
    const fecha = new Date();
    const registros = Array.isArray(body.registros) ? body.registros : [];

    registros.forEach(r => {
      sheet.appendRow([fecha, r.bloque, r.categoria || "", r.familia || "", r.porcentaje, r.intentos || 1]);
    });

    return respond({ success: true, agregados: registros.length });
  }

  return respond({ success: false, error: "Acción no reconocida" });
}

// ---------- Notas (PWA de tareas): id | name | fecha inicio | frecuencia | estado | regla | valor ----------
// Mismo patrón que Animes: cada tarea es una fila viva que se agrega,
// actualiza o borra. "regla" = reglas seleccionadas separadas por coma.
// "estado" = fechas (separadas por coma) en que la tarea fue marcada
// como terminada; una tarea puede tener varias fechas acumuladas y
// sigue existiendo (marcarla como terminada no la elimina del listado
// futuro, la lógica de repetición vive en el cliente).
function getNotasSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTAS);
  if (!sheet) throw new Error(`No existe la hoja "${SHEET_NOTAS}" — créala con los encabezados: ${HEADERS_NOTAS.join(" | ")}`);
  return sheet;
}

function getNotas() {
  const sheet = getNotasSheet();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); // saltar encabezado

  const notas = rows
    .filter(row => row[0] !== "")
    .map(row => {
      let obj = {};
      HEADERS_NOTAS.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: notas }))
    .setMimeType(ContentService.MimeType.JSON);
}

function postNotas(body) {
  const sheet = getNotasSheet();

  if (body.action === "add") {
    const data = sheet.getDataRange().getValues();
    const ids = data.slice(1).map(r => Number(r[0])).filter(n => !isNaN(n));
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    sheet.appendRow([
      newId,
      body.name || "",
      body.fechaInicio || "",
      body.frecuencia || "",
      body.estado || "",     // fechas de "terminada" separadas por coma, o "" si nunca se ha marcado
      body.regla || "",      // reglas separadas por coma, ej. "prioridad_alta,contar_fin_semana"
      body.valor || "",
      body.maxRetraso !== undefined ? body.maxRetraso : 0
    ]);

    return respond({ success: true, id: newId });
  }

  if (body.action === "update") {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (Number(data[i][0]) === Number(body.id)) {
        const rowNum = i + 1;
        if (body.name !== undefined) sheet.getRange(rowNum, 2).setValue(body.name);
        if (body.fechaInicio !== undefined) sheet.getRange(rowNum, 3).setValue(body.fechaInicio);
        if (body.frecuencia !== undefined) sheet.getRange(rowNum, 4).setValue(body.frecuencia);
        if (body.estado !== undefined) sheet.getRange(rowNum, 5).setValue(body.estado);
        if (body.regla !== undefined) sheet.getRange(rowNum, 6).setValue(body.regla);
        if (body.valor !== undefined) sheet.getRange(rowNum, 7).setValue(body.valor);
        if (body.maxRetraso !== undefined) sheet.getRange(rowNum, 8).setValue(body.maxRetraso);

        return respond({ success: true });
      }
    }
    return respond({ success: false, error: "ID no encontrado" });
  }

  if (body.action === "delete") {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (Number(data[i][0]) === Number(body.id)) {
        sheet.deleteRow(i + 1);
        return respond({ success: true });
      }
    }
    return respond({ success: false, error: "ID no encontrado" });
  }

  return respond({ success: false, error: "Acción no reconocida" });
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
