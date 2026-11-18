# Pruebas de E-DATA

Documento de apoyo para la sustentación. Las pruebas **no se ven en la aplicación**: viven en `BACKEND/test_*.py`
y en este documento. `index.html` no carga ni enlaza nada de esto.

## 1. ¿Ejercicio de kWh o `assert`? Las dos cosas

Una prueba tiene dos partes:

1. **El caso de prueba (el "ejercicio")**: unos datos de entrada y el resultado que *debería* salir, calculado a mano.
   Es el oráculo: lo que sabemos que es correcto sin mirar el programa.
2. **La comprobación (el `assert`)**: el programa resuelve el mismo ejercicio y se comparan las dos respuestas.
   Si no coinciden, la prueba falla y dice dónde.

Hacer el ejercicio a mano una vez sirve para entenderlo; escribirlo como `assert` hace que el computador lo
vuelva a revisar en 0,2 segundos **cada vez que se cambie el código**. Por eso aquí están los dos: la sección 3 es el
ejercicio resuelto a mano y la clase `PruebaCasoDelPaper` de `test_simulacion.py` es ese mismo ejercicio automatizado.

## 2. Cómo correrlas

Desde la carpeta `BACKEND/`:

```
python -m unittest -v
```

Se usa `unittest`, que viene con Python (no hay que instalar nada). Las pruebas llaman a la función `simular_consumo`
directamente: **no hace falta encender el servidor y nunca se llama a la IA**.

Resultado obtenido (18-nov-2026, Python 3.14):

```
Ran 38 tests in 0.175s

OK
```

## 3. Ejercicio resuelto a mano: el caso del paper

Es la casa de la sección 6 del paper (cocina y sala), con las horas de uso escritas para que se pueda reproducir.
Tarifa: 875,04 COP/kWh. Presupuesto diario: 2.000 COP.

**Fórmulas** (las mismas de `main.py`):

- Energía en uso: `kWh activo = W activos × horas de uso / 1000`
- Energía en reposo (solo si se deja enchufado): `kWh reposo = W standby × (24 − horas de uso) / 1000`
- Costo del día: `kWh total × tarifa`
- Ahorro al mes: `kWh de reposo de los vampiros × 30 días × tarifa`
  (vampiro = se deja enchufado, es fácil de desconectar y gasta algo en reposo)

| Habitación | Dispositivo | W uso | W reposo | Horas de uso | kWh uso | kWh reposo | ¿Vampiro? |
|---|---|---|---|---|---|---|---|
| Cocina | Refrigerador (cíclico) | 300 | 2,25 | 7,2 (30 % de 24 h) | 300 × 7,2 / 1000 = **2,16** | 2,25 × 16,8 / 1000 = **0,0378** | No (no se puede desconectar) |
| Cocina | Microondas | 1200 | 4 | 0,2 (12 min) | 1200 × 0,2 / 1000 = **0,24** | 4 × 23,8 / 1000 = **0,0952** | Sí |
| Cocina | Air-fryer | 1400 | 2 | 0,5 (30 min) | 1400 × 0,5 / 1000 = **0,70** | 2 × 23,5 / 1000 = **0,047** | Sí |
| Sala | Televisor | 100 | 5 | 4 | 100 × 4 / 1000 = **0,40** | 5 × 20 / 1000 = **0,10** | Sí |
| Sala | Router Wi-Fi (continuo) | 15 | 0 | 24 | 15 × 24 / 1000 = **0,36** | 0 (no tiene horas libres) | No |

**Consumo del día:** 2,16 + 0,0378 + 0,24 + 0,0952 + 0,70 + 0,047 + 0,40 + 0,10 + 0,36 = **4,14 kWh**

**Costo del día:** 4,14 × 875,04 = **3.622,67 COP** → supera el presupuesto de 2.000 COP.

**Costo al mes:** 3.622,67 × 30 = 108.680 COP.

**Reposo de los vampiros:** 0,0952 + 0,047 + 0,10 = 0,2422 kWh al día.

**Ahorro al mes:** 0,2422 × 30 × 875,04 = **6.358,04 COP** (al año: × 12 = 76.296 COP).

**Ranking de vampiros** (max-heap, de mayor a menor vatios en reposo): 1) Televisor 5 W, 2) Microondas 4 W, 3) Air-fryer 2 W.

El programa devolvió exactamente estos valores: `consumo_total_kwh = 4.14`, `costo_simulado_cop = 3622.67`,
`ahorro_mensual_cop = 6358.04` y el mismo ranking.


## 4. Casos de prueba automáticos

### `BACKEND/test_simulacion.py` — motor de cálculo (30 pruebas)

| ID | Qué se prueba | Entrada | Esperado | Resultado |
|---|---|---|---|---|
| C-01 | Casa vacía | Sin habitaciones | 0 kWh, 0 COP, sin vampiros | ✔ |
| C-02 | Uso activo | Router 10 W, 24 h | 0,24 kWh | ✔ |
| C-03 | Reposo solo en horas sin uso | TV 100 W / 5 W, 4 h | 0,4 + 0,1 = 0,5 kWh | ✔ |
| C-04 | Desenchufado no gasta en reposo | TV desenchufado | 0,4 kWh | ✔ |
| C-05 | Suma de habitaciones | TV (sala) + router (estudio) | 0,74 kWh | ✔ |
| P-01 | Costo = kWh × tarifa | TV, 0,5 kWh | 437,52 COP | ✔ |
| P-02 | Otra tarifa | TV, tarifa 1000 | 500 COP | ✔ |
| P-03 | Redondeo | Microondas 0,3352 kWh | 0,34 kWh | ✔ |
| V-01 | Ranking de mayor a menor (max-heap) | 4 aparatos en desorden | Consola, Impresora, Cafetera, Cargador | ✔ |
| V-02 | No desconectable no es vampiro | Nevera | Ranking vacío, sí suma consumo | ✔ |
| V-03 | 0 W en reposo no es vampiro | Licuadora | Ranking vacío | ✔ |
| V-04 | Desenchufado no es vampiro | TV desenchufado | Ranking vacío | ✔ |
| V-05 | Guarda la habitación | TV en dos habitaciones | Aparece dos veces | ✔ |
| A-01 | Ahorro = reposo de vampiros × 30 × tarifa | TV, 0,1 kWh de reposo | 2.625,12 COP | ✔ |
| A-02 | Sin vampiros no hay ahorro | Nevera | 0 COP | ✔ |
| A-03 | **Regresión:** ahorro = lo que baja la factura al desenchufar | TV + consola + nevera | Ahorro = (costo con − costo sin) × 30 | ✔ |
| E-01…05 | Ejercicio del paper (sección 3) | Cocina + sala | 4,14 kWh · 3.622,67 COP · 6.358,04 COP · ranking · "superó" | ✔ |
| T-01…04 | Texto para la IA (sin llamarla) | Varios | "respetó"/"superó", nombres de vampiros, ahorro, "No hay consumo fantasma" | ✔ |
| D-01 | Validación: falta un campo | Dispositivo incompleto | `ValidationError` | ✔ |
| D-02 | Validación: tipo equivocado | `watts_activos = "mucho"` | `ValidationError` | ✔ |
| H-01 | `/api/simular` por HTTP | Datos válidos | 200 y 0,5 kWh | ✔ |
| H-02 | Campos extra del frontend (`id`, `icono`) | Datos + extras | 200 (se ignoran) | ✔ |
| H-03 | Datos inválidos por HTTP | Habitación sin dispositivos | 422 | ✔ |


### `BACKEND/test_catalogo.py` — integridad de los datos del frontend (8 pruebas)

| ID | Qué se prueba | Por qué importa |
|---|---|---|
| K-01 | 86 dispositivos con ids 0 a 85 seguidos | La casa encuentra cada dibujo por su `id` |
| K-02 | Cada foto existe con el nombre **exacto** (mayúsculas incluidas) | Windows no distingue mayúsculas, pero GitHub Pages y Linux sí |
| K-03 | `tipo` es `variable`, `ciclo` o `continuo` | El formulario y las horas dependen del tipo |
| K-04 | `minutos_tipicos` solo en tipo `variable` | Los otros tipos no piden minutos |
| K-05 | Todos tienen `montaje` válido | Sin montaje, el dispositivo sale como un pin con emoji |
| K-06 | Los que no son mueble traen `sprite` | Ídem |
| K-07 | Cada `sprite` del catálogo está en la tabla `MUEBLES` | Si no, la casa no sabe qué dibujo usar |
| K-08 | Cada archivo de dibujo de `SPRITES` existe | Una imagen rota se vería vacía en la casa |

## 5. Pruebas manuales de la interfaz

Se hicieron en el navegador, con el frontend servido en local y **sin llamar a la IA**.

| ID | Dado / Cuando / Entonces | Resultado |
|---|---|---|
| M-01 | Dado el catálogo, cuando elijo "Calentador de agua", entonces la habitación de destino cambia a "Baño" y propone 60 min | ✔ |
| M-02 | Cuando elijo un equipo cíclico (refrigerador), entonces se esconden los minutos y aparece "Motor cíclico: ~30 % del día" | ✔ |
| M-03 | Cuando instalo un dispositivo, entonces aparece en la casa, en «Mis dispositivos» y en la lista del catálogo | ✔ |
| M-04 | Dado un análisis listo, cuando elimino un dispositivo, entonces el botón vuelve a "Simular día" | ✔ |
| M-05 | Con los 86 dispositivos, ninguno queda sin dibujo (los 7 últimos se agregaron en esta versión) | ✔ |
| M-06 | Regresión de la casa: 24 órdenes de 4 habitaciones + casas de 3, 5 y 6, con 4 dispositivos de suelo por habitación → ninguna celda libre queda aislada (BFS desde el avatar) | ✔ (27 casas, 788 celdas, 0 aisladas) |
| M-07 | El frontend envía la casa a `/api/simular` y el panel de resultados muestra el costo | ✔ |
