# E-DATA — pruebas automáticas del motor de cálculo (main.py)
# ----------------------------------------------------------------------------
# Qué es una prueba: un ejercicio con la respuesta ya calculada a mano. El programa resuelve el mismo
# ejercicio y un "assert" compara las dos respuestas; si no coinciden, la prueba falla y avisa.
#
# Cómo correrlas (desde la carpeta BACKEND):
#     python -m unittest -v
#
# Usan `unittest`, que viene incluido en Python (no hay que instalar nada).
# Llaman directamente a la función simular_consumo: no hace falta tener el servidor encendido
# y NUNCA se llama a la IA (/api/ia), que es lenta y la corre el usuario.
# Los cálculos a mano de cada caso están en docs/PRUEBAS.md.
# ----------------------------------------------------------------------------
import unittest

from pydantic import ValidationError

from main import SimulacionRequest, app, simular_consumo

TARIFA = 875.04   # COP por kWh: la tarifa por defecto del backend


# ---------- Ayudantes: arman los datos de entrada para que cada prueba se lea fácil ----------

def dispositivo(nombre, watts_activos, watts_standby, horas_uso, conectado=True, desconectable=True):
    """Un dispositivo tal como lo manda el frontend."""
    return {
        "nombre": nombre,
        "watts_activos": watts_activos,
        "watts_standby": watts_standby,
        "horas_uso": horas_uso,
        "dejado_conectado": conectado,
        "desconectable": desconectable,
    }


def simular(habitaciones, **opciones):
    """Simula una casa. 'habitaciones' es un diccionario {nombre: [dispositivos]}.
    En 'opciones' se puede cambiar la tarifa o el presupuesto (tarifa_kwh=..., presupuesto_diario=...)."""
    lista = [{"nombre": nombre, "dispositivos": dispositivos} for nombre, dispositivos in habitaciones.items()]
    return simular_consumo(SimulacionRequest(habitaciones=lista, **opciones))


# ---------- 1. Consumo en kWh ----------

class PruebasConsumo(unittest.TestCase):

    def test_casa_vacia_no_consume(self):
        resultado = simular({})
        self.assertEqual(resultado["consumo_total_kwh"], 0)
        self.assertEqual(resultado["costo_simulado_cop"], 0)
        self.assertEqual(resultado["ranking_vampiros"], [])

    def test_uso_activo(self):
        # Equipo de 24 h (continuo): 10 W x 24 h = 240 Wh = 0,24 kWh, y no tiene horas de reposo
        resultado = simular({"Sala": [dispositivo("Router", 10, 7, 24, desconectable=False)]})
        self.assertAlmostEqual(resultado["consumo_total_kwh"], 0.24)

    def test_reposo_solo_en_las_horas_sin_uso(self):
        # Televisor: 100 W x 4 h = 0,4 kWh de uso + 5 W x (24 - 4) h = 0,1 kWh de reposo = 0,5 kWh
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4)]})
        self.assertAlmostEqual(resultado["consumo_total_kwh"], 0.5)

    def test_desenchufado_no_gasta_en_reposo(self):
        # Mismo televisor, pero el usuario lo desenchufa: solo cuenta el uso (0,4 kWh)
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4, conectado=False)]})
        self.assertAlmostEqual(resultado["consumo_total_kwh"], 0.4)

    def test_suma_todas_las_habitaciones(self):
        # 0,5 kWh (televisor de la sala) + 0,24 kWh (router del estudio) = 0,74 kWh
        resultado = simular({
            "Sala": [dispositivo("Televisor", 100, 5, 4)],
            "Estudio": [dispositivo("Router", 10, 7, 24, desconectable=False)],
        })
        self.assertAlmostEqual(resultado["consumo_total_kwh"], 0.74)


# ---------- 2. Costo en pesos ----------

class PruebasCosto(unittest.TestCase):

    def test_costo_es_kwh_por_tarifa(self):
        # 0,5 kWh x 875,04 COP/kWh = 437,52 COP
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4)]})
        self.assertAlmostEqual(resultado["costo_simulado_cop"], 437.52)

    def test_tarifa_distinta(self):
        # Con una tarifa de 1000 COP/kWh: 0,5 kWh x 1000 = 500 COP
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4)]}, tarifa_kwh=1000)
        self.assertAlmostEqual(resultado["costo_simulado_cop"], 500)

    def test_redondea_a_dos_decimales(self):
        # Microondas 1200 W x 0,2 h + 4 W x 23,8 h = 0,3352 kWh -> se entrega redondeado a 0,34
        resultado = simular({"Cocina": [dispositivo("Microondas", 1200, 4, 0.2)]})
        self.assertEqual(resultado["consumo_total_kwh"], 0.34)
        self.assertEqual(resultado["costo_simulado_cop"], round(0.3352 * TARIFA, 2))


# ---------- 3. Dispositivos vampiro (max-heap) ----------

class PruebasVampiros(unittest.TestCase):

    def test_ranking_de_mayor_a_menor(self):
        # Se instalan en desorden; el max-heap debe sacarlos del que más gasta en reposo al que menos
        resultado = simular({"Casa": [
            dispositivo("Cargador", 15, 0.26, 3),
            dispositivo("Consola", 120, 8, 2),
            dispositivo("Cafetera", 900, 2.25, 0.5),
            dispositivo("Impresora", 30, 3.5, 0.25),
        ]})
        nombres = [v["dispositivo"] for v in resultado["ranking_vampiros"]]
        self.assertEqual(nombres, ["Consola", "Impresora", "Cafetera", "Cargador"])
        watts = [v["watts_fantasma"] for v in resultado["ranking_vampiros"]]
        self.assertEqual(watts, sorted(watts, reverse=True))

    def test_no_entra_si_no_es_desconectable(self):
        # La nevera gasta en reposo, pero no se puede desconectar: suma al consumo, no es vampiro
        resultado = simular({"Cocina": [dispositivo("Nevera", 300, 2.25, 7.2, desconectable=False)]})
        self.assertEqual(resultado["ranking_vampiros"], [])
        self.assertGreater(resultado["consumo_total_kwh"], 0)

    def test_no_entra_si_no_gasta_en_reposo(self):
        resultado = simular({"Cocina": [dispositivo("Licuadora", 500, 0, 0.1)]})
        self.assertEqual(resultado["ranking_vampiros"], [])

    def test_no_entra_si_esta_desenchufado(self):
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4, conectado=False)]})
        self.assertEqual(resultado["ranking_vampiros"], [])

    def test_guarda_la_habitacion(self):
        # El mismo aparato en dos habitaciones aparece dos veces, cada uno con su habitación
        resultado = simular({
            "Sala": [dispositivo("Televisor", 100, 5, 4)],
            "Habitación": [dispositivo("Televisor", 100, 5, 2)],
        })
        habitaciones = sorted(v["habitacion"] for v in resultado["ranking_vampiros"])
        self.assertEqual(habitaciones, ["Habitación", "Sala"])


# ---------- 4. Ahorro al mes ----------

class PruebasAhorro(unittest.TestCase):

    def test_ahorro_es_el_reposo_de_los_vampiros(self):
        # Televisor: 5 W x 20 h = 0,1 kWh al día en reposo -> 0,1 x 30 días x 875,04 = 2625,12 COP al mes
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4)]})
        self.assertAlmostEqual(resultado["ahorro_mensual_cop"], 2625.12)

    def test_sin_vampiros_no_hay_ahorro(self):
        resultado = simular({"Cocina": [dispositivo("Nevera", 300, 2.25, 7.2, desconectable=False)]})
        self.assertEqual(resultado["ahorro_mensual_cop"], 0)

    def test_ahorro_igual_a_la_diferencia_de_costos(self):
        # Prueba de regresión: el ahorro debe ser exactamente lo que baja la factura al desenchufar los vampiros.
        # Una versión anterior contaba 24 h de reposo (también las horas de uso) y esta prueba lo habría detectado.
        enchufados = [dispositivo("Televisor", 100, 5, 4), dispositivo("Consola", 120, 8, 2),
                      dispositivo("Nevera", 300, 2.25, 7.2, desconectable=False)]
        desenchufados = [dispositivo("Televisor", 100, 5, 4, conectado=False), dispositivo("Consola", 120, 8, 2, conectado=False),
                         dispositivo("Nevera", 300, 2.25, 7.2, desconectable=False)]
        con_vampiros = simular({"Sala": enchufados})
        sin_vampiros = simular({"Sala": desenchufados})
        diferencia_al_mes = (con_vampiros["costo_simulado_cop"] - sin_vampiros["costo_simulado_cop"]) * 30
        self.assertAlmostEqual(con_vampiros["ahorro_mensual_cop"], diferencia_al_mes, delta=1)   # 1 peso: el costo viene redondeado


# ---------- 5. El ejercicio completo (caso de prueba del paper) ----------

class PruebaCasoDelPaper(unittest.TestCase):
    """Cocina y sala de la sección 6 del paper, con las horas de uso escritas. Resuelto a mano en docs/PRUEBAS.md."""

    def setUp(self):
        self.resultado = simular({
            "Cocina": [
                dispositivo("Refrigerador", 300, 2.25, 7.2, desconectable=False),   # cíclico: 30 % de 24 h
                dispositivo("Microondas", 1200, 4, 0.2),                            # 12 minutos
                dispositivo("Air-fryer", 1400, 2, 0.5),                             # 30 minutos
            ],
            "Sala": [
                dispositivo("Televisor", 100, 5, 4),
                dispositivo("Router Wi-Fi", 15, 0, 24, desconectable=False),        # continuo
            ],
        })

    def test_consumo(self):
        self.assertAlmostEqual(self.resultado["consumo_total_kwh"], 4.14)

    def test_costo(self):
        self.assertAlmostEqual(self.resultado["costo_simulado_cop"], 3622.67)

    def test_ahorro(self):
        self.assertAlmostEqual(self.resultado["ahorro_mensual_cop"], 6358.04)

    def test_ranking(self):
        ranking = [(v["dispositivo"], v["watts_fantasma"]) for v in self.resultado["ranking_vampiros"]]
        self.assertEqual(ranking, [("Televisor", 5), ("Microondas", 4), ("Air-fryer", 2)])

    def test_supera_el_presupuesto(self):
        # 3622,67 COP al día > 2000 COP de presupuesto
        self.assertIn("superó", self.resultado["prompt_generado"])


# ---------- 6. Texto que se le pasa a la IA (solo se revisa el texto; la IA no se llama) ----------

class PruebasPrompt(unittest.TestCase):

    def test_respeta_el_presupuesto(self):
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4)]})   # 437,52 COP < 2000
        self.assertIn("respetó", resultado["prompt_generado"])

    def test_presupuesto_distinto(self):
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4)]}, presupuesto_diario=100)
        self.assertIn("superó", resultado["prompt_generado"])

    def test_menciona_los_vampiros_y_el_ahorro(self):
        resultado = simular({"Sala": [dispositivo("Televisor", 100, 5, 4)]})
        self.assertIn("Televisor", resultado["prompt_generado"])
        self.assertIn("$2625 COP", resultado["prompt_generado"])

    def test_sin_vampiros(self):
        resultado = simular({"Cocina": [dispositivo("Licuadora", 500, 0, 0.1)]})
        self.assertIn("No hay consumo fantasma", resultado["prompt_generado"])


# ---------- 7. Validación de los datos de entrada (Pydantic) ----------
# Pydantic revisa que cada campo exista y tenga el tipo correcto ANTES de calcular nada.

class PruebasValidacion(unittest.TestCase):

    def test_falta_un_campo(self):
        incompleto = {"nombre": "Televisor", "watts_activos": 100}   # faltan standby, horas, etc.
        with self.assertRaises(ValidationError):
            SimulacionRequest(habitaciones=[{"nombre": "Sala", "dispositivos": [incompleto]}])

    def test_tipo_equivocado(self):
        malo = dispositivo("Televisor", "mucho", 5, 4)   # "mucho" no es un número
        with self.assertRaises(ValidationError):
            SimulacionRequest(habitaciones=[{"nombre": "Sala", "dispositivos": [malo]}])


# ---------- 8. El endpoint /api/simular por HTTP (sin encender el servidor) ----------
# TestClient (de FastAPI) hace peticiones a la app en memoria. Necesita la librería httpx;
# si no está instalada, estas pruebas se saltan en vez de fallar.
try:
    from fastapi.testclient import TestClient
    HAY_CLIENTE = True
except ImportError:
    HAY_CLIENTE = False


@unittest.skipUnless(HAY_CLIENTE, "falta httpx para el cliente de pruebas de FastAPI")
class PruebasEndpoint(unittest.TestCase):

    def setUp(self):
        self.cliente = TestClient(app)

    def test_responde_200_con_datos_validos(self):
        cuerpo = {"habitaciones": [{"nombre": "Sala", "dispositivos": [dispositivo("Televisor", 100, 5, 4)]}]}
        respuesta = self.cliente.post("/api/simular", json=cuerpo)
        self.assertEqual(respuesta.status_code, 200)
        self.assertAlmostEqual(respuesta.json()["consumo_total_kwh"], 0.5)

    def test_ignora_campos_extra_del_frontend(self):
        # El frontend también manda 'id' e 'icono'; el backend debe ignorarlos sin fallar
        extra = dict(dispositivo("Televisor", 100, 5, 4), id=5, icono="📺")
        respuesta = self.cliente.post("/api/simular", json={"habitaciones": [{"nombre": "Sala", "dispositivos": [extra]}]})
        self.assertEqual(respuesta.status_code, 200)

    def test_responde_422_con_datos_invalidos(self):
        # 422 = "no puedo procesar estos datos": el backend rechaza la petición en vez de calcular algo raro
        respuesta = self.cliente.post("/api/simular", json={"habitaciones": [{"nombre": "Sala"}]})
        self.assertEqual(respuesta.status_code, 422)


if __name__ == "__main__":
    unittest.main()
