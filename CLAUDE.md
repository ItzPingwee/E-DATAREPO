# E-DATA — Sistema de ahorro energético (consumo vampiro / standby)

Proyecto universitario (Ing. de IA, 3er semestre). Simula el consumo de una casa, calcula el costo en COP,
rankea dispositivos "vampiro" en standby y un asistente de IA local da recomendaciones.

## Stack y estructura
- **BACKEND/main.py**: FastAPI. `POST /api/simular` (kWh, costo COP, ranking de vampiros con max-heap)
  y `POST /api/ia` (proxy a LM Studio en `localhost:1234`, modelo Gemma).
- **FRONTEND/**: HTML + CSS + JS vanilla, SIN frameworks ni build. Habla con `http://127.0.0.1:8000`.
  Orden de carga en `index.html` (importa): `catalogo.js` (datos) → `casa2d.js` (dibujo) → `app.js` (lógica y backend).
  - `index.html`: estructura. `styles.css`: todo el estilo, con variables en `:root`.
  - `catalogo.js`: el catálogo y `CARPETA_IMAGENES`. `app.js`: estado, overlays, catálogo, simulación, reloj.
  - `casa2d.js`: la casa isométrica (suelo, paredes, muebles, avatar, pines de dispositivos, ficha al pasar el mouse).
- **FRONTEND/assets/**: sprites pixel art. `base_casa/` (baldosas, paredes, muebles), `avatars/` (Jero en 6 poses),
  `dispositivos/` (los dibujos de los dispositivos en la casa: 16 antiguos y ~90 nuevos `<nombre>_u.png` / `<nombre>_v.png`).
  **Los nuevos salen de láminas generadas con IA** (guardadas en `FRONTEND/assets con fondo/`, fondo morado y varios objetos por imagen): se les quitó el
  fondo (relleno desde el borde, tolerancia de color), se separó cada pieza, se rellenaron huecos, se quitó 1 px del borde y la sombra morada del suelo, y se
  recortó al borde (por eso `caja` = todo el PNG). `_u` = su frente mira a +u, `_v` = mira a +v; si solo hay uno, el motor lo refleja. Se descartó lo que ya
  existía (freidora = air fryer, tostadora, ventilador), lo mal dibujado (la "heladera" salió como un cilindro y la "persiana/cerradura/motor de garaje" de la
  primera lámina estaban cruzados) y lo que no está en el catálogo (afeitadora). Al regenerar una lámina: pide el fondo morado liso, objetos separados
  y sin texto pegado. La lámina "Electrónica" en alta resolución salió corrupta; se usó su captura.
- **Logo de E-DATA:** `FRONTEND/logo.png` es la lámina de diseño original (referencia, no se carga en la app). Wordmark "E-DATA" en Instrument Serif con
  una hoja verde `#86d36c` como guion; lema "Energía en datos · cada watt cuenta". En la app es **texto + SVG en línea** (`h1.titulo-vista` con
  `.logo-letras` y `.logo-hoja`), no una imagen, para que quede nítido y use la misma fuente. `favicon.png` (64 px) es el monograma E + hoja recortado de la lámina.
- **Distribución de la pantalla:** logo arriba, centrado a mitad de camino entre el tope y la ventana de la casa (`top: calc((50% - var(--alto-ventana)/2)/2)`;
  `--alto-ventana` en `:root` la comparten el logo y la ventana). El dock va **pegado al borde izquierdo de la ventana** (`right: min(50% + --ancho-escena/2 + 16px, ...)`;
  `--ancho-escena` y `--ancho-dock` en `:root`), no al borde de la pantalla: en monitores anchos así se lee como un solo grupo con la casa. Se descartó
  ponerlo arriba (choca con el logo y el reloj) o abajo (choca con los contadores). Pasos en orden: **Modelar casa → Agregar dispositivos →
  Mis dispositivos** (esta última es el inventario por habitación con su estado; la casa ya se ve siempre, por eso no se llama "ver mi casa").
  Abajo a la derecha, un botón en píldora con **texto**: "Simular día" → "Calculando…" → "Ver análisis" (`ponerEstadoBotonIA`, único sitio que cambia el
  estado). Ese botón simula Y llama a la IA; es la acción principal, no un adorno. Los contadores de la simulación se compactan con `max-height: 800px`
  para no tapar la casa. Para probar con la IA sin llamarla, muestra reloj y contadores a mano en una página temporal.
- **FRONTEND/Imagenes electrodomesticos/**: fotos reales de los dispositivos, solo para el catálogo.
  `casa_edata-Photoroom.png` ya no se usa.

## Catálogo (`catalogo.js`)
- 86 dispositivos en `catalogoExcel`. Campos: `id` (consecutivo desde 0), `zona`, `nombre`, `marcas`, `watts_activos`,
  `watts_standby`, `tipo` (`variable` | `ciclo` | `continuo`), `desconectable`, `icono` (emoji de respaldo) e `imagen` (foto).
- `minutos_tipicos`: solo en tipo `variable`. Son **estimaciones propias**, no de una fuente; el formulario las propone al elegir.
- `fuente` + `nota_fuente`: opcionales. **Todo dato nuevo debe traer fuente verificable**: leer la página original
  (no solo el resumen del buscador) y guardar el enlace. Hoy solo las bombillas (ids 83–85) la tienen.
- Foto real (catálogo) y sprite pixel art (casa) son **dos imágenes distintas** por dispositivo. Sin foto → se muestra el emoji.
- Las fotos se piden con `encodeURI` porque hay nombres con espacios y ñ. En `ciclo` se usa el 30 % del día; `continuo` son 24 h.
- `montaje` (79 de 86 dispositivos): cómo se ve en la casa. `'mueble'` (4) = el dibujo de la decoración ES el dispositivo (nevera 0, estufa 23,
  TV 5, PC 11); `'superficie'` (46) = se apoya sobre un mueble (electrodomésticos pequeños, cosas de baño, monitor, decodificador...);
  `'suelo'` (26) = de pie en una celda (lavadora, congelador, AC portátil, herramientas de exterior...); `'pared'` (3) = cuelga de una pared trasera
  (AC split, cámara, campana sobre la estufa). `sprite` = clave en la tabla `MUEBLES` de casa2d.js (varios dispositivos pueden compartir dibujo:
  la freidora de aceite usa el del air-fryer). `sobre: ["cama"]` (opcional) = solo puede ir sobre ese mueble (la manta térmica).
  **Sin dibujo (pin con emoji), 7:** calentador de agua, persianas, motor de garaje, cerraduras smart y las 3 bombillas. Al instalar se guarda el `id`.

## Casa isométrica (`casa2d.js`)
- Rejilla 2:1 con `aPantalla(u,v)` / `aCelda` (inversa, para clics). Habitaciones de 4×4 celdas, **máximo 6** (`MAX_HABITACIONES`);
  la casa crece con las habitaciones. Entre habitaciones hay **paredes interiores**: las mismas piezas de las exteriores pero casi
  transparentes (`.pared-interior`, opacity 0.28), con puerta de 2 celdas; las paredes bloquean el paso.
- **Paredes exteriores de dos pisos** (`PISOS_PAREDES_EXTERIORES`): se apila otra pieza encima, desplazada `ALTURA_PARED_PX` (52.5 px, la altura
  vertical real de la pieza, medida en el PNG) menos `SOLAPE_PISOS`. Las interiores siguen de un piso. Si cambias de piso, ajusta `ESPACIO_SOBRE_SUELO`.
- **Vista (ventana, zoom y arrastre):** la casa vive en `.ventana-casa` (vidrio oscuro, `overflow: clip`) y `#casa-mundo` se mueve con una
  transformación CSS: `escalaVista = escalaAjuste × vista.zoom` más `vista.panX/panY`. Rueda = zoom hacia el cursor (0.7×–4×), arrastrar = mover
  (menos de 5 px sigue siendo un clic para caminar; `ignorarSiguienteClic` evita que soltar un arrastre haga caminar al avatar), teclas `+` `-` `0`,
  controles discretos `−  100 %  +` (el número vuelve a ver toda la casa), clic en un cartel = acercar a esa habitación (otro clic = volver), y la vista
  sigue al avatar si camina hacia el borde estando acercada. Si cambia la cantidad de habitaciones, la vista vuelve a "ver toda la casa".
  `limitarVista` impide perder la casa. Usa siempre `escalaVista` para convertir clics a celdas.
  **La rueda no manda la misma unidad en todos los navegadores** (Chrome: píxeles, 100 por muesca; Firefox: líneas, 3 por muesca; trackpad: pellizco con Ctrl):
  `pixelesDeRueda` las unifica. Antes se usaba `deltaY` crudo y en Firefox el zoom casi no se notaba. Prueba siempre con `deltaMode` 0 y 1.
- **Los PNG se miden antes de colocarlos** (caja útil, pendiente real de la base, punto de contacto). Los dibujos no son exactamente 2:1
  y si no se corrigen se ven "escalera" y paredes desalineadas.
- **Muebles: la escala vertical NUNCA se estira para alcanzar una altura real.** `escalasDeMueble` deja sus bordes con pendiente exacta
  0.5 (`sy = sx · 0.5 / pendiente del dibujo`); si se estira más, sus diagonales dejan de ser paralelas a las de la pared y se nota.
  La altura sale del propio dibujo; para que no se vea chato cada sprite lleva `k` (1.0–1.3) que agranda su huella.
- **Escala del mundo:** 1 celda = 1.3 m (`METROS_POR_CELDA`) y el avatar de 79 px es una persona de 1.7 m. Cada mueble trae
  `medidas: [largo en u, largo en v]` en metros (su huella). Los dibujos no respetan medidas reales: mide la proporción de la huella
  (el punto más alto de la silueta cae en `dv/(du+dv)` del ancho) y pon unas `medidas` que la respeten, o se deforma.
- **Orientación:** un sprite mira hacia +u (abajo-derecha, va contra la pared trasera izquierda, x=0) o hacia +v (abajo-izquierda,
  pared trasera derecha, y=0). **Mira el dibujo, no el nombre:** en `base_casa/` el sufijo `_der`/`_izq` falla (nevera, lavamanos, sofá,
  tina); en `dispositivos/` los `_der`/`_izq` sí coinciden (der = +u). Para saber el frente: puertas, pantalla, espejo (su borde de arriba
  baja a la derecha si está en la pared y=0). Si solo hay un lado se usa `espejo`. Tabla `MUEBLES` = qué sprite para cada lado.
- **Distribución:** `PLANTILLAS` por tipo de habitación (cocina, sala, habitacion, estudio, bano; por el nombre) en orden de prioridad.
  `distribuirMuebles` los reparte por las paredes y, si la pared trasera tiene vecina, solo usa 2 celdas para dejar libre la puerta
  (lo que no cabe se omite). Las plantillas admiten `opciones` (grupos del más completo al más sencillo: mesita+cama+mesita, o solo cama).
  `posicionDePuerta` elige la puerta donde no haya muebles. Los muebles libres deben quedar dentro de 1 a 3 celdas para no tapar puertas.
  **Regresión obligatoria al tocar muebles o dispositivos:** todas las permutaciones de 4 habitaciones (+ casas de 3, 5 y 6) con 4 dispositivos
  de suelo por habitación; ninguna celda libre debe quedar inalcanzable (BFS desde el avatar).
- Orden de dibujo por `z-index` (algoritmo del pintor): suelo 0, pared (cx+cy)·10+1, mueble +3, pin y dispositivo +4, avatar +5.
  Los carteles de habitación van encima de todo (z-index 9000) porque con la casa llena los muebles los taparían, y son botones (clic = acercar).
- Los sprites de la sala vienen en hojas con varias piezas: se recortaron a `assets/base_casa/recortes/` (sofa, sillon, mesa_centro).
- **Dispositivos en la casa** (`dibujarDispositivos`), en este orden: 1) mueble = dispositivo (`DISPOSITIVO_DE_MUEBLE`); 2) sobre un
  mueble con `superficie` (puntos en fracciones de su huella y `fraccion` de su altura; `exclusiva: true` en la cama: solo lo que pida `sobre`);
  3) de pared (`sitiosEnPared`/`colocarEnPared`: prefiere paredes sin vecina, salta las puertas; el dibujo lleva `altura` en px sobre el suelo; la campana
  cuelga `alturaCuerpo + 24` sobre la estufa); 4) de suelo, en una celda junto a la pared que no toque muebles ni puertas y que pase `sePuedeBloquear`
  (no corta ningún paso); 5) pin con emoji si no hay dibujo o sitio. Sitios de superficie hoy: cocina 6 (mesón 3, lavaplatos 1, mesa 2), sala 3 (TV 2, mesa
  de centro), habitación 3 (mesitas y cómoda) + cama (manta), baño 3 (2 lavamanos y tanque del inodoro). Las habitaciones sin muebles (zona de ropa,
  exterior) solo muestran dispositivos de suelo: lo de superficie sale como pin hasta que haya una mesa (assets pendientes del equipo).
  Los pequeños se dibujan más grandes que lo real (`ancho` en px: ~(largo+ancho en m)·37 px, con mínimo ~14-16). El brillo ámbar/azul indica reposo/desconectado.
- **Baño (4×4, es grande):** no se puede achicar solo ese cuarto: todas las habitaciones viven en una rejilla de 4×4 y una más pequeña dejaría un hueco
  que rompe la adyacencia y las puertas con las vecinas. Se reparte mejor: lavamanos doble con el inodoro en medio, dos duchas y tina exenta al centro.
  Una ducha (2 m) tapa lo que tiene detrás: la fila de sanitarios empieza más adelante (`desde`).
- **El mouse de un dispositivo lo recibe una `.zona-dispositivo` transparente**, no la `<img>`: una `<img>` responde en todo su cuadro
  (también en lo transparente) y taparía a sus vecinos; `clip-path` no sirve porque recorta el brillo.
- Avatar: flechas/WASD y clic (búsqueda de camino BFS), velocidad 3.5 celdas/s; se bloquea al escribir o con un overlay abierto.

## Frontend: decisiones que se mantienen
- Simulación de un día de 24 h en 2 minutos (`DURACION_SIMULACION_MS`). Reloj de sol y luna, contadores y ciclo día/noche la usan.
- Al elegir un dispositivo o zona, la habitación de destino se sincroniza (`sincronizarHabitacionConZona` + `normalizarTexto`, sin tildes).
- El backend ignora campos extra como `icono` e `id` (verificado con `/api/simular`).

## Hoja de ruta
- V1 archivos separados ✔ · V2 sistema de diseño ✔ · V3 catálogo con fotos ✔ y **panel de resultados pendiente**
  (resumen kWh/costo y ranking de vampiros con barras y habitación, usando solo lo que devuelve el backend:
  `consumo_total_kwh`, `costo_simulado_cop`, `ranking_vampiros`).
- V4 casa isométrica con avatar (en curso): faltan muebles (sofá, cama, ducha, lavamanos, escritorio de habitación).
- V5 pulido: sprites de dispositivos en la casa ✔ (79 de 86); faltan los de zona de ropa (mesa para lo de superficie), dibujos para los 7 que no
  tienen, y detalles del avatar.

## Reglas de trabajo
- **Responde en español, tono didáctico**: explica brevemente el *porqué* de cada decisión (el usuario es estudiante y quiere aprender).
- Código y comentarios en español, como el resto del proyecto. Mantener JS/CSS vanilla.
- **La IA local la corre el usuario** (es lenta). NUNCA llames a `/api/ia` ni a LM Studio, ni lo inicies, ni lo mockees
  sin que lo pida. Para probar el front usa solo `/api/simular` (no depende de IA) o datos de ejemplo.
- Pruebas visuales: servir el frontend con `python -m http.server 5500 --directory FRONTEND` y el backend con
  `python -m uvicorn main:app --port 8000` desde `BACKEND/`. Pregunta antes de dejar servidores corriendo.
- Con Playwright: guarda las capturas dentro de `.playwright-mcp/` y bórralas al terminar. Para ver cambios usa una recarga
  forzada (`fetch(archivo,{cache:'reload'})` y luego `location.reload()`, o Ctrl+Shift+R en el navegador).
- No cambies la lógica del backend (fórmulas de consumo/costo) salvo petición explícita.
- Antes de editar, lee el archivo; cambios pequeños y revisables. No añadas dependencias sin consultar.
- Si una página bloquea la lectura automática, no la esquives (por ejemplo cambiando el User-Agent): usa otra fuente o pide el dato al usuario.

## Calidad de código (el usuario debe poder explicarlo en una sustentación)
- Código limpio, simple y explicable. **Evita temas avanzados**, sobre todo en el backend (nada de metaclases,
  decoradores personalizados, async complejo, patrones exóticos, one-liners crípticos). Prefiere funciones pequeñas,
  nombres descriptivos y comentarios que expliquen el *porqué*.
- Si usas un concepto no trivial (p. ej. max-heap, CORS, Pydantic), acompáñalo de una explicación corta.

## Diseño (identidad visual)
- **Nada genérico**: prohibido el look "plantilla" (gradientes morados, tarjetas idénticas, emojis como único recurso visual,
  fuentes por defecto). Debe tener identidad propia de E-DATA: paleta, tipografía y detalles pensados.
- Fusión **eco + elegante en modo oscuro**: fondos oscuros profundos (verde-negro/pizarra), acentos verde esmeralda/lima
  suave, detalles cálidos (ámbar) para alertas de vampiros. Tipografía limpia (Instrument Serif para títulos, Hanken Grotesk
  para interfaz y números), tarjetas con vidrio líquido sutil.
- Definir colores y espaciados como **variables CSS** (`:root`), nunca valores sueltos repetidos.
- La app es **de escritorio (PC)**: no hace falta diseñar interacciones táctiles; el responsive solo evita que se rompa.
- Accesible (contraste suficiente, estados hover/focus visibles).
- Fallback a emoji del catálogo si un dispositivo no tiene foto o sprite.

## Git (lo maneja el usuario)
- **No hagas commit, push ni cambies de rama** salvo petición explícita. Por cada gran avance el usuario crea una rama nueva.
- Cuando el usuario diga que una versión terminó: compara la rama base con la última, y propón **nombre de rama, mensaje de commit
  y descripción** siguiendo *Conventional Commits* (`feat(frontend): ...`, `fix(backend): ...`, `refactor`, `style`, `docs`),
  con una descripción clara y detallada de lo agregado/arreglado. Mensajes en español. Ramas en camelCase sin tildes.
- Terminar commits con la línea Co-Authored-By indicada por la herramienta.
