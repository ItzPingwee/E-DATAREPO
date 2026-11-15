from iso import *
from PIL import ImageDraw

def calentador(orient):
    L = Lienzo(80, 124, 0, 0)
    d = L.d
    cx, yb, r, alto = 40, 108, 22, 72
    # zócalo oscuro
    cilindro(L, cx, yb + 3, r + 1, 5, [hexa('#4b5368')]*3 + [hexa('#394055')]*4, hexa('#4b5368'), False)
    # tanque
    bandas = [hexa(h) for h in ('#b9c1d1', '#d8dde8', '#f0f2f7', '#dde1ea', '#b3bbcb', '#8c96ab', '#6e7992')]
    cilindro(L, cx, yb, r, alto, bandas, hexa('#e9ecf2'))
    ytop = yb - alto
    # aro de la tapa (anillo gris) y "hombro"
    d.arc([cx - r + 3, ytop - 8, cx + r - 3, ytop + 8], 0, 180, fill=hexa('#9aa3b6'))
    # tuberías: fría (azul) y caliente (roja) saliendo de la tapa
    for x, c1, c2 in ((cx - 9, '#3d86c6', '#6bb4ea'), (cx + 5, '#c8403b', '#ef7a6f')):
        d.rectangle([x, ytop - 13, x + 5, ytop - 2], fill=hexa(c1), outline=LINE)
        d.line([(x + 1, ytop - 12), (x + 1, ytop - 3)], fill=hexa(c2))
        d.rectangle([x - 1, ytop - 15, x + 6, ytop - 12], fill=hexa('#aeb6c6'), outline=LINE)
    # válvula lateral (derecha)
    d.rectangle([cx + r - 1, ytop + 14, cx + r + 4, ytop + 17], fill=hexa('#aeb6c6'), outline=LINE)
    d.rectangle([cx + r + 3, ytop + 12, cx + r + 5, ytop + 19], fill=hexa('#c8403b'), outline=LINE)
    # panel de control en la cara frontal
    px0 = cx + 9 if orient == 'u' else cx - 20
    py0 = ytop + 22
    d.rectangle([px0, py0, px0 + 11, py0 + 22], fill=hexa('#2b3040'), outline=LINE)
    d.rectangle([px0 + 2, py0 + 2, px0 + 9, py0 + 6], fill=hexa('#5cb6ea'))          # pantalla
    d.line([(px0 + 3, py0 + 4), (px0 + 6, py0 + 4)], fill=hexa('#d7f0ff'))
    d.ellipse([px0 + 3, py0 + 9, px0 + 8, py0 + 14], fill=hexa('#e6e9f0'), outline=LINE)   # perilla
    d.point((px0 + 5, py0 + 10), fill=LINE)
    d.rectangle([px0 + 2, py0 + 17, px0 + 3, py0 + 18], fill=hexa('#5fd37a'))            # led verde
    d.rectangle([px0 + 6, py0 + 17, px0 + 7, py0 + 18], fill=hexa('#e8b13a'))            # led ámbar
    # junta inferior
    d.arc([cx - r, yb - 12 - r//2, cx + r, yb - 12 + r//2], 0, 180, fill=hexa('#7c869b'))
    return L.final()

if __name__ == '__main__':
    for o in 'uv':
        calentador(o).save(f'calentador_agua_{o}.png')
