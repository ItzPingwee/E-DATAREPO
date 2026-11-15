from iso import *
from otros import Pared

W = 38

def scr(L, o, a, z, p):
    return L.p(p, W - a, z) if o == 'u' else L.p(a, p, z)

def circ(d, c, r, fill):
    d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=fill)

def bombillo(o):
    L = Lienzo(120, 110, 60, 55)
    d = L.d
    P = Pared(L, o, W)
    zc, prof = 12, 6
    a_bulbo = 11
    # placa de soporte pegada a la pared, bajo el casquillo
    P.caja(23, 37, 3, 21, 0, 3, hexa('#6d7690'), hexa('#3f4659'), hexa('#505873'))
    P.quad(26, 28, 6, 8, 3, hexa('#2b3040'), False)       # tornillos
    P.quad(32, 34, 16, 18, 3, hexa('#2b3040'), False)
    # resplandor (rayitos) detrás
    c0 = scr(L, o, a_bulbo, zc, prof)
    for dx, dy in ((-15, -2), (-12, -12), (-2, -15), (-13, 8), (-3, 14), (8, -13)):
        d.line([(c0[0] + dx, c0[1] + dy), (c0[0] + dx * 7 // 6 - (1 if dx < 0 else -1), c0[1] + dy * 7 // 6)], fill=hexa('#ffe27a'))
    def cuello_y_base():
        for a in range(a_bulbo + 6, a_bulbo + 24):
            c = scr(L, o, a, zc, prof)
            if a < a_bulbo + 11:
                r = 8 - (a - (a_bulbo + 6)) * 0.55; col = hexa('#f7e3a0')       # cuello de vidrio
            else:
                r = 5; col = hexa('#b3bbcb') if (a // 2) % 2 == 0 else hexa('#8f99ae')   # rosca metálica
            circ(d, c, round(r), col)
        circ(d, scr(L, o, a_bulbo + 24, zc, prof), 2, hexa('#4b5368'))           # contacto
    def esfera():
        c = scr(L, o, a_bulbo, zc, prof)
        circ(d, c, 9, hexa('#fff4c8'))
        for dx, dy in ((7, 3), (8, 1), (7, 5), (5, 7), (8, -1), (3, 8), (8, -3), (6, 6)):
            d.point((c[0] + dx, c[1] + dy), fill=hexa('#f0cf72'))             # sombra del lado opuesto a la luz
        for dx, dy in ((-5, -5), (-4, -6), (-6, -3), (-3, -7)):
            d.point((c[0] + dx, c[1] + dy), fill=hexa('#ffffff'))             # brillo
        for k in range(-3, 4):                                                 # filamento
            d.point((c[0] + k, c[1] + (1 if k % 2 else -1)), fill=hexa('#e8943a'))
        for k in range(4, 9):                                                  # soportes del filamento
            d.point(scr(L, o, a_bulbo + k, zc + 2, prof), fill=hexa('#b9b2a0'))
            d.point(scr(L, o, a_bulbo + k, zc - 2, prof), fill=hexa('#b9b2a0'))
    cuello_y_base()    # primero el casquillo y el cuello; la esfera encima, así el cuello nace de ella
    esfera()
    return L.final()

if __name__ == '__main__':
    for o in 'uv':
        bombillo(o).save(f'bombillo_pared_{o}.png')
