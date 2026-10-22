# El hoyo

Micrositio de la propuesta "El hoyo" para el concurso *Hackea la participación: datos que construyen democracia* (INE, Reto 3: Storytelling con datos). No es un sitio oficial del INE.

Sitio estático.

- **Sitio publicado:** https://sergiouaq.github.io/el-hoyo/ (GitHub Pages desde la rama `main`).
- **Datos:** `datos.js` se genera a partir de los Conteos Censales de Participación Ciudadana 2009–2024 (datos abiertos del INE): participación = votaron ÷ (votaron + no votaron), sin registros no especificados ni edades mayores de 100 años.

| Archivo | Qué contiene |
|---|---|
| `index.html` | La historia: 13 secciones del storyboard |
| `estilos.css` | Colores, tipografía y layout |
| `app.js` | Gráficas en D3 e interacción |
| `sedimento.js` | Arte generativo en p5.js con semilla |
| `datos.js` | Datos agregados de los Conteos Censales (16 KB) |
