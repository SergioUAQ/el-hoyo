/* El hoyo: gráficas e interacción del micrositio.
 * Gráficas: barras desde cero, sin cuadrícula ni leyendas,
 * etiquetas directas, colores seguros para daltonismo siempre acompañados de texto. */

const C = { tinta: "#2B1736", suave: "#5E4E6B", morado: "#6B2C91", lila: "#B48CD6",
            ambar: "#E69F00", verde: "#1B9E77", niebla: "#9B8FA6", papel: "#F3EFF7" };
const EDADES = DATOS.edades;
const P24 = DATOS.nacional["2024"];
const REDUCIR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DUR = REDUCIR ? 0 : 900;
const fmt1 = (v) => v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millones = (v) => (v / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 1 });
const idx = (edad) => Math.min(Math.max(edad, 18), 90) - 18;

const estado = { edad: null, entidad: "" };
const dibujadas = new Map();  // selector -> función, para volver a dibujar al cambiar el ancho

function anchoDe(sel) {
  const w = document.querySelector(sel).clientWidth || 360;
  return Math.max(300, Math.min(760, Math.round(w)));
}

function registrar(sel, fn) {
  dibujadas.set(sel, fn);
  fn();
}

/* ---------- utilidades ---------- */

function lienzo(sel, ancho, alto, etiqueta) {
  const el = document.querySelector(sel);
  el.innerHTML = "";
  return d3.select(el).append("svg")
    .attr("viewBox", `0 0 ${ancho} ${alto}`)
    .attr("role", "img").attr("aria-label", etiqueta);
}

/* Ejecuta fn una sola vez cuando el elemento entra en pantalla. */
function alVer(sel, fn) {
  const el = document.querySelector(sel);
  if (!("IntersectionObserver" in window)) return fn();
  const obs = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) { obs.disconnect(); fn(); }
  }, { threshold: 0.35 });
  obs.observe(el);
}

function ejesCurva(g, x, y, alto, conTitulos = true) {
  const angosto = x.range()[1] < 480;
  g.append("g").attr("transform", `translate(0,${alto})`)
    .call(d3.axisBottom(x).tickValues(angosto ? [18, 30, 50, 70, 90] : [18, 30, 40, 50, 60, 70, 80, 90]).tickSize(0).tickPadding(8)
      .tickFormat((d) => (d === 90 ? "90+" : d)))
    .call((s) => s.select(".domain").attr("stroke", C.tinta).attr("stroke-width", 0.6))
    .call((s) => s.selectAll("text").attr("font-size", 13));
  g.append("g")
    .call(d3.axisLeft(y).tickValues([30, 50, 70]).tickSize(0).tickPadding(6).tickFormat((d) => `${d} %`))
    .call((s) => s.select(".domain").remove())
    .call((s) => s.selectAll("text").attr("font-size", 13).attr("fill", C.suave));
  if (conTitulos) {
    g.append("text").attr("x", x(90)).attr("y", alto + 34).attr("text-anchor", "end")
      .attr("font-size", 13).attr("fill", C.suave).text("edad");
  }
}

function linea(x, y) {
  return d3.line().x((d, i) => x(EDADES[i])).y((d) => y(d)).curve(d3.curveMonotoneX);
}

/* ---------- 1. Revelación 18 vs 25 ---------- */

function graficaBarras() {
  const A = anchoDe("#g-barras"), H = 170, m = { izq: 92, der: 72, arr: 10 };
  const svg = lienzo("#g-barras", A, H, `A los 18 años votó el ${fmt1(P24[0])} %; a los 25, el ${fmt1(P24[7])} %.`);
  const x = d3.scaleLinear([0, 100], [m.izq, A - m.der]);
  const datos = [{ e: "18 años", v: P24[0] }, { e: "25 años", v: P24[7] }];
  const fila = svg.selectAll("g").data(datos).join("g").attr("transform", (d, i) => `translate(0,${m.arr + i * 75})`);
  fila.append("text").attr("x", m.izq - 12).attr("y", 30).attr("text-anchor", "end")
    .attr("font-size", 18).attr("font-weight", 700).text((d) => d.e);
  fila.append("rect").attr("x", x(0)).attr("y", 8).attr("height", 40).attr("width", 0)
    .attr("fill", (d, i) => (i === 0 ? C.morado : C.lila))
    .transition().duration(DUR).delay((d, i) => i * 500).attr("width", (d) => x(d.v) - x(0));
  fila.append("text").attr("y", 35).attr("font-size", 20).attr("font-weight", 700)
    .attr("x", (d) => x(d.v) + 10).attr("opacity", 0).text((d) => `${fmt1(d.v)} %`)
    .transition().duration(300).delay((d, i) => DUR + i * 500).attr("opacity", 1);
}

function iniciarApuesta() {
  const botones = document.querySelectorAll(".boton-apuesta");
  botones.forEach((b) => b.addEventListener("click", () => {
    botones.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    const eligio18 = b.dataset.edad === "18";
    document.getElementById("reaccion").textContent = eligio18
      ? "Le atinaste y por bastante."
      : "Nope. Es al revés y por casi 15 puntos.";
    const caja = document.getElementById("revelacion");
    caja.hidden = false;
    registrar("#g-barras", graficaBarras);
  }));
}

/* ---------- 2 y 3. Curva por edad (con "tú" opcional) ---------- */

function graficaCurva(sel, serie, opciones = {}) {
  const A = anchoDe(sel), H = Math.round(Math.max(280, Math.min(380, A * 0.62))), m = { izq: 44, der: 14, arr: 34, aba: 44 };
  const alto = H - m.arr - m.aba;
  const tu = opciones.edad != null ? idx(opciones.edad) : null;
  const pico = d3.maxIndex(serie);
  const svg = lienzo(sel, A, H, opciones.etiqueta ||
    `Curva de participación por edad en 2024 con ${fmt1(serie[0])} % a los 18, mínimo de ${fmt1(d3.min(serie.slice(0, 13)))} % en los veintes y máximo de ${fmt1(serie[pico])} % a los ${EDADES[pico]}.`);
  const g = svg.append("g").attr("transform", `translate(${m.izq},${m.arr})`);
  const x = d3.scaleLinear([18, 90], [0, A - m.izq - m.der]);
  const y = d3.scaleLinear([20, 85], [alto, 0]);

  g.append("rect").attr("x", x(20)).attr("width", x(29.5) - x(20)).attr("y", 0).attr("height", alto)
    .attr("fill", C.lila).attr("opacity", 0.22);
  g.append("text").attr("x", x(24.75)).attr("y", -10).attr("text-anchor", "middle")
    .attr("font-size", 15).attr("font-weight", 700).attr("fill", C.morado).text("el hoyo");

  ejesCurva(g, x, y, alto);

  const camino = g.append("path").datum(serie).attr("fill", "none").attr("stroke", C.morado)
    .attr("stroke-width", 3).attr("d", linea(x, y));
  if (opciones.animar && !REDUCIR) {
    const L = camino.node().getTotalLength();
    camino.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L)
      .transition().duration(1800).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0);
  }

  const anot = (i, texto, dy, ancla = "middle") => {
    g.append("circle").attr("cx", x(EDADES[i])).attr("cy", y(serie[i])).attr("r", 4).attr("fill", C.morado);
    g.append("text").attr("x", x(EDADES[i])).attr("y", y(serie[i]) + dy).attr("text-anchor", ancla)
      .attr("font-size", 14).text(texto);
  };
  anot(0, `${fmt1(serie[0])} % a los 18`, -12, "start");
  anot(pico, `${fmt1(serie[pico])} % a los ${EDADES[pico]}`, -12);

  if (tu !== null) {
    g.append("circle").attr("cx", x(EDADES[tu])).attr("cy", y(serie[tu])).attr("r", 9)
      .attr("fill", C.ambar).attr("stroke", C.tinta).attr("stroke-width", 1.5);
    const derecha = EDADES[tu] > 60;
    g.append("text").attr("x", x(EDADES[tu]) + (derecha ? -14 : 14)).attr("y", y(serie[tu]) + 28)
      .attr("text-anchor", derecha ? "end" : "start").attr("font-size", 15).attr("font-weight", 700)
      .text(`${fmt1(serie[tu])} % a tu edad`);
  }
}

/* ---------- 3. Formulario de edad ---------- */

function serieActual() {
  return estado.entidad ? DATOS.estados2024[estado.entidad] : P24;
}

function iniciarEdad() {
  const sel = document.getElementById("estado");
  Object.keys(DATOS.estados2024).forEach((n) => sel.add(new Option(n, n)));
  document.getElementById("form-edad").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const edad = parseInt(document.getElementById("edad").value, 10);
    estado.edad = edad;
    const edadTarjeta = document.getElementById("edad-tarjeta");
    if (!edadTarjeta.value && edad >= 17 && edad <= 100) edadTarjeta.value = edad;
    estado.entidad = sel.value;
    const salida = document.getElementById("resultado-edad");
    const lugar = estado.entidad ? `en ${estado.entidad}` : "en México";
    if (!(edad >= 15 && edad <= 100)) {
      salida.textContent = "Escribe una edad entre 15 y 100 años.";
      return;
    }
    if (edad < 18) {
      salida.textContent = edad === 17
        ? "Si cumples 18 antes del 6 de junio de 2027, ya puedes sacar tu credencial. Tienes hasta el 25 de enero de 2027."
        : "Todavía no te toca. Cuando cumplas 18, saca tu credencial. A esa edad es cuando más se vota en toda la juventud.";
      registrar("#g-tu", () => graficaCurva("#g-tu", serieActual()));
      return;
    }
    const v = serieActual()[idx(edad)];
    const enHoyo = edad >= 20 && edad <= 29;
    salida.innerHTML = `A los <span class="tu">${edad >= 90 ? "90 años o más" : `${edad} años`}</span> votó el ${fmt1(v)} % ${lugar} en 2024.` +
      (enHoyo ? " Estás en pleno hoyo." : edad < 20 ? " Estás justo antes del hoyo." : edad < 44 ? " Vas saliendo del hoyo." : "");
    registrar("#g-tu", () => graficaCurva("#g-tu", serieActual(), { edad }));
  });
  registrar("#g-tu", () => graficaCurva("#g-tu", P24));
}

/* ---------- 4. Múltiplos pequeños ---------- */

function graficaMultiples() {
  const cont = document.getElementById("g-multiples");
  cont.innerHTML = "";
  const cols = cont.clientWidth < 600 ? 2 : 3;
  const A = Math.max(150, Math.floor((cont.clientWidth - 16 * (cols - 1)) / cols)), H = 170, m = { izq: 30, der: 8, arr: 40, aba: 22 };
  const alto = H - m.arr - m.aba;
  const x = d3.scaleLinear([18, 90], [0, A - m.izq - m.der]);
  const y = d3.scaleLinear([20, 85], [alto, 0]);
  DATOS.anios.forEach((anio) => {
    const s = DATOS.nacional[String(anio)];
    const svg = d3.select(cont).append("svg").attr("viewBox", `0 0 ${A} ${H}`).attr("role", "img")
      .attr("aria-label", `${anio}: ${fmt1(s[0])} % a los 18 y ${fmt1(s[7])} % a los 25.`);
    const g = svg.append("g").attr("transform", `translate(${m.izq},${m.arr})`);
    g.append("rect").attr("x", x(20)).attr("width", x(29.5) - x(20)).attr("height", alto).attr("fill", C.lila).attr("opacity", 0.22);
    g.append("text").attr("x", 0).attr("y", -24).attr("font-size", 17).attr("font-weight", 700).text(anio);
    g.append("text").attr("x", 0).attr("y", -7).attr("font-size", 12).attr("fill", C.suave)
      .text(`${Math.round(s[0])} % a los 18 y ${Math.round(s[7])} % a los 25`);
    g.append("g").attr("transform", `translate(0,${alto})`)
      .call(d3.axisBottom(x).tickValues([18, 50, 90]).tickSize(0).tickPadding(5).tickFormat((d) => (d === 90 ? "90+" : d)))
      .call((q) => q.select(".domain").attr("stroke", C.tinta).attr("stroke-width", 0.5))
      .call((q) => q.selectAll("text").attr("font-size", 11));
    g.append("g").call(d3.axisLeft(y).tickValues([30, 70]).tickSize(0).tickPadding(4).tickFormat((d) => `${d}%`))
      .call((q) => q.select(".domain").remove()).call((q) => q.selectAll("text").attr("font-size", 10).attr("fill", C.suave));
    g.append("path").datum(s).attr("fill", "none").attr("stroke", C.morado).attr("stroke-width", 2).attr("d", linea(x, y));
  });
}

/* ---------- 5. 12.4 millones en círculos ---------- */

function graficaPuntos() {
  const n = Math.round(DATOS.bloques.no_votaron_jovenes / 1e5);
  const A = anchoDe("#g-puntos"), cols = A < 500 ? 12 : 20, paso = A / cols, r = paso * 0.36, H = Math.ceil(n / cols) * paso + 4;
  const svg = lienzo("#g-puntos", A, H, `${n} círculos. Cada uno son 100 mil jóvenes que no votaron en 2024.`);
  svg.selectAll("circle").data(d3.range(n)).join("circle")
    .attr("cx", (d) => (d % cols) * paso + paso / 2).attr("cy", (d) => Math.floor(d / cols) * paso + paso / 2)
    .attr("r", r).attr("fill", C.lila).attr("stroke", C.morado).attr("stroke-width", 1)
    .attr("opacity", REDUCIR ? 1 : 0)
    .transition().duration(DUR ? 250 : 0).delay((d) => (REDUCIR ? 0 : d * 14)).attr("opacity", 1);
}

/* ---------- 6. La casilla promedio ---------- */

function graficaCasilla() {
  const A = anchoDe("#g-casilla"), H = 120, m = { izq: 14, der: 14 };
  const porHora = 33;
  const svg = lienzo("#g-casilla", A, H, "En una hora una casilla promedio recibe a unas 33 personas, una cada dos minutos.");
  const x = d3.scaleLinear([0, 60], [m.izq, A - m.der]);
  svg.append("g").attr("transform", "translate(0,84)")
    .call(d3.axisBottom(x).tickValues([0, 15, 30, 45, 60]).tickSize(0).tickPadding(10).tickFormat((d) => `${d} min`))
    .call((q) => q.select(".domain").attr("stroke", C.tinta).attr("stroke-width", 0.6))
    .call((q) => q.selectAll("text").attr("font-size", 13));
  svg.selectAll("rect.p").data(d3.range(porHora)).join("rect").attr("class", "p")
    .attr("x", (d) => x((d + 0.5) * 60 / porHora) - 2.5).attr("width", 5).attr("rx", 2.5)
    .attr("y", 76).attr("height", 0).attr("fill", C.morado)
    .transition().duration(REDUCIR ? 0 : 250).delay((d) => (REDUCIR ? 0 : d * 90))
    .attr("y", 40).attr("height", 36);
  svg.append("text").attr("x", m.izq).attr("y", 24).attr("font-size", 14).attr("font-weight", 700)
    .text("33 personas en una hora en una casilla promedio");
}

/* ---------- 7. La línea de vida y las razones ---------- */

function graficaVida() {
  const A = anchoDe("#g-vida"), H = 190;
  const svg = lienzo("#g-vida", A, H, "Línea de vida: a los 18 en casa de la familia, a los 21 en la universidad, a los 24 en el primer trabajo. La credencial se queda con el domicilio de los 18.");
  const xs = [0.13, 0.5, 0.87].map((f) => f * A);
  const paradas = [{ x: xs[0], edad: "18", lugar: "casa familiar" }, { x: xs[1], edad: "21", lugar: "universidad" }, { x: xs[2], edad: "24", lugar: "primer trabajo" }];
  svg.append("line").attr("x1", xs[0] - 20).attr("x2", xs[2] + 20).attr("y1", 100).attr("y2", 100).attr("stroke", C.tinta).attr("stroke-width", 1.5);
  const p = svg.selectAll("g.parada").data(paradas).join("g").attr("transform", (d) => `translate(${d.x},100)`);
  p.append("circle").attr("r", 7).attr("fill", C.papel).attr("stroke", C.tinta).attr("stroke-width", 2);
  p.append("text").attr("y", 34).attr("text-anchor", "middle").attr("font-size", 16).attr("font-weight", 700).text((d) => `${d.edad} años`);
  p.append("text").attr("y", 54).attr("text-anchor", "middle").attr("font-size", 14).attr("fill", C.suave).text((d) => d.lugar);
  // La credencial se queda en la primera parada.
  const cred = svg.append("g").attr("transform", `translate(${xs[0] - 28},18)`);
  cred.append("rect").attr("width", 56).attr("height", 36).attr("rx", 5).attr("fill", "#fff").attr("stroke", C.morado).attr("stroke-width", 2);
  cred.append("circle").attr("cx", 15).attr("cy", 18).attr("r", 7).attr("fill", C.lila);
  cred.append("line").attr("x1", 27).attr("x2", 48).attr("y1", 14).attr("y2", 14).attr("stroke", C.morado).attr("stroke-width", 2);
  cred.append("line").attr("x1", 27).attr("x2", 44).attr("y1", 22).attr("y2", 22).attr("stroke", C.morado).attr("stroke-width", 2);
  svg.append("text").attr("x", xs[0] + 36).attr("y", 42).attr("font-size", 14).attr("fill", C.morado).text("tu credencial sigue aquí");
  // La persona avanza.
  const tu = svg.append("circle").attr("cx", xs[0]).attr("cy", 100).attr("r", 10).attr("fill", C.ambar).attr("stroke", C.tinta);
  tu.transition().duration(REDUCIR ? 0 : 2600).ease(d3.easeCubicInOut).attr("cx", xs[2]);
  svg.append("text").attr("x", xs[2]).attr("y", 80).attr("text-anchor", "middle").attr("font-size", 15).attr("font-weight", 700).text("tú");
}

function graficaRazones() {
  const datos = [
    ["No tenía credencial para votar", 33.94, true],
    ["No me enteré de la fecha", 14.15, true],
    ["No me llamó la atención ninguna candidatura", 11.06, false],
    ["No creo en la legalidad de las elecciones", 10.21, false],
    ["No sabía dónde ni cómo votar", 9.47, true],
    ["No me importaba el cargo que se elegía", 7.02, false],
    ["No consideré importante mi participación", 6.70, false],
    ["No respondió", 6.38, false],
    ["Sentí inseguridad de salir a votar", 1.06, false],
  ];
  const A = anchoDe("#g-razones"), fila = 42, H = datos.length * fila + 40, izq = 0;
  const svg = lienzo("#g-razones", A, H, "Razones para no votar. No tenía credencial 34 %, no se enteró de la fecha 14 %, no sabía dónde ni cómo 9 %. Las razones de logística suman 58 %.");
  const x = d3.scaleLinear([0, 40], [izq, A - 64]);
  const g = svg.selectAll("g").data(datos).join("g").attr("transform", (d, i) => `translate(0,${i * fila})`);
  g.append("text").attr("y", 14).attr("font-size", 14).attr("font-weight", (d) => (d[2] ? 700 : 400))
    .attr("fill", (d) => (d[2] ? C.tinta : C.suave)).text((d) => d[0]);
  g.append("rect").attr("x", x(0)).attr("y", 20).attr("height", 12).attr("width", 0)
    .attr("fill", (d) => (d[2] ? C.morado : C.niebla))
    .transition().duration(DUR).delay((d, i) => i * 80).attr("width", (d) => x(d[1]) - x(0));
  g.append("text").attr("x", (d) => x(d[1]) + 6).attr("y", 31).attr("font-size", 13).text((d) => `${fmt1(d[1])} %`);
  svg.append("text").attr("x", 0).attr("y", H - 6).attr("font-size", 14).attr("font-weight", 700).attr("fill", C.morado)
    .text("En morado las razones de logística, que suman 57.6 %");
}

/* ---------- 8. Bloques: jóvenes vs 60+ ---------- */

function graficaBloques() {
  const b = DATOS.bloques;
  const A = anchoDe("#g-bloques"), H = 320;
  const svg = lienzo("#g-bloques", A, H,
    `Lista nominal: ${millones(b.ln_jovenes)} millones de jóvenes y ${millones(b.ln_60)} millones de personas de 60 o más. Votos: ${millones(b.votos_jovenes)} y ${millones(b.votos_60)} millones.`);
  const x = d3.scaleLinear([0, b.ln_jovenes], [0, A - 4]);
  const grupos = [
    { titulo: "En la lista nominal", y: 18, filas: [["18 a 29 años", b.ln_jovenes, C.morado], ["60 años o más", b.ln_60, C.niebla]] },
    { titulo: "Votos emitidos", y: 178, filas: [["18 a 29 años", b.votos_jovenes, C.morado], ["60 años o más", b.votos_60, C.niebla]] },
  ];
  grupos.forEach((gr, k) => {
    const g = svg.append("g").attr("transform", `translate(0,${gr.y})`);
    g.append("text").attr("font-size", 16).attr("font-weight", 700).text(gr.titulo);
    gr.filas.forEach(([nombre, v, color], i) => {
      const yy = 22 + i * 62;
      g.append("text").attr("x", 0).attr("y", yy + 14).attr("font-size", 14).text(`${nombre}, ${millones(v)} millones`);
      g.append("rect").attr("x", x(0)).attr("y", yy + 22).attr("height", 22).attr("width", 0).attr("fill", color)
        .transition().duration(DUR).delay(k * 1200 + i * 200).attr("width", x(v) - x(0));
    });
  });
}

function animarContador() {
  const el = document.getElementById("contador");
  const fin = DATOS.bloques.extra_si_18;
  const txt = (v) => Math.round(v).toLocaleString("es-MX");
  if (REDUCIR) { el.textContent = txt(fin); return; }
  d3.select(el).transition().duration(1800).ease(d3.easeCubicOut)
    .tween("text", () => { const i = d3.interpolateNumber(0, fin); return (t) => { el.textContent = txt(i(t)); }; });
}

/* ---------- 9. Brecha por sexo ---------- */

function graficaSexo() {
  const A = anchoDe("#g-sexo"), H = Math.round(Math.max(280, Math.min(380, A * 0.62))), m = { izq: 44, der: 14, arr: 24, aba: 44 };
  const alto = H - m.arr - m.aba;
  const s = DATOS.sexo2024;
  const svg = lienzo("#g-sexo", A, H, `Participación por sexo en 2024. A los 27 años votó el ${fmt1(s.mujeres[9])} % de las mujeres y el ${fmt1(s.hombres[9])} % de los hombres.`);
  const g = svg.append("g").attr("transform", `translate(${m.izq},${m.arr})`);
  const x = d3.scaleLinear([18, 90], [0, A - m.izq - m.der]);
  const y = d3.scaleLinear([20, 85], [alto, 0]);
  g.append("rect").attr("x", x(20)).attr("width", x(29.5) - x(20)).attr("height", alto).attr("fill", C.lila).attr("opacity", 0.22);
  ejesCurva(g, x, y, alto);
  const area = d3.area().x((d, i) => x(EDADES[i])).y0((d, i) => y(s.hombres[i])).y1((d) => y(d)).curve(d3.curveMonotoneX);
  g.append("path").datum(s.mujeres.map((v, i) => (EDADES[i] <= 60 ? v : s.hombres[i]))).attr("fill", C.morado).attr("opacity", 0.12).attr("d", area);
  [["mujeres", C.morado, "Mujeres", -14], ["hombres", C.verde, "Hombres", 26]].forEach(([k, color, nombre, dy]) => {
    g.append("path").datum(s[k]).attr("fill", "none").attr("stroke", color).attr("stroke-width", 3).attr("d", linea(x, y));
    g.append("text").attr("x", x(31)).attr("y", y(s[k][13]) + dy).attr("text-anchor", "start")
      .attr("font-size", 15).attr("font-weight", 700).attr("fill", color === C.verde ? "#13775A" : color)
      .text(nombre);
  });
}

/* ---------- 11. Tarjeta personal ---------- */

const SITIO = "sergiouaq.github.io/el-hoyo";

function fraseOrgullo(edad) {
  if (edad < 18) return "Voy a estrenar mi credencial.";
  if (edad < 20) return "Mi primer voto no será el último.";
  if (edad <= 29) return "Yo salgo del hoyo.";
  return "Yo sigo votando.";
}

function textoPost(edad, conQuien) {
  const inicio = edad < 18
    ? "Voy a estrenar credencial. Mi primer voto es el 6 de junio de 2027. 🗳️"
    : edad < 20
      ? "Mi primer voto no va a ser el último. El 6 de junio de 2027 voto. 🗳️"
      : edad <= 29
        ? "A los 18 vota más del 60 % y a los 25 menos de la mitad. Yo no me quedo en ese hoyo. El 6 de junio de 2027 voto. 🗳️"
        : "El 6 de junio de 2027 voto. 🗳️";
  const con = conQuien ? ` Voy con ${conQuien}.` : "";
  return `${inicio}${con} ¿Quién más? Checa en qué parte de la curva vas en https://${SITIO} #ElHoyo #YoVoto2027`;
}

/* Escribe texto con salto de línea automático; devuelve la y siguiente. */
function escribir(ctx, texto, x, y, ancho, alto) {
  const palabras = texto.split(" ");
  let linea = "";
  palabras.forEach((p) => {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      ctx.fillText(linea, x, y); y += alto; linea = p;
    } else linea = prueba;
  });
  if (linea) { ctx.fillText(linea, x, y); y += alto; }
  return y;
}

/* Generador pseudoaleatorio con semilla (mulberry32), para que cada edad tenga su propio ascenso. */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* El ascenso: una luz sale del punto de la persona en la curva y sube por encima del pico. */
function dibujarAscenso(ctx, x0, y0, yFin, semilla) {
  const r = azar(semilla);
  const x1 = x0 + 60 + r() * 60, y1 = yFin;
  const cx = x0 - 40 + r() * 30, cy = (y0 + y1) / 2;
  const punto = (t) => [
    (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1,
  ];
  // Despegue: un anillo tenue donde empieza.
  ctx.strokeStyle = "rgba(230,159,0,0.45)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x0, y0, 26, 0, Math.PI * 2); ctx.stroke();
  // Estela: partículas que crecen y se encienden conforme sube.
  for (let k = 0; k < 900; k++) {
    const t = k / 900;
    const [x, y] = punto(t);
    const abre = 4 + 22 * (1 - t);
    const tam = 1.5 + 6 * t * t;
    ctx.fillStyle = `rgba(230,159,0,${(0.12 + 0.75 * t).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * abre, y + (r() - 0.5) * abre * 0.5, tam * (0.5 + r() * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  // Halo y chispas alrededor de la cabeza.
  const halo = ctx.createRadialGradient(x1, y1, 0, x1, y1, 130);
  halo.addColorStop(0, "rgba(255,201,77,0.75)");
  halo.addColorStop(0.35, "rgba(230,159,0,0.30)");
  halo.addColorStop(1, "rgba(230,159,0,0)");
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x1, y1, 130, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 60; k++) {
    const ang = r() * Math.PI * 2, dist = 30 + r() * 90;
    ctx.fillStyle = `rgba(230,159,0,${(0.25 + r() * 0.6).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(x1 + Math.cos(ang) * dist, y1 + Math.sin(ang) * dist, 1.5 + r() * 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#FFD76E"; ctx.beginPath(); ctx.arc(x1, y1, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#FFF4D6"; ctx.beginPath(); ctx.arc(x1, y1, 8, 0, Math.PI * 2); ctx.fill();
}

let ultimaTarjeta = null;  // { blob, texto }

function crearTarjeta(ev) {
  ev.preventDefault();
  const aviso = document.getElementById("aviso-tarjeta");
  const edad = parseInt(document.getElementById("edad-tarjeta").value, 10);
  if (!(edad >= 17 && edad <= 100)) {
    aviso.textContent = "Escribe una edad entre 17 y 100 años.";
    return;
  }
  const conQuien = document.getElementById("con-quien").value.trim().slice(0, 24);
  const historia = document.querySelector('input[name="formato"]:checked').value === "historia";
  const W = 1080, H = historia ? 1920 : 1350;
  const artH = historia ? 920 : 560;
  aviso.textContent = "Dibujando tu tarjeta…";
  const serie = serieActual();
  const holder = document.createElement("div");
  holder.style.cssText = "position:absolute;left:-99999px;top:0";
  document.body.appendChild(holder);

  document.fonts.ready.then(() => sedimento({
    contenedor: holder, ancho: W, alto: artH, semilla: 1000 + edad, animar: false,
    densidad: 1, serie, total: historia ? 26000 : 20000, tam: 3.4, sinPerdidas: true,
    alTerminar: (arte, geo) => {
      const cv = document.getElementById("vista-tarjeta");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      const X = 80, ancho = W - 2 * X;
      ctx.fillStyle = C.papel; ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = "alphabetic";

      // Encabezado: el compromiso.
      let y = historia ? 210 : 150;
      ctx.fillStyle = C.tinta;
      ctx.font = `800 ${historia ? 150 : 118}px "Bricolage Grotesque"`;
      ctx.fillText("Yo voto", X, y);
      y += historia ? 120 : 96;
      ctx.fillStyle = C.morado;
      ctx.font = `700 ${historia ? 82 : 66}px "Bricolage Grotesque"`;
      ctx.fillText("el 6 de junio de 2027", X, y);

      // La curva real y, desde la edad de la persona, el ascenso por encima del pico.
      y += historia ? 60 : 50;
      ctx.drawImage(arte, 0, y);
      const desde = Math.max(edad, 18);
      // Termina por encima del pico de la curva (65 años): más alto que nadie.
      const pico = DATOS.edades[d3.maxIndex(serie)];
      dibujarAscenso(ctx, geo.x(desde), y + geo.y(desde), y + geo.y(pico) - (historia ? 110 : 70), 7000 + edad);
      y += artH - (historia ? 40 : 30);

      // Orgullo personal y con quién.
      y += historia ? 110 : 80;
      ctx.fillStyle = C.tinta;
      ctx.font = `700 ${historia ? 66 : 56}px "Bricolage Grotesque"`;
      y = escribir(ctx, fraseOrgullo(edad), X, y, ancho, historia ? 76 : 64);
      if (conQuien) {
        ctx.font = `600 ${historia ? 52 : 44}px "Bricolage Grotesque"`;
        ctx.fillStyle = C.tinta;
        const t = `Voy con ${conQuien}.`;
        ctx.fillText(t, X, y + 6);
        ctx.fillStyle = C.ambar;
        ctx.fillRect(X, y + 20, Math.min(ctx.measureText(t).width, ancho), 8);
        y += historia ? 84 : 70;
      }

      // Esperanza colectiva.
      if (historia) {
        y += 30;
        ctx.fillStyle = C.morado;
        ctx.font = '700 40px "Atkinson Hyperlegible"';
        y = escribir(ctx, "Si votamos como a los 18, somos 3 millones de votos más.", X, y, ancho, 52);
      }

      ctx.fillStyle = C.suave;
      ctx.font = '400 30px "Atkinson Hyperlegible"';
      ctx.fillText(`#ElHoyo #YoVoto2027   ${SITIO}`, X, H - 70);

      cv.hidden = false;
      const texto = textoPost(edad, conQuien);
      document.getElementById("texto-post").textContent = texto;
      document.getElementById("texto-post").hidden = false;
      cv.toBlob((blob) => {
        ultimaTarjeta = { blob, texto };
        const a = document.getElementById("descargar-tarjeta");
        if (a.href.startsWith("blob:")) URL.revokeObjectURL(a.href);
        a.href = URL.createObjectURL(blob);
        const archivo = new File([blob], "yo-voto-2027.png", { type: "image/png" });
        const puede = navigator.canShare && navigator.canShare({ files: [archivo] });
        document.getElementById("compartir-tarjeta").hidden = !puede;
        document.getElementById("compartir").hidden = false;
        aviso.textContent = puede
          ? "Lista. Ya la puedes compartir."
          : "Lista. Descárgala y súbela con el texto de abajo.";
      }, "image/png");
      holder.remove();
    },
  }));
}

async function compartirTarjeta() {
  if (!ultimaTarjeta) return;
  const archivo = new File([ultimaTarjeta.blob], "yo-voto-2027.png", { type: "image/png" });
  try {
    await navigator.share({ files: [archivo], text: ultimaTarjeta.texto, title: "Yo voto el 6 de junio de 2027" });
  } catch (e) {
    if (e.name !== "AbortError") document.getElementById("aviso-tarjeta").textContent = "No se pudo abrir el menú para compartir. Descarga la imagen y súbela desde tu app.";
  }
}

async function copiarTexto() {
  const aviso = document.getElementById("aviso-tarjeta");
  try {
    await navigator.clipboard.writeText(ultimaTarjeta ? ultimaTarjeta.texto : "");
    aviso.textContent = "Copiado. Pégalo en tu post.";
  } catch (e) {
    aviso.textContent = "No se pudo copiar. Selecciona el texto de abajo y cópialo.";
  }
}

/* Aparta la altura de las gráficas que se dibujan al entrar en pantalla, para que la página no brinque. */
function reservarAlturas() {
  const curva = (sel) => Math.round(Math.max(280, Math.min(380, anchoDe(sel) * 0.62)));
  const puntos = () => {
    const A = anchoDe("#g-puntos"), cols = A < 500 ? 12 : 20, n = Math.round(DATOS.bloques.no_votaron_jovenes / 1e5);
    return Math.ceil(n / cols) * (A / cols) + 4;
  };
  const altos = { "#g-curva": curva("#g-curva"), "#g-puntos": puntos(), "#g-casilla": 120, "#g-vida": 190,
                  "#g-razones": 9 * 42 + 40, "#g-bloques": 320 };
  Object.entries(altos).forEach(([sel, h]) => {
    const el = document.querySelector(sel);
    // El SVG usa viewBox con el ancho real, así que la altura en pantalla es proporcional.
    el.style.minHeight = `${Math.round(h * el.clientWidth / anchoDe(sel))}px`;
  });
}

/* ---------- arranque ---------- */

function iniciar() {
  const heroe = document.getElementById("sedimento");
  sedimento({ contenedor: heroe, ancho: heroe.clientWidth, alto: heroe.clientHeight, semilla: 2024, animar: !REDUCIR });

  reservarAlturas();
  iniciarApuesta();
  iniciarEdad();
  alVer("#g-curva", () => registrar("#g-curva", () => graficaCurva("#g-curva", P24, { animar: true })));
  registrar("#g-multiples", graficaMultiples);
  alVer("#g-puntos", () => registrar("#g-puntos", graficaPuntos));
  alVer("#g-casilla", () => registrar("#g-casilla", graficaCasilla));
  alVer("#g-vida", () => registrar("#g-vida", graficaVida));
  alVer("#g-razones", () => registrar("#g-razones", graficaRazones));
  alVer("#g-bloques", () => registrar("#g-bloques", graficaBloques));
  alVer("#contador", animarContador);
  registrar("#g-sexo", graficaSexo);
  document.getElementById("form-tarjeta").addEventListener("submit", crearTarjeta);
  document.getElementById("compartir-tarjeta").addEventListener("click", compartirTarjeta);
  document.getElementById("copiar-texto").addEventListener("click", copiarTexto);

  let anchoPrevio = window.innerWidth, espera;
  window.addEventListener("resize", () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      if (Math.abs(window.innerWidth - anchoPrevio) < 40) return;
      anchoPrevio = window.innerWidth;
      dibujadas.forEach((fn) => fn());
    }, 250);
  });
}

iniciar();
