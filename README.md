<img width="515" height="187" alt="image" src="https://github.com/user-attachments/assets/88b87456-ed35-41d3-8edd-a89373152170" />


# E-DATA

E-DATA simula el consumo eléctrico de una casa durante un día, calcula cuánto cuesta en pesos colombianos y encuentra los
**dispositivos vampiro**: los que siguen gastando energía en *standby* aunque nadie los use. Al final muestra cuánto se
ahorraría al mes y al año desconectándolos, y un asistente de IA que corre en el propio computador da recomendaciones.

Proyecto del curso de Ingeniería de Inteligencia Artificial, Escuela Colombiana de Ingeniería Julio Garavito (2026).

## Qué se puede hacer

- **Modelar la casa:** hasta 6 habitaciones (sala, cocina, habitación, baño, estudio, zona de ropa, exterior...).
  Cada una se amuebla sola según su nombre.
- **Agregar dispositivos** desde un catálogo de **86 equipos** en 7 zonas, cada uno con foto real, marcas, consumo en uso,
  consumo en reposo y uso típico al día. Se puede buscar sin tildes y filtrar por zona.
- **Ver la casa en vista isométrica**, con muebles y los 86 dispositivos dibujados en pixel art. Un avatar camina por la
  casa (teclado o clic), y la vista tiene zoom y se puede arrastrar. El brillo de cada aparato indica si quedó enchufado en reposo.
- **Simular un día en 2 minutos**, con reloj de sol y luna, ciclo día/noche y contadores de kWh y pesos en tiempo real.
- **Ver los resultados:** ahorro al mes y al año, consumo y costo del día, y el ranking de vampiros de mayor a menor.
  El panel aparece al terminar el día simulado, sin esperar a la IA.
- **Leer el análisis de la IA** (Gemma, ejecutada en local con LM Studio): un párrafo con recomendaciones basado en las
  cifras ya calculadas. Ningún dato de la casa sale del computador.

## Cómo calcula

El cálculo lo hace Python (`BACKEND/main.py`); la IA solo lo explica, así que nunca inventa cifras.

| Concepto | Fórmula |
|---|---|
| Energía en uso | `W activos × horas de uso / 1000` (kWh) |
| Energía en reposo | `W standby × (24 − horas de uso) / 1000`, solo si el aparato se deja enchufado |
| Costo del día | `kWh totales × tarifa` (875,04 COP/kWh por defecto) |
| Vampiro | Dispositivo enchufado, fácil de desconectar y con consumo en reposo mayor que 0 |
| Ahorro al mes | `kWh en reposo de los vampiros × 30 días × tarifa` |

- **Ranking:** los vampiros se ordenan con un *max-heap* (`heapq` de Python guardando los vatios en negativo).
- **Horas de uso por tipo:** los equipos cíclicos (nevera, congelador) cuentan el 30 % del día, y los continuos (router,
  decodificador) las 24 h.

## Estructura

```
E-DATAREPO/
├── BACKEND/
│   ├── main.py               API con FastAPI: /api/simular (cálculo) y /api/ia (puente a LM Studio)
│   ├── test_simulacion.py    pruebas del motor de cálculo
│   └── test_catalogo.py      pruebas de integridad del catálogo, fotos y dibujos
├── FRONTEND/                 HTML, CSS y JavaScript sin frameworks ni compilación
│   ├── index.html            estructura de la página
│   ├── styles.css            todo el estilo (colores y espacios en variables de :root)
│   ├── catalogo.js           los 86 dispositivos
│   ├── casa2d.js             casa isométrica, muebles, dispositivos y avatar
│   ├── app.js                estado, formularios, simulación y panel de resultados
│   ├── portada.js            pantalla de entrada
│   ├── Imagenes electrodomesticos/   fotos reales del catálogo
│   └── assets/               pixel art de la casa (suelo, paredes, muebles, avatar, dispositivos)
└── docs/                     paper (E-DATA_PAPER.pdf), diagrama general y documentación de pruebas
```

## Cómo ejecutarlo

**Requisitos:** Python, LM Studio con gemma 4 e4b para el análisis de la IA.

1. **Instalar las dependencias del backend** (una sola vez):
   ```
   pip install fastapi uvicorn pydantic openai httpx
   ```
   `httpx` solo lo usan las pruebas del endpoint.

2. **Encender el backend** (terminal 1):
   ```
   cd BACKEND
   python -m uvicorn main:app --port 8000
   ```
   La documentación de la API queda en http://127.0.0.1:8000/docs.

3. **Servir el frontend** (terminal 2, desde la raíz del proyecto):
   ```
   python -m http.server 5500 --directory FRONTEND
   ```
   Luego abrir http://127.0.0.1:5500.

4. **(Opcional) Encender la IA:** en LM Studio, cargar el modelo Gemma e iniciar el servidor local en el puerto **1234**.
   Sin la IA, la simulación y el panel de resultados funcionan igual; solo el chat mostrará que no pudo conectarse.

### Uso rápido

1. Arrastra la portada hacia arriba (también sirve la rueda del mouse, Enter o clic en las flechas).
2. **Modelar casa:** agrega o quita habitaciones.
3. **Agregar dispositivos:** elige un equipo, ajusta los minutos de uso y si queda enchufado, y pulsa *Instalar en la casa*.
4. **Simular día:** espera los 2 minutos y abre el **Panel de resultados**. Cuando la IA termine, el botón cambia a **Ver análisis**.

| Control de la casa | Acción |
|---|---|
| Clic en el suelo / flechas o WASD | Caminar |
| Arrastrar | Mover la vista |
| Rueda o `+` / `−` | Acercar o alejar |
| `0` o clic en el porcentaje | Ver toda la casa |
| Clic en el nombre de una habitación | Acercarse a ella |

## Pruebas

```
cd BACKEND
python -m unittest -v
```

Son 38 pruebas que usan `unittest`, incluido en Python, y tardan menos de un segundo. No necesitan el servidor encendido y
nunca llaman a la IA.

- **`test_simulacion.py`:**
  - consumo en uso y en reposo, costo y redondeo;
  - ranking de vampiros y ahorro mensual, incluida una prueba de regresión;
  - un caso completo resuelto a mano;
  - el texto que recibe la IA y la validación de datos (respuestas 200 y 422).
- **`test_catalogo.py`:** que los 86 dispositivos tengan ids seguidos y que cada foto y cada dibujo existan con el nombre
  exacto. Las mayúsculas importan en Linux y GitHub Pages.

El ejercicio de kWh resuelto paso a paso y la tabla de casos de prueba están en [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

## Tecnologías

- **Backend:** Python, FastAPI, Pydantic (valida los datos que llegan) y el cliente de OpenAI apuntando a LM Studio.
- **Frontend:** HTML, CSS y JavaScript sin frameworks; tipografías Instrument Serif y Hanken Grotesk.
- **IA:** Gemma 4 E4B ejecutada en local con LM Studio.

## Autores

- Daniel Felipe Cárdenas Romero
- Jerónimo Urrego
- Andrés Rubio
