"""Mini motor isométrico 2:1 para dibujar pixel art (sin antialias).
Proyección: X = u - v ;  Y = (u + v)/2 - z.   +u mira abajo-derecha, +v mira abajo-izquierda."""
from PIL import Image, ImageDraw

LINE = (28, 32, 48, 255)          # contorno azul-negro (como los sprites actuales)

def hexa(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)

class Lienzo:
    def __init__(self, w, h, ox, oy):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.ox, self.oy = ox, oy       # donde cae (u,v,z) = (0,0,0)
    def p(self, u, v, z):
        return (round(self.ox + (u - v)), round(self.oy + (u + v) / 2 - z))
    def poly(self, pts, fill, borde=True):
        pts = [self.p(*q) for q in pts]
        self.d.polygon(pts, fill=fill)
        if borde:
            self.d.line(pts + [pts[0]], fill=LINE, width=1)
    def linea(self, a, b, col=LINE):
        self.d.line([self.p(*a), self.p(*b)], fill=col, width=1)
    def px(self, u, v, z, col):
        self.d.point(self.p(u, v, z), fill=col)
    def caja(self, u0, v0, z0, du, dv, dz, top, izq, der, borde=True):
        u1, v1, z1 = u0 + du, v0 + dv, z0 + dz
        self.poly([(u0,v1,z0),(u1,v1,z0),(u1,v1,z1),(u0,v1,z1)], izq, borde)   # cara +v (izquierda en pantalla)
        self.poly([(u1,v0,z0),(u1,v1,z0),(u1,v1,z1),(u1,v0,z1)], der, borde)   # cara +u (derecha en pantalla)
        self.poly([(u0,v0,z1),(u1,v0,z1),(u1,v1,z1),(u0,v1,z1)], top, borde)   # tapa
    # cuadrilátero sobre la cara +u (plano u fijo): v, z
    def cara_u(self, u, v0, v1, z0, z1, fill, borde=False):
        self.poly([(u,v0,z0),(u,v1,z0),(u,v1,z1),(u,v0,z1)], fill, borde)
    def cara_v(self, v, u0, u1, z0, z1, fill, borde=False):
        self.poly([(u0,v,z0),(u1,v,z0),(u1,v,z1),(u0,v,z1)], fill, borde)
    def final(self, escala=1):
        """contorno exterior de 1 px + recorte al borde"""
        a = self.im.split()[3].point(lambda x: 255 if x > 0 else 0)
        w, h = self.im.size
        out = self.im.copy(); px = out.load(); ap = a.load()
        for y in range(h):
            for x in range(w):
                if ap[x, y] == 0:
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = x+dx, y+dy
                        if 0 <= nx < w and 0 <= ny < h and ap[nx, ny]:
                            px[x, y] = LINE; break
        bbox = out.getbbox(); out = out.crop(bbox)
        if escala > 1: out = out.resize((out.width*escala, out.height*escala), Image.NEAREST)
        return out

def cilindro(L, cx, y_base, r, alto, bandas, tapa, borde_tapa=True):
    """cilindro vertical dibujado a mano: cx,y_base en pantalla (px del lienzo). bandas = colores de izq a der."""
    d = L.d; ry = max(2, r // 2)
    y_top = y_base - alto
    mask = Image.new('L', L.im.size, 0); md = ImageDraw.Draw(mask)
    md.ellipse([cx - r, y_base - ry, cx + r, y_base + ry], fill=255)
    md.rectangle([cx - r, y_top, cx + r, y_base], fill=255)
    m = mask.load(); px = L.im.load()
    n = len(bandas)
    for y in range(L.im.size[1]):
        for x in range(L.im.size[0]):
            if m[x, y]:
                t = (x - (cx - r)) / (2 * r + 1)
                px[x, y] = bandas[min(n - 1, int(t * n))]
    # tapa elíptica
    d.ellipse([cx - r, y_top - ry, cx + r, y_top + ry], fill=tapa, outline=LINE if borde_tapa else None)
    # arco inferior y laterales (contorno interno)
    d.arc([cx - r, y_base - ry, cx + r, y_base + ry], 0, 180, fill=LINE)
    d.line([(cx - r, y_top), (cx - r, y_base)], fill=LINE)
    d.line([(cx + r, y_top), (cx + r, y_base)], fill=LINE)
