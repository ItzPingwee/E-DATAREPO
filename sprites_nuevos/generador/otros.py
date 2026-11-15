from iso import *

# ---------- ayudante para objetos pegados a una pared ----------
class Pared:
    """a = posición horizontal de izquierda a derecha en pantalla; prof = distancia a la pared (hacia el espectador)."""
    def __init__(self, L, o, W):
        self.L, self.o, self.W = L, o, W
    def caja(self, a0, a1, z0, z1, p0, p1, top, izq, der, borde=True):
        if self.o == 'u':
            self.L.caja(p0, self.W - a1, z0, p1 - p0, a1 - a0, z1 - z0, top, izq, der, borde)
        else:
            self.L.caja(a0, p0, z0, a1 - a0, p1 - p0, z1 - z0, top, izq, der, borde)
    def quad(self, a0, a1, z0, z1, p, fill, borde=False):
        if self.o == 'u': self.L.cara_u(p, self.W - a1, self.W - a0, z0, z1, fill, borde)
        else:             self.L.cara_v(p, a0, a1, z0, z1, fill, borde)
    def pt(self, a, z, p, col):
        if self.o == 'u': self.L.px(p, self.W - a, z, col)
        else:             self.L.px(a, p, z, col)
    def lin(self, a0, z0, a1, z1, p, col):
        if self.o == 'u': self.L.linea((p, self.W - a0, z0), (p, self.W - a1, z1), col)
        else:             self.L.linea((a0, p, z0), (a1, p, z1), col)

# ---------- PERSIANAS AUTOMÁTICAS ----------
def persianas(o):
    W, H = 44, 54
    L = Lienzo(120, 150, 60, 80)
    P = Pared(L, o, W)
    # marco blanco
    P.caja(0, W, 0, H, 0, 3, hexa('#eceef3'), hexa('#c4c9d6'), hexa('#dfe3ea'))
    # vidrio (cielo) con brillo
    P.quad(4, W - 4, 4, H - 6, 3, hexa('#8fd0f2'))
    P.quad(4, W - 4, 4, 16, 3, hexa('#b9e4f8'))
    for k in range(0, 14, 4):                       # destello diagonal
        P.lin(8 + k, 12, 14 + k, 24, 3, hexa('#e3f5fd'))
    # cortina enrollable bajada (láminas alternadas)
    z = H - 6
    i = 0
    while z > 26:
        P.quad(4, W - 4, z - 2, z, 3, hexa('#f3eee2') if i % 2 == 0 else hexa('#d8d0be'))
        z -= 2; i += 1
    P.quad(4, W - 4, 24, 26, 3, hexa('#8b7f69'))     # barra inferior
    P.lin(4, 24, W - 4, 24, 3, LINE)
    P.lin(W - 10, 24, W - 10, 14, 3, hexa('#6e6558'))   # cordón
    P.quad(W - 12, W - 8, 11, 14, 3, hexa('#8b7f69'), True)
    # cabezal con motor
    P.caja(0, W, H - 6, H + 4, 0, 6, hexa('#f4f6fa'), hexa('#b9c1d1'), hexa('#d3d8e4'))
    P.quad(3, 9, H - 4, H + 1, 6, hexa('#5cb6ea'), True)            # pantallita / sensor
    P.pt(6, H - 2, 6, hexa('#d7f0ff'))
    P.quad(W - 8, W - 5, H - 3, H, 6, hexa('#5fd37a'), True)        # led
    P.caja(W - 4, W + 3, H - 5, H + 3, 0, 7, hexa('#6d7690'), hexa('#4b5368'), hexa('#59627a'))  # tapa del motor
    return L.final()

# ---------- CERRADURA SMART ----------
def cerradura(o):
    W = 40
    L = Lienzo(90, 110, 45, 65)
    P = Pared(L, o, W)
    # placa del teclado
    P.caja(0, 18, 0, 42, 0, 3, hexa('#5a6178'), hexa('#2f3447'), hexa('#3d4458'))
    P.quad(2, 16, 35, 40, 3, hexa('#5cb6ea'), True)                  # franja azul (led de estado)
    P.lin(4, 37, 13, 37, 3, hexa('#d7f0ff'))
    for fila in range(4):                                             # teclado 3x4
        for col in range(3):
            a0 = 3 + col * 5; z0 = 24 - fila * 5
            P.quad(a0, a0 + 3, z0, z0 + 3, 3, hexa('#d3d9e6') if (fila, col) != (3, 2) else hexa('#5fd37a'), False)
    P.quad(6, 12, 1, 4, 3, hexa('#1e2230'), True)                    # ranura de llave
    # cuerpo interior (botón giratorio) que asoma por la derecha de la placa
    P.caja(18, 22, 12, 28, 0, 5, hexa('#cdd3df'), hexa('#9aa3b6'), hexa('#b7bfce'))
    # palanca plateada
    P.caja(22, 39, 17, 21, 2, 7, hexa('#f2f4f8'), hexa('#aeb6c6'), hexa('#d3d8e2'))
    P.caja(37, 39, 15, 23, 2, 7, hexa('#e4e8f0'), hexa('#9aa3b6'), hexa('#c4cad8'))
    return L.final()

# ---------- MOTOR DE GARAJE ----------
def motor_garaje(o):
    L = Lienzo(170, 120, 85, 48)
    # riel largo (eje de la dirección en que mira)
    if o == 'u':
        L.caja(-2, -1, 10, 3, 18, 22, hexa('#7b859b'), hexa('#4b5368'), hexa('#5d667c'))   # placa de pared
        L.caja(0, 0, 14, 20, 16, 14, hexa('#f1f3f8'), hexa('#b9c1d1'), hexa('#d6dbe6'))
        # riel que sale hacia +u
        L.caja(20, 5, 20, 38, 6, 4, hexa('#8f99ae'), hexa('#535b70'), hexa('#6b748b'))
        L.caja(20, 6, 24, 38, 4, 1, hexa('#cfd5e2'), hexa('#8f99ae'), hexa('#aab2c4'), False)
        L.caja(34, 4, 24, 8, 8, 4, hexa('#3b4054'), hexa('#262a3a'), hexa('#30354a'))   # carro
        # lámpara frontal (cara +u)
        L.cara_u(20, 3, 13, 17, 23, hexa('#f7e9a6'), True)
        L.cara_u(20, 5, 11, 19, 21, hexa('#fff7cf'))
        # rejillas laterales (cara +v)
        for k in range(4): L.linea((3, 16, 18 + k * 2), (14, 16, 18 + k * 2), hexa('#8f99ae'))
        # led azul
        L.cara_u(20, 12, 14, 26, 28, hexa('#5cb6ea'), False)
        for k in range(8): L.px(36 + k, 8 - k // 2 * 0, 28 + k, hexa('#8f99ae'))          # brazo de la puerta
        for k in range(8): L.px(36 + k, 6, 28 + k, LINE)
    else:
        L.caja(-1, -2, 10, 18, 3, 22, hexa('#7b859b'), hexa('#4b5368'), hexa('#5d667c'))   # placa de pared
        L.caja(0, 0, 14, 16, 20, 14, hexa('#f1f3f8'), hexa('#b9c1d1'), hexa('#d6dbe6'))
        L.caja(5, 20, 20, 6, 38, 4, hexa('#8f99ae'), hexa('#535b70'), hexa('#6b748b'))
        L.caja(6, 20, 24, 4, 38, 1, hexa('#cfd5e2'), hexa('#8f99ae'), hexa('#aab2c4'), False)
        L.caja(4, 34, 24, 8, 8, 4, hexa('#3b4054'), hexa('#262a3a'), hexa('#30354a'))
        L.cara_v(20, 3, 13, 17, 23, hexa('#f7e9a6'), True)
        L.cara_v(20, 5, 11, 19, 21, hexa('#fff7cf'))
        for k in range(4): L.linea((16, 3, 18 + k * 2), (16, 14, 18 + k * 2), hexa('#8f99ae'))
        L.cara_v(20, 12, 14, 26, 28, hexa('#5cb6ea'), False)
        for k in range(8): L.px(8, 36 + k, 28 + k, hexa('#8f99ae'))
        for k in range(8): L.px(6, 36 + k, 28 + k, LINE)
    return L.final()

if __name__ == '__main__':
    import sys
    for nombre, f in (('persianas', persianas), ('cerradura_smart', cerradura), ('motor_garaje', motor_garaje)):
        for o in 'uv':
            f(o).save(f'{nombre}_{o}.png')
