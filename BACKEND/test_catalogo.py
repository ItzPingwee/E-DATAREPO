# E-DATA — pruebas de integridad de los datos del frontend (catálogo, fotos y dibujos)
# ----------------------------------------------------------------------------
# El catálogo vive en FRONTEND/catalogo.js y los dibujos de la casa en FRONTEND/casa2d.js. Si un nombre de archivo
# está mal escrito, la app no se rompe: muestra un emoji en su lugar, y el error pasa desapercibido.
# Estas pruebas leen esos archivos como texto y revisan que todo lo que nombran exista de verdad.
#
# Ojo con las mayúsculas: Windows no las distingue ("foto.png" = "Foto.PNG"), pero Linux, macOS y GitHub Pages sí.
# Por eso se compara contra la lista real de archivos de la carpeta, que respeta mayúsculas.
#
# Cómo correrlas (desde la carpeta BACKEND):   python -m unittest -v
# ----------------------------------------------------------------------------
import os
import re
import unittest

FRONTEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "FRONTEND")


def leer(nombre_archivo):
    with open(os.path.join(FRONTEND, nombre_archivo), encoding="utf-8") as archivo:
        return archivo.read()


CATALOGO = leer("catalogo.js")
CASA = leer("casa2d.js")

# Cada dispositivo del catálogo ocupa una línea que empieza por "{ id: ..."
LINEAS_DISPOSITIVOS = [linea for linea in CATALOGO.splitlines() if linea.strip().startswith("{ id:")]


def campo(linea, nombre):
    """Valor de un campo de texto de una línea del catálogo, p. ej. campo(linea, 'tipo') -> 'variable'. None si no está."""
    encontrado = re.search(nombre + r': "([^"]*)"', linea)
    return encontrado.group(1) if encontrado else None


class PruebasCatalogo(unittest.TestCase):

    def test_hay_86_dispositivos_con_ids_seguidos(self):
        ids = [int(re.search(r"id: (\d+)", linea).group(1)) for linea in LINEAS_DISPOSITIVOS]
        self.assertEqual(ids, list(range(86)))

    def test_cada_foto_existe_con_el_nombre_exacto(self):
        fotos = set(os.listdir(os.path.join(FRONTEND, "Imagenes electrodomesticos")))
        faltantes = [campo(l, "imagen") for l in LINEAS_DISPOSITIVOS if campo(l, "imagen") not in fotos]
        self.assertEqual(faltantes, [])

    def test_tipo_valido(self):
        tipos = {campo(linea, "tipo") for linea in LINEAS_DISPOSITIVOS}
        self.assertLessEqual(tipos, {"variable", "ciclo", "continuo"})

    def test_minutos_tipicos_solo_en_variable(self):
        # Los minutos solo tienen sentido si el usuario elige cuánto lo usa (tipo variable)
        malos = [campo(l, "nombre") for l in LINEAS_DISPOSITIVOS if "minutos_tipicos" in l and campo(l, "tipo") != "variable"]
        self.assertEqual(malos, [])

    def test_todos_tienen_montaje_valido(self):
        # 'montaje' dice cómo se dibuja en la casa; sin él, el dispositivo sale como un pin con emoji
        montajes = [campo(linea, "montaje") for linea in LINEAS_DISPOSITIVOS]
        self.assertNotIn(None, montajes)
        self.assertLessEqual(set(montajes), {"mueble", "superficie", "pared", "suelo"})

    def test_los_que_no_son_mueble_traen_dibujo(self):
        sin_dibujo = [campo(l, "nombre") for l in LINEAS_DISPOSITIVOS if campo(l, "montaje") != "mueble" and not campo(l, "sprite")]
        self.assertEqual(sin_dibujo, [])


class PruebasDibujos(unittest.TestCase):

    def test_cada_sprite_del_catalogo_esta_en_muebles(self):
        # La clave 'sprite' del catálogo debe existir en la tabla MUEBLES de casa2d.js
        claves_muebles = set(re.findall(r"^\s+(\w+):\s*\{\s*[uv]:", CASA, re.MULTILINE))
        sprites = {campo(l, "sprite") for l in LINEAS_DISPOSITIVOS if campo(l, "sprite")}
        self.assertEqual(sprites - claves_muebles, set())

    def test_cada_archivo_de_dibujo_existe(self):
        faltantes = []
        for ruta in re.findall(r"archivo: '([^']+)'", CASA):
            carpeta, nombre = os.path.split(os.path.join(FRONTEND, "assets", ruta))
            if nombre not in os.listdir(carpeta):
                faltantes.append(ruta)
        self.assertEqual(faltantes, [])


if __name__ == "__main__":
    unittest.main()
