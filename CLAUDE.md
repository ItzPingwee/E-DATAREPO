# E-DATA — Sistema de ahorro energético (consumo vampiro / standby)

Proyecto universitario (Ing. de IA, 3er semestre). Simula el consumo de una casa, calcula el costo en COP,
rankea dispositivos "vampiro" en standby y un asistente de IA local da recomendaciones.

## Stack y estructura
- **BACKEND/main.py**: FastAPI. `POST /api/simular` (kWh, costo COP, ranking de vampiros con max-heap)
  y `POST /api/ia` (proxy a LM Studio en `localhost:1234`, modelo Gemma).
- **FRONTEND/**: HTML + CSS + JS vanilla, SIN frameworks ni build. Habla con `http://127.0.0.1:8000`.
- **FRONTEND/assets/**: sprites isométricos (`avatars/`, `base_casa/`, `dispositivos/`) para la simulación 2D.
- Plan de estructura: separar `index.html` en `styles.css`, `catalogo.js`, `app.js`, `casa2d.js`.

## Reglas de trabajo
- **Responde en español, tono didáctico**: explica brevemente el *porqué* de cada decisión (el usuario es estudiante y quiere aprender).
- Código y comentarios en español, como el resto del proyecto. Mantener JS/CSS vanilla.
- **La IA local la corre el usuario** (es lenta). NUNCA llames a `/api/ia` ni a LM Studio, ni lo inicies, ni lo mockees
  sin que lo pida. Para probar el front usa solo `/api/simular` (no depende de IA) o datos de ejemplo.
- Pruebas visuales: servir el frontend con `python -m http.server 5500 --directory FRONTEND` y el backend con
  `python -m uvicorn main:app --port 8000` desde `BACKEND/`. Pregunta antes de dejar servidores corriendo.
- No cambies la lógica del backend (fórmulas de consumo/costo) salvo petición explícita.
- Antes de editar, lee el archivo; cambios pequeños y revisables. No añadas dependencias sin consultar.

## Calidad de código (el usuario debe poder explicarlo en una sustentación)
- Código limpio, simple y explicable. **Evita temas avanzados**, sobre todo en el backend (nada de metaclases,
  decoradores personalizados, async complejo, patrones exóticos, one-liners crípticos). Prefiere funciones pequeñas,
  nombres descriptivos y comentarios que expliquen el *porqué*.
- Si usas un concepto no trivial (p. ej. max-heap, CORS, Pydantic), acompáñalo de una explicación corta.

## Diseño (identidad visual)
- **Nada genérico**: prohibido el look "plantilla" (gradientes morados, tarjetas idénticas, emojis como único recurso visual,
  fuentes por defecto). Debe tener identidad propia de E-DATA: paleta, tipografía y detalles pensados.
- Fusión **eco + elegante en modo oscuro**: fondos oscuros profundos (verde-negro/pizarra), acentos verde esmeralda/lima
  suave, detalles cálidos (ámbar) para alertas de vampiros. Tipografía limpia, tarjetas con bordes sutiles/glass ligero.
- Definir colores y espaciados como **variables CSS** (`:root`), nunca valores sueltos repetidos.
- Responsive y accesible (contraste suficiente, estados hover/focus visibles).
- Simulación de la casa en 2D isométrico con los assets de `FRONTEND/assets/`; fallback a emoji del catálogo si un dispositivo no tiene sprite.

## Git (lo maneja el usuario)
- **No hagas commit, push ni cambies de rama** salvo petición explícita. Por cada gran avance el usuario crea una rama nueva.
- Cuando el usuario diga que una versión terminó: compara la rama base con la última, y propón **nombre de rama, mensaje de commit
  y descripción** siguiendo *Conventional Commits* (`feat(frontend): ...`, `fix(backend): ...`, `refactor`, `style`, `docs`),
  con una descripción clara y detallada de lo agregado/arreglado. Mensajes en español.
- Terminar commits con la línea Co-Authored-By indicada por la herramienta.

## Notas conocidas
- Catálogo (83 dispositivos) hardcodeado en JS; solo 16 tienen sprite.
- Bug menor: id 25 del catálogo usa `type:` en vez de `tipo:`.
- Rama actual al crear este archivo: `redisenoCatalogo`.
