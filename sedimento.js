/* Sedimento: arte generativo con los datos reales.
 * Cada partícula es una fracción de la lista nominal de 2024 y cae en la columna de su edad.
 * Al llegar a la altura de su edad, se queda (votó) con probabilidad igual a la participación
 * medida; si no, sigue cayendo y se pierde. Misma semilla => mismo sedimento. */

const PARAMS_SEDIMENTO = {
  total: 9000,          // partículas
  porCuadro: 140,       // partículas sembradas por cuadro
  caida: 3.2,           // velocidad base de caída (px por cuadro, escalada al alto)
  ruidoEscala: 0.004,   // escala espacial del ruido Perlin
  ruidoFuerza: 0.9,     // desvío lateral máximo por cuadro (px)
  grosor: 0.016,        // grosor del depósito (fracción del alto)
  pMin: 20, pMax: 88,   // dominio vertical de la participación (%)
};

function sedimento(opciones) {
  const o = Object.assign({
    contenedor: null, ancho: 800, alto: 500, semilla: 2024, resaltar: null,
    animar: true, densidad: undefined, fondo: "#F3EFF7", alTerminar: null,
  }, opciones);
  const P = PARAMS_SEDIMENTO;
  const edades = DATOS.edades;
  const part = o.serie || DATOS.nacional["2024"];
  const ln = DATOS.ln2024;

  return new p5((p) => {
    let deposito, activas = [], sembradas = 0, acumulado = [], colW, terminado = false, cuadro = 0;
    let perdidas = [], escalaFondo = 1, pilar = 0, escalaPilar = 0;
    const total = o.total || P.total;
    const tam = o.tam || Math.max(1.4, o.ancho / 520);
    const m = { izq: o.ancho * 0.02, der: o.ancho * 0.02, arr: o.alto * 0.06, aba: o.alto * 0.02 };
    const xEdad = (i) => m.izq + (i + 0.5) * colW;
    const yEdad = (i) => m.arr + (1 - (part[i] - P.pMin) / (P.pMax - P.pMin)) * (o.alto - m.arr - m.aba);

    function elegirEdad() {
      const r = p.random(acumulado[acumulado.length - 1]);
      let lo = 0, hi = acumulado.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (acumulado[mid] < r) lo = mid + 1; else hi = mid; }
      return lo;
    }

    function sembrar(n) {
      for (let k = 0; k < n && sembradas < total; k++, sembradas++) {
        const i = elegirEdad();
        activas.push({ i, x: xEdad(i) + p.random(-colW / 2, colW / 2), y: p.random(-o.alto * 0.3, 0),
                       v: P.caida * (o.alto / 500) * p.random(0.7, 1.3), decidida: false, queda: false, a: 255 });
      }
    }

    function colorDe(i, queda) {
      const tuya = o.resaltar !== null && edades[i] === o.resaltar;
      if (queda) return tuya ? p.color(230, 159, 0, 255) : p.color(107, 44, 145, 130);
      return tuya ? p.color(230, 159, 0, 170) : p.color(180, 140, 214, 110);
    }

    function paso() {
      sembrar(P.porCuadro);
      const t = ++cuadro * 0.01;
      for (let k = activas.length - 1; k >= 0; k--) {
        const a = activas[k];
        const x0 = xEdad(a.i);
        a.x += (p.noise(a.x * P.ruidoEscala, a.y * P.ruidoEscala, t) - 0.5) * 2 * P.ruidoFuerza;
        a.x = p.constrain(a.x, x0 - colW / 2, x0 + colW / 2);
        a.y += a.v;
        const yObj = yEdad(a.i);
        if (!a.decidida && a.y >= yObj) {
          a.decidida = true;
          // En la tarjeta, la columna de la persona siempre se queda: es su compromiso, no un dato.
          a.queda = (o.quedaSiempre && edades[a.i] === o.resaltar) || p.random(100) < part[a.i];
          if (a.queda) {
            deposito.noStroke();
            deposito.fill(colorDe(a.i, true));
            // La columna de la persona crece hacia arriba desde su punto en la curva: un pilar.
            const esPilar = o.quedaSiempre && edades[a.i] === o.resaltar;
            if (esPilar) {
              deposito.circle(xEdad(a.i) + p.randomGaussian(0, colW * 0.55), yObj - pilar++ * escalaPilar, tam * 1.4);
            } else {
              deposito.circle(a.x, yObj + p.randomGaussian(0, P.grosor * o.alto), tam);
            }
            activas.splice(k, 1);
            continue;
          }
        }
        // Lo que no se queda cae hasta el fondo y se acumula ahí: la pila del fondo es lo que se escapó.
        if (o.sinPerdidas && a.decidida && !a.queda) { activas.splice(k, 1); continue; }
        const yFondo = o.alto - m.aba - perdidas[a.i] * escalaFondo;
        if (a.decidida && !a.queda && a.y >= yFondo) {
          perdidas[a.i]++;
          deposito.noStroke();
          deposito.fill(colorDe(a.i, false));
          deposito.circle(a.x, yFondo + p.random(-1, 1), tam);
          activas.splice(k, 1);
        }
      }
      terminado = sembradas >= total && activas.length === 0;
    }

    function pintar() {
      p.background(o.fondo);
      p.image(deposito, 0, 0);
      p.noStroke();
      if (o.resaltar !== null && !o.sinGuia) {
        p.stroke(230, 159, 0, 160); p.strokeWeight(Math.max(1, tam * 0.6));
        const xr = xEdad(Math.min(o.resaltar, 90) - 18);
        p.line(xr, m.arr * 0.5, xr, o.alto - m.aba);
        p.noStroke();
      }
      for (const a of activas) {
        p.fill(colorDe(a.i, false));
        p.circle(a.x, a.y, tam);
      }
    }

    p.setup = () => {
      if (o.densidad !== undefined) p.pixelDensity(o.densidad);
      const lienzo = p.createCanvas(o.ancho, o.alto);
      if (o.contenedor) lienzo.parent(o.contenedor);
      p.randomSeed(o.semilla);
      p.noiseSeed(o.semilla);
      colW = (o.ancho - m.izq - m.der) / edades.length;
      let s = 0;
      acumulado = ln.map((v) => (s += v));
      perdidas = edades.map(() => 0);
      // La columna con más pérdidas esperadas ocupa a lo más 22 % del alto.
      const sumaLn = acumulado[acumulado.length - 1];
      const maxPerdidas = d3.max(ln.map((v, i) => (v / sumaLn) * total * (1 - part[i] / 100)));
      escalaFondo = (o.alto * 0.22) / maxPerdidas;
      if (o.quedaSiempre && o.resaltar !== null) {
        const i = o.resaltar - 18;
        const esperadas = (ln[i] / sumaLn) * total;
        escalaPilar = (yEdad(i) - m.arr * 0.6) / Math.max(1, esperadas * 0.9);
      }
      deposito = p.createGraphics(o.ancho, o.alto);
      if (o.densidad !== undefined) deposito.pixelDensity(o.densidad);
      if (!o.animar) {
        let guarda = 0;
        while (!terminado && guarda++ < 5000) paso();
        pintar();
        p.noLoop();
        if (o.alTerminar) o.alTerminar(lienzo.elt);
      }
    };

    p.draw = () => {
      if (!o.animar) return;
      paso();
      pintar();
      if (terminado) { p.noLoop(); if (o.alTerminar) o.alTerminar(); }
    };
  });
}
