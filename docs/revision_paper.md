# Revisión del paper E-DATA contra el proyecto

Sirve como soporte para la sustentación: dónde se demuestra cada requisito y qué se cambió respecto al PDF original.
Para las pruebas no se modificó nada del proyecto ni se llamó a la IA. El backend se probó importando `main.py` en
Python (con el cliente de pruebas de FastAPI, solo `/api/simular`) y el frontend se abrió servido en local.

## Qué se cambió y por qué

| Sección | Cambio | Motivo |
|---|---|---|
| 4 Diseño | Nueva descripción de las 3 capas | Antes no mencionaba el catálogo, la casa isométrica ni el panel de resultados |
| 4.1 REQF | 20 requisitos reescritos | Varios no se podían demostrar o no existen en el código (ver tabla abajo) |
| 4.2 REQNF | 14 requisitos reescritos | 250 tokens → el código usa 1500; "<100 ms" ahora está medido; "cero conexiones externas" era falso (Google Fonts); los colores #1a1a24/rojo/púrpura ya no son la paleta |
| 4.3 Complejidad | Min-Heap → max-heap con `heapq` y vatios negados; costo total O(n + v log v); ecuación del ahorro; tabla de tiempos medidos | El paper decía Min-Heap, pero la cima es la mayor fuga. Faltaba la ecuación del ahorro |
| 4.4 Diagrama | Figura nueva (`diagrama-general.png`), sin CREG | Solo muestra lo que existe en el código |
| 4.5 Casos de uso | Tabla 4 → 5 historias de usuario con criterios Dado/Cuando/Entonces | Pedido del equipo |
| 5 KPIs | Se quitaron los de la CREG; 5 de negocio y 7 técnicos con fórmula, meta y valor medido | La CREG ya no está en el alcance |
| 9 Conclusiones | Reescritas sin CREG ni afirmaciones no medidas ("supera las latencias de la nube") | Que todo lo afirmado se pueda demostrar |
| Agradecimientos | Familias, profesor Edward Francia y monitora Valeria Pachón | Pedido del equipo |
| 4.1 REQF-07 y 5 KPIs (18-nov) | 79 → 86 de 86 dispositivos con dibujo | Se agregaron los 7 dibujos que faltaban |
| 6 Pruebas (18-nov) | Horas de uso del caso; nueva subsección 6.2 "Pruebas Automáticas" (38 pruebas, `unittest`) | Que el caso se pueda reproducir y mostrar las pruebas |
| 7 Resultados (18-nov) | 4.14 kWh, \$3,623/día, \$108,680/mes, ahorro \$6,358 (\$76,296/año); la cita de la IA lleva las mismas cifras del motor (\$108,680 y \$6,358) | Cifras del código actual, comprobadas a mano y por `PruebaCasoDelPaper` |
| 8 Análisis (18-nov) | 8 → 7.3 kWh/mes | Mismo cálculo con las horas de reposo |
| Biografías (18-nov) | Se quitó el `\newpage` antes de las biografías | Con la subsección nueva las mandaba solas a una página 9; ahora van bajo las referencias y el paper sigue en 8 páginas |

Sin cambios: resumen, introducción, justificación, estado del arte, límites y referencias. Las secciones 6 y 7 conservan
el formato numérico que ya tenían (punto decimal y coma de miles, como "875.04" y "\$2,000").

## Evidencia de cada requisito funcional

| ID | Dónde se ve en el código |
|---|---|
| REQF-01 | `agregarHabitacion` (app.js): nombre repetido y `MAX_HABITACIONES = 6` (casa2d.js) |
| REQF-02 | `catalogoExcel` (catalogo.js): 86 equipos, 86 con foto; `reemplazarPorEmoji` (app.js) |
| REQF-03 | `filtrarCatalogo` + `normalizarTexto` (app.js) |
| REQF-04 | `sincronizarHabitacionConZona` (app.js) |
| REQF-05 | `actualizarFormularioUI` e `instalarDispositivo` (app.js): variable / ciclo 24·0,30 / continuo 24 |
| REQF-06 | `renderizarListaAgregadosEnCatalogo`, `eliminarDispositivo` → `ponerEstadoBotonIA('IDLE')` |
| REQF-07 | `dibujarCasaIsometrica`, `dibujarDispositivos` (casa2d.js); 79 de 86 con `montaje` |
| REQF-08 | `buscarCamino` (BFS), `ZOOM_MINIMO = 0.7`, `ZOOM_MAXIMO = 4` (casa2d.js) |
| REQF-09 | Modelos Pydantic (main.py). Probado: tipo erróneo → 422; campos faltantes → 422 |
| REQF-10 | `SimulacionRequest → Habitacion → Dispositivo` (main.py), doble `for` que visita cada dispositivo una vez |
| REQF-11/12 | `simular_consumo`, pasos 1 y 2 (main.py). Probado: equipo desconectado → no suma reposo ni entra al ranking |
| REQF-13 | `costo_total_cop`, `costo_mensual_proyectado` (main.py); `res-costo-mes` (app.js) |
| REQF-14 | `heapq.heappush(max_heap, (-watts_standby, ...))` (main.py). Probado: 200 equipos aleatorios → orden 100 % correcto |
| REQF-15 | `ahorro_mensual_potencial` (main.py); `ahorroAnio = ahorroMes * 12` (app.js) |
| REQF-16 | `prompt_ia` (main.py) |
| REQF-17 | `consultar_ia` (main.py): `base_url="http://localhost:1234/v1"`, rol "AI Analyst de E-DATA" (solo revisado en código, no ejecutado) |
| REQF-18 | `DURACION_SIMULACION_MS = 120000`, `animarContadoresTiempoReal`, `actualizarCielo` (app.js) |
| REQF-19 | `dibujarPanelResultados` y su callback en `ejecutarMotorTotal` (app.js) |
| REQF-20 | `ponerEstadoBotonIA`, `TEXTO_BOTON_IA` (app.js) |

## Mediciones (equipo de desarrollo, 17-nov-2026)

- `/api/simular`, 60 dispositivos, 50 peticiones: mediana 10,5 ms, p95 11,2 ms.
- Función de simulación: 10 → 0,05 ms · 100 → 0,32 · 1.000 → 3,25 · 10.000 → 37,9 · 100.000 → 559,9 ms.
- Interfaz en local: DOMContentLoaded 78 ms, carga completa 386 ms (175 recursos). Hosts externos: solo
  `fonts.googleapis.com` y `fonts.gstatic.com` (tipografías, sin datos del usuario).

## Decisiones del equipo

- **La CREG se mantiene** en el paper como contexto (resumen, introducción, justificación, estado del arte, análisis).
  La conclusión aclara que el sistema todavía no calcula sus metas ni sus recargos.
- **Se quitaron las frases que decían que el proyecto implementa la CREG** (no lo hace):
  - Estado del arte 3.2-1: "E-DATA integra directamente esta lógica matemática en su motor de simulación" → la norma es el
    contexto; el motor estima consumo, costo y ahorro, pero no calcula metas ni recargos.
  - Resumen: "simulaciones financieras basadas en los marcos tarifarios vigentes (CREG)" → "con una tarifa de referencia del
    mercado colombiano, en el contexto de la Resolución CREG"; "garantizando el cumplimiento de las normativas" → "contribuyendo
    a cumplir las metas de ahorro".
  - Justificación 2.3: la app no muestra "las penalizaciones de la CREG" → "en un contexto en el que la CREG ya penaliza los excesos".
  - Pruebas 6.1: "presupuesto diario CREG" → "presupuesto diario de referencia" (es un valor fijo del backend, `presupuesto_diario = 2000`).

## Maquetación (compilado con MiKTeX)

- Las tres tablas de requisitos van juntas en una página (4). El diagrama general (4.3) va antes de la complejidad, y un
  salto de página antes de 4.4 hace que la página de tablas caiga entre dos subsecciones: ninguna sección queda partida.
- La figura sale arriba de la página 5; la complejidad (4.4) va entera debajo, seguida de las historias de usuario.
- "Cuadro" → "Tabla" (`es-tabla`), ecuaciones dentro de la columna, biografías juntas en la última página.
- Si se agrega o quita texto antes de la sección 4.4, hay que volver a mirar la página 3: el salto `\newpage` está pensado
  para que esa página termine justo con el diagrama general.
- **"Min-Heap" → "Max-Heap"** en resumen, palabras clave, estado del arte 3.1-3 y resultados. La única "min-heap" que queda
  es la explicación de que `heapq` de Python es un min-heap y por eso se guardan los vatios negados.

## Verificación del ahorro de los resultados ($6.930)

Se reprodujo el caso de la sección 6 con las dos versiones del backend que hay en git:

- **Versión "Base version" (6774818, 20-oct-2026)**, con la que se midió el paper:
  `ahorro += (watts * 24 / 1000) * 30 * tarifa`. Siempre da **$6.930** (11 W × 24 h × 30 × 875,04 / 1000 = 6.930,3),
  sin importar cuántas horas se use cada equipo. Por eso el número del paper es exactamente ese.
- **Versión actual (0b7b644, 9-nov-2026)**: el ahorro es el reposo que el equipo ya sumó al consumo, es decir, solo
  las horas en que **no** se usa: `watts × (24 − horas_uso)`. La versión vieja contaba también como "reposo" las horas en que
  el televisor estaba encendido, así que el ahorro salía inflado.
- **El consumo y el costo no cambiaron** entre versiones: los $3.612/día, la proyección de $108.378/mes y el orden
  del ranking (TV 5 W, Microondas 4 W, Air-fryer 2 W) siguen siendo válidos con el código actual.
- El paper no dice cuántas horas se usó cada equipo, así que no se puede reproducir el número exacto. Para **cualquier**
  combinación de horas que dé $3.612/día, el código actual da un ahorro entre **$5.130 y $6.873**, nunca $6.930.
  Con usos típicos del catálogo (TV ≈ 4 h, microondas 10 min, air-fryer ≈ 33 min) da **≈ $6.364**.
- Consecuencia: el "8 kWh/mes" del análisis (11 W × 24 h × 30 = 7,9 kWh) también usa las 24 h; con el código actual sería
  ≈ 7,3 kWh/mes con esos usos típicos.

**Corregido el 18-nov-2026:** el caso ahora escribe sus horas (TV 4 h, microondas 12 min, air-fryer 30 min, refrigerador
7,2 h) y los resultados son los del código actual (ver `PRUEBAS.md`). La cita de la IA lleva las cifras que le entrega el
motor (\$108,680 al mes y \$6,358 de ahorro): la IA no calcula, repite los valores que recibe en el prompt (REQNF-07).

## Otro pendiente

- La introducción dice "backend asíncrono": las funciones de `main.py` son síncronas (`def`, no `async def`).
