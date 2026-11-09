// E-DATA — casa isométrica en 2D
// ----------------------------------------------------------------------------
// Cómo funciona (resumen para explicarlo):
//  1. La casa es una REJILLA de celdas. Cada habitación ocupa un cuadrado de 4x4 celdas.
//  2. Una fórmula (aPantalla) convierte la celda (columna, fila) en una posición de pantalla.
//  3. Lo que está más "adelante" (columna + fila mayor) se dibuja encima: z-index = columna + fila.
//  4. El avatar se mueve por la rejilla con el teclado o con un clic (BFS para buscar el camino).
//  5. Cada mueble tiene medidas reales en metros (1 celda = 1.3 m); de ahí salen su tamaño y su huella.
//  6. Los muebles se reparten por las paredes según una plantilla y dejan libre el sitio de las puertas,
//     así ninguna habitación queda aislada sea cual sea el orden en que se creen.
// ----------------------------------------------------------------------------

// ----------------------------------------------------
// 1. CONSTANTES Y SPRITES
// ----------------------------------------------------
const ANCHO_CELDA = 96;                    // ancho en pantalla de una celda (un rombo)
const ALTO_CELDA = ANCHO_CELDA / 2;        // en isométrico el rombo mide la mitad de alto que de ancho
const CELDAS_POR_LADO = 4;                 // cada habitación es de 4 x 4 celdas
const MAX_HABITACIONES = 6;                // más habitaciones harían la casa demasiado pequeña para verla
const ESPACIO_SOBRE_SUELO = 175;           // margen sobre el suelo para las paredes de dos pisos y los muebles altos
const VELOCIDAD_AVATAR = 3.5;              // celdas por segundo
const ESCALA_AVATAR = 0.34;
const RUTA_ASSETS = 'assets/';

// ESCALA DEL MUNDO (para que todo tenga proporciones creíbles)
// El avatar mide ~79 px en pantalla y representa a una persona de 1.7 m; las paredes (~78 px) quedan a esa misma altura:
// son "paredes cortadas", como en los juegos isométricos.
// En el suelo, una celda equivale a 1.3 m: una habitación de 4x4 celdas es de 5.2 x 5.2 m.
// Solo el suelo usa metros: la altura de cada mueble sale de su propio dibujo (ver escalasDeMueble).
const METROS_POR_CELDA = 1.3;

// Cada sprite guarda:
//  - archivo y tamaño original del PNG (tam)
//  - caja: la "caja útil" sin márgenes transparentes [izquierda, arriba, derecha, abajo]
//  - ancho: ancho con el que se dibuja la caja en pantalla (px)
//  - estiramientoY: corrección vertical. Los dibujos originales no son exactamente 2:1 (su borde sube
//    con pendiente 0.53-0.55 y no 0.5); al aplastarlos un poco encajan perfecto en la rejilla y las
//    piezas vecinas quedan alineadas sin "escalones".
//  - punto: (solo paredes) un punto de la línea donde la pared toca el suelo, para anclarla ahí.
// Todos estos números se midieron una vez sobre los PNG originales.
const SPRITES = {
    // Baldosas: 'cara' son los 4 vértices del rombo de arriba. Se recorta cada baldosa a esa cara y el grosor
    // del piso lo dibuja dibujarGrosorDelSuelo(), igual en toda la casa (las dos baldosas traen grosores distintos).
    // 'colorLados' son los colores del grosor (lado izquierdo y lado derecho), tomados del propio dibujo.
    baldosa_madera:   { archivo: 'base_casa/baldosa_madera.png',   tam: [180, 136], caja: [4, 12, 173, 118],   ancho: ANCHO_CELDA + 1, estiramientoY: 0.908,
                        cara: [[88.5, 12], [173, 58], [88.5, 105], [4, 59]], colorLados: ['#7c5033', '#6f482f'] },
    baldosa_ceramica: { archivo: 'base_casa/baldosa_ceramica.png', tam: [254, 144], caja: [24, 15, 210, 127],  ancho: ANCHO_CELDA + 1, estiramientoY: 0.9035,
                        cara: [[117, 15], [210, 69], [117, 121], [24, 67]], colorLados: ['#9f9f9f', '#969897'] },

    // Paredes: la altura final (~78 px) es la misma en las tres piezas. Cada pieza trae una "tapa" de grosor en
    // un extremo, que la pieza vecina tapa al dibujarse encima. 'punto' es el inicio de la línea de base.
    pared_izq:        { archivo: 'base_casa/pared_izq.png',        tam: [198, 223], caja: [39, 10, 169, 191],  ancho: 59.5, estiramientoY: 0.94,  punto: [51, 190.4] },
    pared_derecha:    { archivo: 'base_casa/pared_derecha.png',    tam: [182, 244], caja: [14, 16, 148, 196],  ancho: 60.8, estiramientoY: 0.954, punto: [15, 132.2] },
    pared_esquinera:  { archivo: 'base_casa/pared_esquinera.png',  tam: [233, 257], caja: [22, 8, 223, 192],   ancho: 86.4, estiramientoY: 0.932, punto: [129, 140] },

    // Muebles: en vez de un ancho en píxeles, cada mueble trae su HUELLA en el suelo, en metros:
    //   medidas: [largo en u, largo en v]
    // "u" es el eje que baja hacia la derecha y "v" el que baja hacia la izquierda (ver aPantalla).
    //   k: (opcional, 1 por defecto) agranda la huella. Los dibujos son más "bajos" que un mueble real; como la
    //      altura sale del propio dibujo (ver escalasDeMueble), se agranda un poco el mueble para que no se vea chato.
    //   pendiente: (opcional, 0.5 por defecto) inclinación de los bordes del dibujo original (dy/dx), medida en el PNG.
    //
    // ORIENTACIÓN: cada dibujo mira hacia un solo lado. Se comprobó MIRANDO cada PNG (el sufijo del nombre no es fiable):
    //   mira +u -> el frente mira abajo-derecha y el mueble va contra la pared trasera IZQUIERDA.
    //   mira +v -> el frente mira abajo-izquierda y el mueble va contra la pared trasera DERECHA.
    // Si un dibujo solo existe en un lado, se refleja (espejo) para usarlo en el otro.
    //
    // Salón y habitación
    tele_con_mueble:  { archivo: 'base_casa/tele_con_mueble.png',  tam: [237, 275], caja: [26, 10, 226, 230],  medidas: [1.5, 0.53], k: 1.15, superficie: { fraccion: 0.4, puntos: [[0.12, 0.5], [0.88, 0.5]] } },   // mira v, largo en u
    pc_con_mueble:    { archivo: 'base_casa/pc_con_mueble.png',    tam: [181, 212], caja: [22, 18, 173, 199],  medidas: [1.2, 0.45], k: 1.1 },     // mira v, largo en u
    sofa_u:           { archivo: 'base_casa/recortes/sofa_u.png',  tam: [162, 128], caja: [0, 0, 162, 128],    medidas: [0.9, 2.0], k: 1.25 },
    sofa_v:           { archivo: 'base_casa/recortes/sofa_v.png',  tam: [163, 128], caja: [0, 0, 163, 128],    medidas: [2.0, 0.9], k: 1.25 },
    sillon_u:         { archivo: 'base_casa/recortes/sillon_u.png', tam: [104, 100], caja: [0, 0, 104, 100],   medidas: [0.9, 0.9], k: 1.25 },
    sillon_v:         { archivo: 'base_casa/recortes/sillon_v.png', tam: [104, 101], caja: [0, 0, 104, 101],   medidas: [0.9, 0.9], k: 1.25 },
    // Sillones vistos de espaldas: sirven para mirar hacia una pared (la de la TV o la del sofá)
    sillon_espalda_v: { archivo: 'base_casa/recortes/sillon_espalda_v.png', tam: [108, 96], caja: [0, 0, 108, 96], medidas: [0.9, 0.9], k: 1.25 },   // mira hacia la pared y = 0
    sillon_espalda_u: { archivo: 'base_casa/recortes/sillon_espalda_u.png', tam: [107, 97], caja: [0, 0, 107, 97], medidas: [0.9, 0.9], k: 1.25 },   // mira hacia la pared x = 0
    mesa_centro_u:    { archivo: 'base_casa/recortes/mesa_centro_u.png', tam: [107, 87], caja: [0, 0, 107, 87], medidas: [1.3, 0.45], superficie: { fraccion: 1, puntos: [[0.5, 0.5]] } },
    mesa_centro_v:    { archivo: 'base_casa/recortes/mesa_centro_v.png', tam: [107, 89], caja: [0, 0, 107, 89], medidas: [0.45, 1.3], superficie: { fraccion: 1, puntos: [[0.5, 0.5]] } },
    cama_der:         { archivo: 'base_casa/cama_der.png',         tam: [201, 151], caja: [14, 7, 185, 143],   medidas: [2.0, 1.6], k: 1.15, pendiente: 0.514, superficie: { fraccion: 0.5, exclusiva: true, puntos: [[0.55, 0.5]] } },
    cama_izq:         { archivo: 'base_casa/cama_izq.png',         tam: [187, 154], caja: [12, 14, 179, 148],  medidas: [1.6, 2.0], k: 1.15, pendiente: 0.514, superficie: { fraccion: 0.5, exclusiva: true, puntos: [[0.5, 0.55]] } },
    closet_der:       { archivo: 'base_casa/closet_der.png',       tam: [121, 164], caja: [12, 1, 109, 161],   medidas: [0.55, 1.3], k: 1.05, pendiente: 0.51 },
    closet_izq:       { archivo: 'base_casa/closet_izq.png',       tam: [111, 169], caja: [8, 1, 105, 160],    medidas: [1.3, 0.55], k: 1.05, pendiente: 0.51 },
    armario_peq_der:  { archivo: 'base_casa/armario_peq_der.png',  tam: [109, 120], caja: [14, 6, 98, 112],    medidas: [0.45, 0.9], k: 1.3, superficie: { fraccion: 0.88, puntos: [[0.5, 0.68]] } },
    armario_peq_izq:  { archivo: 'base_casa/armario_peq_izq.png',  tam: [99, 121],  caja: [8, 2, 92, 108],     medidas: [0.9, 0.45], k: 1.3, superficie: { fraccion: 0.88, puntos: [[0.68, 0.5]] } },
    mesita_noche_der: { archivo: 'base_casa/mesita_noche_der.png', tam: [85, 118],  caja: [6, 8, 78, 116],     medidas: [0.42, 0.42], k: 1.25, superficie: { fraccion: 0.92, puntos: [[0.5, 0.5]] } },
    // Baño
    tina_der:         { archivo: 'base_casa/tina_der.png',         tam: [122, 98],  caja: [5, 2, 115, 90],     medidas: [1.6, 0.75], k: 1.0 },
    tina_izq:         { archivo: 'base_casa/tina_izq.png',         tam: [127, 108], caja: [6, 14, 116, 103],   medidas: [0.75, 1.6], k: 1.0 },
    ducha:            { archivo: 'base_casa/ducha.png',            tam: [116, 138], caja: [17, 0, 100, 135],   medidas: [0.9, 0.9], k: 1.1, pendiente: 0.52 },
    inodoro_der:      { archivo: 'base_casa/inodoro_der.png',      tam: [87, 103],  caja: [10, 3, 74, 90],     medidas: [0.7, 0.4], apoyo: 0.6, superficie: { fraccion: 0.85, puntos: [[0.22, 0.5]] } },   // en la tapa del tanque
    lavamanos_der:    { archivo: 'base_casa/lavamanos_der.png',    tam: [92, 148],  caja: [18, 3, 78, 140],    medidas: [0.45, 0.55], k: 1.15, apoyo: 0.5, superficie: { fraccion: 0.62, puntos: [[0.5, 0.5]] } },   // mira v (el espejo está en la pared trasera derecha)
    // Cocina (todos los módulos miden 0.9 m de mesón, como en una cocina real)
    lavaplatos_der:   { archivo: 'base_casa/lavaplatos_der.png',   tam: [138, 124], caja: [10, 7, 134, 121],   medidas: [0.6, 1.4], k: 1.25, pendiente: 0.515, superficie: { fraccion: 0.82, puntos: [[0.5, 0.2]] } },
    meson_recto:      { archivo: 'base_casa/meson_recto.png',      tam: [238, 247], caja: [10, 28, 227, 207],  medidas: [0.6, 1.54], k: 1.3, pendiente: 0.49, superficie: { fraccion: 1, puntos: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]] } },   // mira u, largo en v
    estufahorno_izq:  { archivo: 'dispositivos/estufahorno_izq.png', tam: [88, 104], caja: [9, 7, 80, 94],    medidas: [0.6, 0.6], k: 1.2, pendiente: 0.52 },
    nevera:           { archivo: 'dispositivos/nevera.png',        tam: [139, 237], caja: [17, 16, 127, 223],  medidas: [0.7, 0.7], k: 1.15, pendiente: 0.51 },     // mira u (las puertas están en la cara derecha)
    mesa:             { archivo: 'base_casa/mesa.png',             tam: [227, 216], caja: [15, 22, 206, 200],  medidas: [0.8, 1.2], k: 1.1, superficie: { fraccion: 1, puntos: [[0.5, 0.28], [0.5, 0.72]] } },   // largo en v

    // Dispositivos. 'ancho' es el ancho con que se dibujan (px); los pequeños se agrandan para que se vean.
    // Los de _der/_izq se comprobaron mirando el dibujo; en los antiguos se miró qué cara trae el frente (puertas, pantalla, rejilla).
    tostadora_der:      { archivo: 'dispositivos/tostadora_der.png',      tam: [95, 105],  caja: [9, 9, 85, 96],      ancho: 30 },   // mira u
    licuadora_der:      { archivo: 'dispositivos/licuadora_der.png',      tam: [65, 121],  caja: [5, 13, 57, 113],    ancho: 17 },   // mira u
    microondas:         { archivo: 'dispositivos/microondas.png',         tam: [243, 187], caja: [30, 10, 202, 171],  ancho: 42 },   // mira u
    sanduchera:         { archivo: 'dispositivos/sanduchera.png',         tam: [408, 268], caja: [89, 51, 345, 249],  ancho: 32 },   // simétrica
    air_fryer:          { archivo: 'dispositivos/air_fryer.png',          tam: [182, 196], caja: [33, 16, 150, 169],  ancho: 24 },   // mira u
    plancha:            { archivo: 'dispositivos/plancha.png',            tam: [275, 294], caja: [15, 12, 269, 267],  ancho: 32 },   // casi simétrica
    router:             { archivo: 'dispositivos/router.png',             tam: [349, 304], caja: [63, 26, 296, 288],  ancho: 30 },   // mira v
    portatil_der:       { archivo: 'dispositivos/portatil_der.png',       tam: [102, 95],  caja: [12, 2, 95, 86],     ancho: 30 },   // mira u
    consola_der:        { archivo: 'dispositivos/consola_der.png',        tam: [127, 93],  caja: [4, 2, 120, 86],     ancho: 32 },   // mira u
    impresora_izq:      { archivo: 'dispositivos/impresora_izq.png',      tam: [108, 103], caja: [15, 8, 98, 92],     ancho: 34 },   // mira v
    bascula_cocina_izq: { archivo: 'dispositivos/bascula_cocina_izq.png', tam: [93, 72],   caja: [11, 3, 84, 63],     ancho: 24 },   // mira v
    lavadora:           { archivo: 'dispositivos/lavadora.png',           tam: [141, 197], caja: [9, 22, 128, 178],   ancho: 46 },   // mira u
    ventilador:         { archivo: 'dispositivos/ventilador.png',         tam: [119, 189], caja: [30, 16, 90, 162],   ancho: 26 },   // simétrico
    calentador:         { archivo: 'dispositivos/calentador.png',         tam: [308, 349], caja: [56, 14, 267, 308],  ancho: 32 },   // mira v
    aspiradora:         { archivo: 'dispositivos/aspiradora.png',         tam: [492, 452], caja: [57, 31, 387, 420],  ancho: 36 },   // simétrica
    horno:              { archivo: 'dispositivos/horno.png',              tam: [441, 429], caja: [74, 8, 405, 414],   ancho: 48 },   // mira u

    // Dispositivos recortados de las láminas generadas (Gemini). Cada dibujo se guarda como <nombre>_u (su frente mira a +u) o <nombre>_v
    // (mira a +v); si solo existe uno, el motor lo refleja para el otro lado. Ya vienen recortados al borde (caja = todo el PNG).
    // 'altura' (solo los de pared) = a cuántos px sobre el suelo cuelga el dibujo.
    batidora_u: { archivo: 'dispositivos/batidora_u.png', tam: [101, 200], caja: [0, 0, 101, 200], ancho: 18 },   // mira u
    batidora_v: { archivo: 'dispositivos/batidora_v.png', tam: [102, 200], caja: [0, 0, 102, 200], ancho: 18 },   // mira v
    cafetera_u: { archivo: 'dispositivos/cafetera_u.png', tam: [130, 200], caja: [0, 0, 130, 200], ancho: 26 },   // mira u
    cafetera_v: { archivo: 'dispositivos/cafetera_v.png', tam: [130, 200], caja: [0, 0, 130, 200], ancho: 26 },   // mira v
    molino_u: { archivo: 'dispositivos/molino_u.png', tam: [98, 200], caja: [0, 0, 98, 200], ancho: 16 },   // mira u
    hervidor_u: { archivo: 'dispositivos/hervidor_u.png', tam: [141, 200], caja: [0, 0, 141, 200], ancho: 20 },   // mira u
    arrocera_u: { archivo: 'dispositivos/arrocera_u.png', tam: [190, 200], caja: [0, 0, 190, 200], ancho: 28 },   // mira u
    arrocera_v: { archivo: 'dispositivos/arrocera_v.png', tam: [194, 200], caja: [0, 0, 194, 200], ancho: 28 },   // mira v
    crockpot_u: { archivo: 'dispositivos/crockpot_u.png', tam: [200, 186], caja: [0, 0, 200, 186], ancho: 34 },   // mira u
    crockpot_v: { archivo: 'dispositivos/crockpot_v.png', tam: [200, 185], caja: [0, 0, 200, 185], ancho: 34 },   // mira v
    procesador_u: { archivo: 'dispositivos/procesador_u.png', tam: [128, 200], caja: [0, 0, 128, 200], ancho: 26 },   // mira u
    procesador_v: { archivo: 'dispositivos/procesador_v.png', tam: [124, 200], caja: [0, 0, 124, 200], ancho: 26 },   // mira v
    exprimidor_u: { archivo: 'dispositivos/exprimidor_u.png', tam: [121, 200], caja: [0, 0, 121, 200], ancho: 22 },   // mira u
    extractor_u: { archivo: 'dispositivos/extractor_u.png', tam: [157, 200], caja: [0, 0, 157, 200], ancho: 30 },   // mira u
    extractor_v: { archivo: 'dispositivos/extractor_v.png', tam: [157, 200], caja: [0, 0, 157, 200], ancho: 30 },   // mira v
    panificadora_u: { archivo: 'dispositivos/panificadora_u.png', tam: [155, 200], caja: [0, 0, 155, 200], ancho: 30 },   // mira u
    panificadora_v: { archivo: 'dispositivos/panificadora_v.png', tam: [155, 200], caja: [0, 0, 155, 200], ancho: 30 },   // mira v
    hielo_u: { archivo: 'dispositivos/hielo_u.png', tam: [131, 200], caja: [0, 0, 131, 200], ancho: 28 },   // mira u
    hielo_v: { archivo: 'dispositivos/hielo_v.png', tam: [131, 200], caja: [0, 0, 131, 200], ancho: 28 },   // mira v
    cuchillo_u: { archivo: 'dispositivos/cuchillo_u.png', tam: [200, 106], caja: [0, 0, 200, 106], ancho: 30 },   // mira u
    abrelatas_u: { archivo: 'dispositivos/abrelatas_u.png', tam: [80, 114], caja: [0, 0, 80, 114], ancho: 22 },   // mira u
    abrelatas_v: { archivo: 'dispositivos/abrelatas_v.png', tam: [80, 115], caja: [0, 0, 80, 115], ancho: 22 },   // mira v
    triturador_u: { archivo: 'dispositivos/triturador_u.png', tam: [96, 144], caja: [0, 0, 96, 144], ancho: 26 },   // mira u
    envasadora_u: { archivo: 'dispositivos/envasadora_u.png', tam: [132, 93], caja: [0, 0, 132, 93], ancho: 34 },   // mira u
    lavavajillas_u: { archivo: 'dispositivos/lavavajillas_u.png', tam: [155, 200], caja: [0, 0, 155, 200], ancho: 44 },   // mira u
    lavavajillas_v: { archivo: 'dispositivos/lavavajillas_v.png', tam: [156, 200], caja: [0, 0, 156, 200], ancho: 44 },   // mira v
    congelador_u: { archivo: 'dispositivos/congelador_u.png', tam: [112, 200], caja: [0, 0, 112, 200], ancho: 42 },   // mira u
    congelador_v: { archivo: 'dispositivos/congelador_v.png', tam: [112, 200], caja: [0, 0, 112, 200], ancho: 42 },   // mira v
    campana_u: { archivo: 'dispositivos/campana_u.png', tam: [151, 200], caja: [0, 0, 151, 200], ancho: 40, altura: 60 },   // mira u
    campana_v: { archivo: 'dispositivos/campana_v.png', tam: [152, 200], caja: [0, 0, 152, 200], ancho: 40, altura: 60 },   // mira v
    vinoteca_u: { archivo: 'dispositivos/vinoteca_u.png', tam: [141, 200], caja: [0, 0, 141, 200], ancho: 38 },   // mira u
    vinoteca_v: { archivo: 'dispositivos/vinoteca_v.png', tam: [141, 200], caja: [0, 0, 141, 200], ancho: 38 },   // mira v
    esterilizador_u: { archivo: 'dispositivos/esterilizador_u.png', tam: [75, 111], caja: [0, 0, 75, 111], ancho: 24 },   // mira u
    secadora_u: { archivo: 'dispositivos/secadora_u.png', tam: [145, 200], caja: [0, 0, 145, 200], ancho: 46 },   // mira u
    secadora_v: { archivo: 'dispositivos/secadora_v.png', tam: [145, 200], caja: [0, 0, 145, 200], ancho: 46 },   // mira v
    lavasecadora_u: { archivo: 'dispositivos/lavasecadora_u.png', tam: [146, 200], caja: [0, 0, 146, 200], ancho: 46 },   // mira u
    lavasecadora_v: { archivo: 'dispositivos/lavasecadora_v.png', tam: [146, 200], caja: [0, 0, 146, 200], ancho: 46 },   // mira v
    coser_u: { archivo: 'dispositivos/coser_u.png', tam: [101, 132], caja: [0, 0, 101, 132], ancho: 34 },   // mira u
    coser_v: { archivo: 'dispositivos/coser_v.png', tam: [101, 119], caja: [0, 0, 101, 119], ancho: 34 },   // mira v
    planchado_u: { archivo: 'dispositivos/planchado_u.png', tam: [109, 104], caja: [0, 0, 109, 104], ancho: 34 },   // mira u
    planchado_v: { archivo: 'dispositivos/planchado_v.png', tam: [108, 104], caja: [0, 0, 108, 104], ancho: 34 },   // mira v
    mopa_u: { archivo: 'dispositivos/mopa_u.png', tam: [90, 200], caja: [0, 0, 90, 200], ancho: 22 },   // mira u
    robot_u: { archivo: 'dispositivos/robot_u.png', tam: [122, 91], caja: [0, 0, 122, 91], ancho: 30 },   // mira u
    secador_u: { archivo: 'dispositivos/secador_u.png', tam: [109, 108], caja: [0, 0, 109, 108], ancho: 26 },   // mira u
    secador_v: { archivo: 'dispositivos/secador_v.png', tam: [111, 109], caja: [0, 0, 111, 109], ancho: 26 },   // mira v
    plancha_pelo_u: { archivo: 'dispositivos/plancha_pelo_u.png', tam: [123, 105], caja: [0, 0, 123, 105], ancho: 28 },   // mira u
    plancha_pelo_v: { archivo: 'dispositivos/plancha_pelo_v.png', tam: [122, 103], caja: [0, 0, 122, 103], ancho: 28 },   // mira v
    depiladora_u: { archivo: 'dispositivos/depiladora_u.png', tam: [53, 92], caja: [0, 0, 53, 92], ancho: 15 },   // mira u
    cepillo_u: { archivo: 'dispositivos/cepillo_u.png', tam: [41, 121], caja: [0, 0, 41, 121], ancho: 12 },   // mira u
    irrigador_u: { archivo: 'dispositivos/irrigador_u.png', tam: [64, 112], caja: [0, 0, 64, 112], ancho: 18 },   // mira u
    bascula_bano_u: { archivo: 'dispositivos/bascula_bano_u.png', tam: [127, 74], caja: [0, 0, 127, 74], ancho: 28 },   // mira u
    masajeador_u: { archivo: 'dispositivos/masajeador_u.png', tam: [93, 89], caja: [0, 0, 93, 89], ancho: 20 },   // mira u
    tensiometro_u: { archivo: 'dispositivos/tensiometro_u.png', tam: [122, 86], caja: [0, 0, 122, 86], ancho: 24 },   // mira u
    cortaunas_u: { archivo: 'dispositivos/cortaunas_u.png', tam: [163, 200], caja: [0, 0, 163, 200], ancho: 16 },   // mira u
    cortaunas_v: { archivo: 'dispositivos/cortaunas_v.png', tam: [155, 200], caja: [0, 0, 155, 200], ancho: 16 },   // mira v
    cargador_u: { archivo: 'dispositivos/cargador_u.png', tam: [95, 136], caja: [0, 0, 95, 136], ancho: 14 },   // mira u
    monitor_u: { archivo: 'dispositivos/monitor_u.png', tam: [129, 148], caja: [0, 0, 129, 148], ancho: 30 },   // mira u
    monitor_v: { archivo: 'dispositivos/monitor_v.png', tam: [112, 162], caja: [0, 0, 112, 162], ancho: 30 },   // mira v
    manta_u: { archivo: 'dispositivos/manta_u.png', tam: [131, 103], caja: [0, 0, 131, 103], ancho: 40 },   // mira u
    decodificador_u: { archivo: 'dispositivos/decodificador_u.png', tam: [112, 83], caja: [0, 0, 112, 83], ancho: 28 },   // mira u
    decodificador_v: { archivo: 'dispositivos/decodificador_v.png', tam: [112, 81], caja: [0, 0, 112, 81], ancho: 28 },   // mira v
    equipo_sonido_u: { archivo: 'dispositivos/equipo_sonido_u.png', tam: [134, 132], caja: [0, 0, 134, 132], ancho: 34 },   // mira u
    equipo_sonido_v: { archivo: 'dispositivos/equipo_sonido_v.png', tam: [108, 133], caja: [0, 0, 108, 133], ancho: 34 },   // mira v
    barra_sonido_u: { archivo: 'dispositivos/barra_sonido_u.png', tam: [132, 87], caja: [0, 0, 132, 87], ancho: 40 },   // mira u
    barra_sonido_v: { archivo: 'dispositivos/barra_sonido_v.png', tam: [132, 88], caja: [0, 0, 132, 88], ancho: 40 },   // mira v
    asistente_u: { archivo: 'dispositivos/asistente_u.png', tam: [81, 89], caja: [0, 0, 81, 89], ancho: 16 },   // mira u
    proyector_u: { archivo: 'dispositivos/proyector_u.png', tam: [130, 99], caja: [0, 0, 130, 99], ancho: 32 },   // mira u
    proyector_v: { archivo: 'dispositivos/proyector_v.png', tam: [130, 99], caja: [0, 0, 130, 99], ancho: 32 },   // mira v
    ac_split_u: { archivo: 'dispositivos/ac_split_u.png', tam: [200, 171], caja: [0, 0, 200, 171], ancho: 44, altura: 62 },   // mira u
    ac_split_v: { archivo: 'dispositivos/ac_split_v.png', tam: [200, 154], caja: [0, 0, 200, 154], ancho: 44, altura: 62 },   // mira v
    ac_portatil_v: { archivo: 'dispositivos/ac_portatil_v.png', tam: [132, 200], caja: [0, 0, 132, 200], ancho: 30 },   // mira v
    purificador_u: { archivo: 'dispositivos/purificador_u.png', tam: [98, 200], caja: [0, 0, 98, 200], ancho: 22 },   // mira u
    purificador_v: { archivo: 'dispositivos/purificador_v.png', tam: [98, 200], caja: [0, 0, 98, 200], ancho: 22 },   // mira v
    deshumidificador_u: { archivo: 'dispositivos/deshumidificador_u.png', tam: [130, 200], caja: [0, 0, 130, 200], ancho: 28 },   // mira u
    deshumidificador_v: { archivo: 'dispositivos/deshumidificador_v.png', tam: [130, 200], caja: [0, 0, 130, 200], ancho: 28 },   // mira v
    humidificador_u: { archivo: 'dispositivos/humidificador_u.png', tam: [135, 200], caja: [0, 0, 135, 200], ancho: 20 },   // mira u
    fuente_mascotas_u: { archivo: 'dispositivos/fuente_mascotas_u.png', tam: [189, 155], caja: [0, 0, 189, 155], ancho: 32 },   // mira u
    fuente_mascotas_v: { archivo: 'dispositivos/fuente_mascotas_v.png', tam: [188, 185], caja: [0, 0, 188, 185], ancho: 32 },   // mira v
    arenero_v: { archivo: 'dispositivos/arenero_v.png', tam: [195, 187], caja: [0, 0, 195, 187], ancho: 34 },   // mira v
    dispensador_v: { archivo: 'dispositivos/dispensador_v.png', tam: [136, 200], caja: [0, 0, 136, 200], ancho: 22 },   // mira v
    camara_u: { archivo: 'dispositivos/camara_u.png', tam: [107, 85], caja: [0, 0, 107, 85], ancho: 24, altura: 76 },   // mira u
    camara_v: { archivo: 'dispositivos/camara_v.png', tam: [106, 85], caja: [0, 0, 106, 85], ancho: 24, altura: 76 },   // mira v
    cortacesped_v: { archivo: 'dispositivos/cortacesped_v.png', tam: [158, 200], caja: [0, 0, 158, 200], ancho: 40 },   // mira v
    desbrozadora_u: { archivo: 'dispositivos/desbrozadora_u.png', tam: [168, 200], caja: [0, 0, 168, 200], ancho: 26 },   // mira u
    hidrolavadora_u: { archivo: 'dispositivos/hidrolavadora_u.png', tam: [123, 200], caja: [0, 0, 123, 200], ancho: 28 },   // mira u
    hidrolavadora_v: { archivo: 'dispositivos/hidrolavadora_v.png', tam: [121, 200], caja: [0, 0, 121, 200], ancho: 28 },   // mira v
    soplador_u: { archivo: 'dispositivos/soplador_u.png', tam: [121, 90], caja: [0, 0, 121, 90], ancho: 30 },   // mira u
    soplador_v: { archivo: 'dispositivos/soplador_v.png', tam: [122, 91], caja: [0, 0, 122, 91], ancho: 30 },   // mira v
    taladro_u: { archivo: 'dispositivos/taladro_u.png', tam: [84, 113], caja: [0, 0, 84, 113], ancho: 18 },   // mira u
    taladro_v: { archivo: 'dispositivos/taladro_v.png', tam: [84, 113], caja: [0, 0, 84, 113], ancho: 18 },   // mira v
    bomba_u: { archivo: 'dispositivos/bomba_u.png', tam: [122, 101], caja: [0, 0, 122, 101], ancho: 30 },   // mira u
    bomba_v: { archivo: 'dispositivos/bomba_v.png', tam: [122, 101], caja: [0, 0, 122, 101], ancho: 30 },   // mira v

    avatar_quieto_der:   { archivo: 'avatars/jero_quieto_der_abajo.png',    tam: [184, 263], caja: [49, 9, 144, 242] },
    avatar_quieto_izq:   { archivo: 'avatars/jero_quieto_izq_abajo.png',    tam: [163, 244], caja: [36, 3, 131, 235] },
    avatar_quieto_atras: { archivo: 'avatars/jero_espaldas_arriba.png',     tam: [154, 235], caja: [23, 0, 117, 232] },
    avatar_cam_der:      { archivo: 'avatars/jero_caminando_der_abajo.png', tam: [187, 266], caja: [24, 11, 139, 248] },
    avatar_cam_izq:      { archivo: 'avatars/jero_caminando_izq_abajo.png', tam: [177, 264], caja: [38, 10, 135, 248] },
    avatar_cam_atras:    { archivo: 'avatars/jero_caminando_espaldas.png',  tam: [184, 262], caja: [34, 13, 149, 249] }
};

// Precarga: así las imágenes ya están listas cuando el avatar cambia de pose
Object.values(SPRITES).forEach(sprite => { new Image().src = RUTA_ASSETS + sprite.archivo; });

// ----------------------------------------------------
// 2. ESTADO DE LA CASA Y DEL AVATAR
// ----------------------------------------------------
let mundo = null;            // la casa construida: celdas, muebles, celdas bloqueadas y medidas
let escalaVista = 1;         // zoom con el que la casa cabe en pantalla
let teclasPresionadas = [];  // direcciones que el usuario mantiene pulsadas (la última manda)

const avatar = {
    x: 0, y: 0,              // posición en celdas (puede ser decimal mientras camina)
    direccion: [1, 0],       // hacia dónde mira: [1,0] abajo-derecha, [0,1] abajo-izquierda, etc.
    ruta: [],                // celdas pendientes por recorrer
    yaColocado: false,       // falso hasta que nace por primera vez en la casa
    elemento: null           // la <img> del avatar
};

// Los 4 pasos posibles, en orden horario (flecha arriba = arriba-derecha en pantalla)
const PASOS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const TECLAS_MOVIMIENTO = {
    ArrowUp: [0, -1],    w: [0, -1],
    ArrowRight: [1, 0],  d: [1, 0],
    ArrowDown: [0, 1],   s: [0, 1],
    ArrowLeft: [-1, 0],  a: [-1, 0]
};

function claveCelda(cx, cy) { return cx + ',' + cy; }

// ----------------------------------------------------
// 3. PROYECCIÓN: de celdas a píxeles y viceversa
// ----------------------------------------------------
// (u, v) son coordenadas de la rejilla; las esquinas de las celdas son números enteros.
// Mover +1 en u baja hacia la derecha; mover +1 en v baja hacia la izquierda.
function aPantalla(u, v) {
    return {
        x: (u - v) * ANCHO_CELDA / 2 + mundo.desfaseX,
        y: (u + v) * ALTO_CELDA / 2 + mundo.desfaseY
    };
}

// Hace el camino inverso: dado un punto de la pantalla, dice en qué celda cae
function aCelda(x, y) {
    const a = (x - mundo.desfaseX) / (ANCHO_CELDA / 2);   // u - v
    const b = (y - mundo.desfaseY) / (ALTO_CELDA / 2);    // u + v
    return { cx: Math.floor((a + b) / 2), cy: Math.floor((b - a) / 2) };
}

// Escala horizontal (sx) y vertical (sy) con la que se dibuja un sprite
function escalasDeSprite(sprite) {
    const sx = sprite.ancho / (sprite.caja[2] - sprite.caja[0]);
    return { sx, sy: sx * (sprite.estiramientoY || 1) };
}

// Huella de un mueble en celdas (du a lo largo de u, dv a lo largo de v) según sus medidas reales.
// Si el dibujo se refleja (espejo), los dos ejes se intercambian: lo que era largo en u pasa a serlo en v.
function huellaEnCeldas(sprite, espejo) {
    const [largoU, largoV] = sprite.medidas;
    const k = sprite.k || 1;
    const du = k * (espejo ? largoV : largoU) / METROS_POR_CELDA;
    const dv = k * (espejo ? largoU : largoV) / METROS_POR_CELDA;
    return { du, dv };
}

// Escala de un mueble:
//  - Horizontal: el ancho del dibujo es el de su huella en el suelo, (du + dv) x 48 px (el rombo de la huella).
//  - Vertical: SIEMPRE la que deja sus bordes con pendiente exacta 0.5, igual que el suelo y las paredes.
//    Si se estirara más para alcanzar una altura "real", sus bordes se inclinarían más que los de la pared
//    y se vería que no son paralelos. Por eso la altura sale del propio dibujo.
function escalasDeMueble(sprite, du, dv) {
    const anchoCaja = sprite.caja[2] - sprite.caja[0];
    const sx = (du + dv) * ANCHO_CELDA / 2 / anchoCaja;
    const pendienteDelDibujo = sprite.pendiente || 0.5;
    return { sx, sy: sx * 0.5 / pendienteDelDibujo };
}

// Coloca una imagen para que un punto suyo (el "ancla") caiga justo en (x, y) de la casa.
// ancla: 'centro-abajo', 'izq-abajo', 'der-abajo', 'centro-arriba' (puntos de la caja útil)
//        o 'punto' (el punto de contacto con el suelo que traen las paredes).
function colocarSprite(img, sprite, escalas, x, y, ancla, espejo) {
    const [anchoOriginal, altoOriginal] = sprite.tam;
    const [izq, arriba, der, abajo] = sprite.caja;
    // Si la imagen se refleja (espejo), su caja útil también se refleja
    const cajaIzq = espejo ? anchoOriginal - der : izq;
    const cajaDer = espejo ? anchoOriginal - izq : der;

    // Punto de la imagen ORIGINAL que debe caer en (x, y)
    let puntoX = (cajaIzq + cajaDer) / 2;
    if (ancla.startsWith('izq')) puntoX = cajaIzq;
    if (ancla.startsWith('der')) puntoX = cajaDer;
    let puntoY = ancla.endsWith('abajo') ? abajo : arriba;
    if (ancla === 'punto') [puntoX, puntoY] = sprite.punto;

    img.style.width = anchoOriginal * escalas.sx + 'px';
    img.style.height = altoOriginal * escalas.sy + 'px';
    img.style.left = (x - puntoX * escalas.sx) + 'px';
    img.style.top = (y - puntoY * escalas.sy) + 'px';
    img.style.transform = espejo ? 'scaleX(-1)' : 'none';
}

// ----------------------------------------------------
// 4. CONSTRUCCIÓN DE LA CASA (datos, sin dibujar todavía)
// ----------------------------------------------------
// El piso depende del nombre: las zonas húmedas llevan cerámica, el resto madera.
function elegirPiso(nombre) {
    const n = normalizarTexto(nombre);
    const zonasHumedas = ['cocina', 'bano', 'ropa', 'lavander'];
    return zonasHumedas.some(z => n.includes(z)) ? 'baldosa_ceramica' : 'baldosa_madera';
}

// MUEBLES: cada mueble puede dibujarse mirando hacia +u (derecha) o hacia +v (izquierda).
// Aquí se dice qué sprite usar para cada lado. Si falta uno, se usa el otro reflejado (espejo).
// Algunos dibujos se llaman "_der" o "_izq" pero lo que importa es hacia dónde miran (ver el comentario de SPRITES).
const MUEBLES = {
    nevera:        { u: 'nevera' },
    estufa:        { v: 'estufahorno_izq' },
    lavaplatos:    { u: 'lavaplatos_der' },
    meson:         { u: 'meson_recto' },
    mesa:          { u: 'mesa', v: 'mesa' },
    tele:          { v: 'tele_con_mueble' },
    sofa:          { u: 'sofa_u', v: 'sofa_v' },
    sillon:        { u: 'sillon_u', v: 'sillon_v' },
    sillon_espalda: { u: 'sillon_espalda_u', v: 'sillon_espalda_v' },   // aquí 'mira' = hacia qué pared mira el sillón
    mesa_centro:   { u: 'mesa_centro_v', v: 'mesa_centro_u' },   // la mesa de centro se coloca de lado respecto al sofá
    closet:        { u: 'closet_der', v: 'closet_izq' },
    escritorio_pc: { v: 'pc_con_mueble' },
    cama:          { u: 'cama_der', v: 'cama_izq' },
    mesita_noche:  { u: 'mesita_noche_der' },
    comoda:        { u: 'armario_peq_der', v: 'armario_peq_izq' },
    tina:          { v: 'tina_der', u: 'tina_izq' },
    ducha:         { u: 'ducha', v: 'ducha' },
    inodoro:       { u: 'inodoro_der' },
    lavamanos:     { v: 'lavamanos_der' },
    // Dispositivos (la clave es el campo `sprite` del catálogo)
    tostadora:     { u: 'tostadora_der' },
    licuadora:     { u: 'licuadora_der' },
    microondas:    { u: 'microondas' },
    sandwichera:   { u: 'sanduchera' },
    airfryer:      { u: 'air_fryer' },
    plancha:       { u: 'plancha' },
    router:        { v: 'router' },
    portatil:      { u: 'portatil_der' },
    consola:       { u: 'consola_der' },
    impresora:     { v: 'impresora_izq' },
    bascula:       { v: 'bascula_cocina_izq' },
    lavadora:      { u: 'lavadora' },
    ventilador:    { u: 'ventilador' },
    calefactor:    { v: 'calentador' },
    aspiradora:    { u: 'aspiradora' },
    horno:         { u: 'horno' },
    batidora: { u: 'batidora_u', v: 'batidora_v' },
    cafetera: { u: 'cafetera_u', v: 'cafetera_v' },
    molino: { u: 'molino_u' },
    hervidor: { u: 'hervidor_u' },
    arrocera: { u: 'arrocera_u', v: 'arrocera_v' },
    crockpot: { u: 'crockpot_u', v: 'crockpot_v' },
    procesador: { u: 'procesador_u', v: 'procesador_v' },
    exprimidor: { u: 'exprimidor_u' },
    extractor: { u: 'extractor_u', v: 'extractor_v' },
    panificadora: { u: 'panificadora_u', v: 'panificadora_v' },
    hielo: { u: 'hielo_u', v: 'hielo_v' },
    cuchillo: { u: 'cuchillo_u' },
    abrelatas: { u: 'abrelatas_u', v: 'abrelatas_v' },
    triturador: { u: 'triturador_u' },
    envasadora: { u: 'envasadora_u' },
    lavavajillas: { u: 'lavavajillas_u', v: 'lavavajillas_v' },
    congelador: { u: 'congelador_u', v: 'congelador_v' },
    campana: { u: 'campana_u', v: 'campana_v' },
    vinoteca: { u: 'vinoteca_u', v: 'vinoteca_v' },
    esterilizador: { u: 'esterilizador_u' },
    secadora: { u: 'secadora_u', v: 'secadora_v' },
    lavasecadora: { u: 'lavasecadora_u', v: 'lavasecadora_v' },
    coser: { u: 'coser_u', v: 'coser_v' },
    planchado: { u: 'planchado_u', v: 'planchado_v' },
    mopa: { u: 'mopa_u' },
    robot: { u: 'robot_u' },
    secador: { u: 'secador_u', v: 'secador_v' },
    plancha_pelo: { u: 'plancha_pelo_u', v: 'plancha_pelo_v' },
    depiladora: { u: 'depiladora_u' },
    cepillo: { u: 'cepillo_u' },
    irrigador: { u: 'irrigador_u' },
    bascula_bano: { u: 'bascula_bano_u' },
    masajeador: { u: 'masajeador_u' },
    tensiometro: { u: 'tensiometro_u' },
    cortaunas: { u: 'cortaunas_u', v: 'cortaunas_v' },
    cargador: { u: 'cargador_u' },
    monitor: { u: 'monitor_u', v: 'monitor_v' },
    manta: { u: 'manta_u' },
    decodificador: { u: 'decodificador_u', v: 'decodificador_v' },
    equipo_sonido: { u: 'equipo_sonido_u', v: 'equipo_sonido_v' },
    barra_sonido: { u: 'barra_sonido_u', v: 'barra_sonido_v' },
    asistente: { u: 'asistente_u' },
    proyector: { u: 'proyector_u', v: 'proyector_v' },
    ac_split: { u: 'ac_split_u', v: 'ac_split_v' },
    ac_portatil: { v: 'ac_portatil_v' },
    purificador: { u: 'purificador_u', v: 'purificador_v' },
    deshumidificador: { u: 'deshumidificador_u', v: 'deshumidificador_v' },
    humidificador: { u: 'humidificador_u' },
    fuente_mascotas: { u: 'fuente_mascotas_u', v: 'fuente_mascotas_v' },
    arenero: { v: 'arenero_v' },
    dispensador: { v: 'dispensador_v' },
    camara: { u: 'camara_u', v: 'camara_v' },
    cortacesped: { v: 'cortacesped_v' },
    desbrozadora: { u: 'desbrozadora_u' },
    hidrolavadora: { u: 'hidrolavadora_u', v: 'hidrolavadora_v' },
    soplador: { u: 'soplador_u', v: 'soplador_v' },
    taladro: { u: 'taladro_u', v: 'taladro_v' },
    bomba: { u: 'bomba_u', v: 'bomba_v' }
};

// Muebles de decoración que a la vez son un dispositivo del catálogo: al instalar ese dispositivo, el mismo dibujo
// reacciona (brillo y ficha). Sin instalar, solo es decoración. Valor = id del dispositivo en catalogo.js.
const DISPOSITIVO_DE_MUEBLE = { nevera: 0, estufa: 23, tele: 5, escritorio_pc: 11 };

// PLANTILLAS de cada tipo de habitación. El orden es la prioridad: lo primero que se escribe es lo que más importa.
//  - pared 'atras': contra la pared trasera derecha (y = 0), el mueble mira hacia +v y se reparte a lo largo de x.
//  - pared 'izquierda': contra la pared trasera izquierda (x = 0), mira hacia +u y se reparte a lo largo de y.
//  - opciones: grupos de muebles que van seguidos en la pared, del más completo al más sencillo. Se usa el primero que
//    cabe (por ejemplo "mesita + cama + mesita" y, si no hay sitio, solo "cama").
//  - desde: la pared empieza a llenarse a partir de esa posición, si así todavía cabe (sirve para no quedar detrás de algo alto).
//  - libre: [x, y] posición fija en el interior (en celdas). Se mantienen dentro de 1 a 3 para no tapar las puertas.
const PLANTILLAS = {
    cocina: [
        { mueble: 'nevera', pared: 'atras' },
        { mueble: 'estufa', pared: 'atras' },
        { mueble: 'lavaplatos', pared: 'atras' },
        { mueble: 'meson', libre: [2.2, 1.2], mira: 'u' },       // isla de cocina
        { mueble: 'mesa', libre: [1.05, 1.3] }
    ],
    sala: [
        { mueble: 'tele', pared: 'atras', desde: 1.3 },
        { mueble: 'sofa', pared: 'izquierda' },
        { mueble: 'mesa_centro', libre: [1.45, 1.1], mira: 'v' },
        { mueble: 'sillon_espalda', libre: [1.2, 2.0], mira: 'v' },    // los dos sillones miran hacia la TV
        { mueble: 'sillon_espalda', libre: [2.08, 2.0], mira: 'v' }
    ],
    habitacion: [
        { pared: 'izquierda', opciones: [['mesita_noche', 'cama', 'mesita_noche'], ['cama']] },
        { mueble: 'comoda', pared: 'izquierda' },
        { mueble: 'closet', pared: 'atras' },
        { mueble: 'escritorio_pc', pared: 'atras' }
    ],
    estudio: [
        { mueble: 'escritorio_pc', pared: 'izquierda' },
        { mueble: 'closet', pared: 'atras' },
        { mueble: 'comoda', pared: 'atras' }
    ],
    bano: [   // el baño es grande: dos lavamanos con el inodoro en medio, dos duchas y la tina de patas exenta en el centro
        { mueble: 'lavamanos', pared: 'atras', desde: 0.95 },   // empieza pasada la ducha, que es alta y taparía los sanitarios
        { mueble: 'inodoro', pared: 'atras' },
        { mueble: 'lavamanos', pared: 'atras' },
        { pared: 'izquierda', opciones: [['ducha', 'ducha'], ['ducha']] },
        { mueble: 'tina', libre: [1.35, 1.4], mira: 'v' }
    ]
};

// Qué plantilla usa una habitación según su nombre (sin tildes ni mayúsculas)
function elegirPlantilla(nombre) {
    const n = normalizarTexto(nombre);
    if (n.includes('cocina')) return PLANTILLAS.cocina;
    if (n.includes('sala')) return PLANTILLAS.sala;
    if (n.includes('habitacion') || n.includes('dormitorio') || n.includes('cuarto')) return PLANTILLAS.habitacion;
    if (n.includes('estudio') || n.includes('oficina')) return PLANTILLAS.estudio;
    if (n.includes('bano')) return PLANTILLAS.bano;
    return [];
}

// Elige el sprite de un mueble para que mire hacia 'mira' ('u' o 'v'); si solo existe el otro lado, lo refleja
function elegirVersion(mueble, mira) {
    const versiones = MUEBLES[mueble];
    if (versiones[mira]) return { sprite: versiones[mira], espejo: false };
    return { sprite: versiones[mira === 'u' ? 'v' : 'u'], espejo: true };
}

// Reparte los muebles de una plantilla por las paredes de la habitación.
// El problema: si una pared trasera tiene otra habitación al otro lado, ahí va una puerta de 2 celdas y debe quedar libre.
// La solución: en esas paredes los muebles se juntan desde la esquina y solo se usan las primeras 2 celdas;
// el grupo que ya no cabe se omite (por eso el orden de la plantilla es la prioridad).
const LIMITE_PARED_CON_PUERTA = 2.12;   // un poco más de 2 celdas: un mueble puede rozar la puerta sin estorbar
const LIMITE_PARED_LIBRE = 3.95;
const SEPARACION = 0.01;                // hueco entre muebles vecinos, en celdas

// Datos de un mueble puesto contra una pared: qué sprite mira hacia el cuarto y cuánto ocupa a lo largo de la pared
function mueblePegadoAPared(mueble, nombrePared) {
    const version = elegirVersion(mueble, nombrePared === 'atras' ? 'v' : 'u');
    const huella = huellaEnCeldas(SPRITES[version.sprite], version.espejo);
    return {
        ...version, mueble, mira: nombrePared === 'atras' ? 'v' : 'u',
        largo: nombrePared === 'atras' ? huella.du : huella.dv,     // lo que ocupa a lo largo de la pared
        fondo: nombrePared === 'atras' ? huella.dv : huella.du      // lo que se separa de la pared
    };
}

function distribuirMuebles(plantilla, hayPuertaAtras, hayPuertaIzquierda) {
    const resultado = [];
    const paredes = {
        atras:     { cursor: 0.02, conPuerta: hayPuertaAtras,     fondo: 0 },
        izquierda: { cursor: 0.02, conPuerta: hayPuertaIzquierda, fondo: 0 }
    };

    // Primero la pared trasera derecha (se queda con la esquina) y después la izquierda, que empieza donde acaba el fondo de la primera
    ['atras', 'izquierda'].forEach(nombrePared => {
        const pared = paredes[nombrePared];
        const limite = pared.conPuerta ? LIMITE_PARED_CON_PUERTA : LIMITE_PARED_LIBRE;
        if (nombrePared === 'izquierda' && paredes.atras.fondo > 0) pared.cursor = paredes.atras.fondo + 0.04;

        plantilla.filter(item => item.pared === nombrePared).forEach(item => {
            // Primer grupo de muebles que cabe en lo que queda de pared. Si el item pide empezar más adelante ('desde'),
            // se intenta así primero y, si no cabe, pegado a lo anterior.
            const opciones = item.opciones || [[item.mueble]];
            for (const grupo of opciones) {
                const piezas = grupo.map(nombre => mueblePegadoAPared(nombre, nombrePared));
                const total = piezas.reduce((suma, p) => suma + p.largo + SEPARACION, 0) - SEPARACION;
                const inicios = item.desde ? [Math.max(pared.cursor, item.desde), pared.cursor] : [pared.cursor];
                const inicio = inicios.find(i => i + total <= limite);
                if (inicio === undefined) continue;                        // este grupo no cabe: prueba uno más sencillo
                pared.cursor = inicio;

                piezas.forEach(p => {
                    resultado.push({
                        sprite: p.sprite, espejo: p.espejo, mueble: p.mueble, mira: p.mira, dispositivoId: DISPOSITIVO_DE_MUEBLE[p.mueble],
                        x: nombrePared === 'atras' ? pared.cursor : 0.02,
                        y: nombrePared === 'atras' ? 0.02 : pared.cursor
                    });
                    pared.cursor += p.largo + SEPARACION;
                    pared.fondo = Math.max(pared.fondo, p.fondo);
                });
                break;
            }
        });
    });

    // Muebles de posición fija en el interior
    plantilla.filter(item => item.libre).forEach(item => {
        const version = elegirVersion(item.mueble, item.mira || 'u');
        resultado.push({ sprite: version.sprite, espejo: version.espejo, mueble: item.mueble, mira: item.mira || 'u', dispositivoId: DISPOSITIVO_DE_MUEBLE[item.mueble], x: item.libre[0], y: item.libre[1] });
    });
    return resultado;
}

function mueblesDeHabitacion(nombre, hayPuertaAtras, hayPuertaIzquierda) {
    return distribuirMuebles(elegirPlantilla(nombre), hayPuertaAtras, hayPuertaIzquierda);
}

// Como las medidas son reales, un mueble no siempre ocupa celdas completas. Se mira cuánto cubre de cada una:
//  - bloqueadas: el avatar no puede entrar (el mueble cubre al menos el 10 % de la celda).
//  - tocadas: celdas que el mueble roza (6 % o más). Sirven para no abrir una puerta justo contra un mueble.
const CUBRIMIENTO_QUE_BLOQUEA = 0.10;
const CUBRIMIENTO_QUE_ESTORBA = 0.06;

function celdasDelMueble(mueble) {
    const bloqueadas = [], tocadas = [];
    for (let cy = Math.floor(mueble.y); cy < Math.ceil(mueble.y + mueble.dv); cy++) {
        for (let cx = Math.floor(mueble.x); cx < Math.ceil(mueble.x + mueble.du); cx++) {
            const anchoCubierto = Math.min(mueble.x + mueble.du, cx + 1) - Math.max(mueble.x, cx);
            const largoCubierto = Math.min(mueble.y + mueble.dv, cy + 1) - Math.max(mueble.y, cy);
            const cubierto = anchoCubierto * largoCubierto;
            if (cubierto >= CUBRIMIENTO_QUE_ESTORBA) tocadas.push([cx, cy]);
            if (cubierto >= CUBRIMIENTO_QUE_BLOQUEA) bloqueadas.push([cx, cy]);
        }
    }
    return { bloqueadas, tocadas };
}

// Cada paso entre dos celdas vecinas tiene una "clave" (dirección incluida) para poder bloquearlo
function clavePaso(x1, y1, x2, y2) { return x1 + ',' + y1 + '>' + x2 + ',' + y2; }

// Cada límite entre dos habitaciones lleva una puerta de 2 celdas. Se coloca donde no haya muebles
// en ninguno de los dos lados: primero en el centro y, si hay muebles, junto a una de las esquinas.
// Devuelve en qué posición (0 a 2) empieza la puerta y lo recuerda para todo el límite.
function posicionDePuerta(m, celda, vecina, borde) {
    const clave = [celda.habitacion, vecina.habitacion, borde].join('|');
    if (m.puertas.has(clave)) return m.puertas.get(clave);

    // Las 4 parejas de celdas que se enfrentan a lo largo del límite (una de cada habitación)
    const parejas = [];
    for (let i = 0; i < CELDAS_POR_LADO; i++) {
        parejas.push(borde === 'derecha'
            ? [claveCelda(celda.cx, celda.cy - celda.dy + i), claveCelda(vecina.cx, vecina.cy - celda.dy + i)]
            : [claveCelda(celda.cx - celda.dx + i, celda.cy), claveCelda(vecina.cx - celda.dx + i, vecina.cy)]);
    }
    const estaLibre = i => parejas[i].every(c => !m.ocupadas.has(c));
    const inicio = [1, 0, 2].find(i => estaLibre(i) && estaLibre(i + 1));
    const elegido = inicio === undefined ? 1 : inicio;   // si no hay sitio libre, vuelve al centro
    m.puertas.set(clave, elegido);
    [elegido, elegido + 1].forEach(i => parejas[i].forEach(c => m.celdasDePuerta.add(c)));
    return elegido;
}

// Si dos celdas vecinas son de habitaciones distintas, pone entre ellas una pared interior (salvo en la puerta)
// y bloquea el paso en los dos sentidos. 'borde' dice por dónde se tocan: 'derecha' o 'abajo'.
// La pared interior es la misma pieza que las exteriores, pero se dibuja casi transparente.
// Se asigna a la celda vecina, igual que una pared exterior: el borde izquierdo de 'vecina' (pared_izq) si se tocan
// a la derecha, o su borde trasero (pared_derecha) si se tocan hacia abajo.
function separarHabitaciones(mundoNuevo, celda, vecina, borde) {
    const posicionEnLimite = borde === 'derecha' ? celda.dy : celda.dx;
    const inicioPuerta = posicionDePuerta(mundoNuevo, celda, vecina, borde);
    if (posicionEnLimite === inicioPuerta || posicionEnLimite === inicioPuerta + 1) return;   // aquí va la puerta

    mundoNuevo.paredesInteriores.push({
        sprite: borde === 'derecha' ? 'pared_izq' : 'pared_derecha',
        cx: vecina.cx, cy: vecina.cy
    });
    mundoNuevo.pasosBloqueados.add(clavePaso(celda.cx, celda.cy, vecina.cx, vecina.cy));
    mundoNuevo.pasosBloqueados.add(clavePaso(vecina.cx, vecina.cy, celda.cx, celda.cy));
}

function construirMundo() {
    const nuevo = {
        celdas: new Map(), bloqueadas: new Set(), pasosBloqueados: new Set(),
        ocupadas: new Set(),          // celdas que algún mueble roza (para elegir dónde van las puertas)
        celdasDePuerta: new Set(),    // celdas a ambos lados de cada puerta (ningún dispositivo de suelo se pone ahí)
        puertas: new Map(),           // posición elegida de la puerta de cada límite entre habitaciones
        paredesInteriores: [],        // paredes translúcidas entre habitaciones
        muebles: [], habitaciones: [], desfaseX: 0, desfaseY: 0, ancho: 0, alto: 0
    };

    // Las habitaciones se acomodan en una cuadrícula casi cuadrada: 1, 2, 3 (en "L"), 4...
    const columnas = Math.ceil(Math.sqrt(habitacionesCreadas.length));
    const origenes = habitacionesCreadas.map((_, i) => ({
        x: (i % columnas) * CELDAS_POR_LADO,
        y: Math.floor(i / columnas) * CELDAS_POR_LADO
    }));
    const hayHabitacionEn = (x, y) => origenes.some(o => o.x === x && o.y === y);

    habitacionesCreadas.forEach((nombre, i) => {
        const origenX = origenes[i].x;
        const origenY = origenes[i].y;
        const piso = elegirPiso(nombre);

        for (let dy = 0; dy < CELDAS_POR_LADO; dy++) {
            for (let dx = 0; dx < CELDAS_POR_LADO; dx++) {
                const cx = origenX + dx, cy = origenY + dy;
                // dx y dy: posición de la celda dentro de su habitación (0 a 3)
                nuevo.celdas.set(claveCelda(cx, cy), { cx, cy, dx, dy, piso, habitacion: nombre });
            }
        }

        // Una pared trasera con otra habitación al otro lado necesita dejar libre el sitio de la puerta
        const hayPuertaAtras = hayHabitacionEn(origenX, origenY - CELDAS_POR_LADO);
        const hayPuertaIzquierda = hayHabitacionEn(origenX - CELDAS_POR_LADO, origenY);

        mueblesDeHabitacion(nombre, hayPuertaAtras, hayPuertaIzquierda).forEach(m => {
            const huella = huellaEnCeldas(SPRITES[m.sprite], m.espejo);
            const mueble = { ...m, habitacion: nombre, x: origenX + m.x, y: origenY + m.y, du: huella.du, dv: huella.dv };
            nuevo.muebles.push(mueble);
            const { bloqueadas, tocadas } = celdasDelMueble(mueble);
            bloqueadas.forEach(([cx, cy]) => nuevo.bloqueadas.add(claveCelda(cx, cy)));
            tocadas.forEach(([cx, cy]) => nuevo.ocupadas.add(claveCelda(cx, cy)));
        });

        nuevo.habitaciones.push({ nombre, origenX, origenY, puertaAtras: hayPuertaAtras, puertaIzquierda: hayPuertaIzquierda });
    });

    // Divisores entre habitaciones vecinas (a la derecha y hacia abajo de cada celda)
    nuevo.celdas.forEach(celda => {
        const derecha = nuevo.celdas.get(claveCelda(celda.cx + 1, celda.cy));
        const abajo = nuevo.celdas.get(claveCelda(celda.cx, celda.cy + 1));
        if (derecha && derecha.habitacion !== celda.habitacion) separarHabitaciones(nuevo, celda, derecha, 'derecha');
        if (abajo && abajo.habitacion !== celda.habitacion) separarHabitaciones(nuevo, celda, abajo, 'abajo');
    });

    calcularMedidas(nuevo);
    return nuevo;
}

// Calcula el tamaño total de la casa en píxeles y cuánto hay que desplazarla para que nada quede en negativo
function calcularMedidas(m) {
    if (m.celdas.size === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    m.celdas.forEach(c => {
        minX = Math.min(minX, (c.cx - (c.cy + 1)) * ANCHO_CELDA / 2);   // vértice izquierdo del rombo
        maxX = Math.max(maxX, ((c.cx + 1) - c.cy) * ANCHO_CELDA / 2);   // vértice derecho
        minY = Math.min(minY, (c.cx + c.cy) * ALTO_CELDA / 2);          // vértice superior
        maxY = Math.max(maxY, (c.cx + c.cy + 2) * ALTO_CELDA / 2);      // vértice inferior
    });
    m.desfaseX = -minX;
    m.desfaseY = -minY + ESPACIO_SOBRE_SUELO;
    m.ancho = maxX - minX;
    m.alto = maxY - minY + ESPACIO_SOBRE_SUELO + 16;
}

function esCeldaCaminable(cx, cy) {
    const clave = claveCelda(cx, cy);
    return mundo.celdas.has(clave) && !mundo.bloqueadas.has(clave);
}

// Un paso es posible si la celda de destino está libre y no hay un panel de cristal en medio
function puedeMoverse(desdeX, desdeY, hastaX, hastaY) {
    return esCeldaCaminable(hastaX, hastaY) && !mundo.pasosBloqueados.has(clavePaso(desdeX, desdeY, hastaX, hastaY));
}

// ----------------------------------------------------
// 5. DIBUJO DE LA CASA
// ----------------------------------------------------
// 'escalas' es opcional: los muebles traen la suya (escalasDeMueble); el resto usa la del sprite.
function agregarSprite(contenedor, nombre, x, y, ancla, zIndex, espejo, escalas) {
    const sprite = SPRITES[nombre];
    const img = document.createElement('img');
    img.src = RUTA_ASSETS + sprite.archivo;
    img.className = 'sprite-casa';
    img.alt = '';
    img.draggable = false;
    img.dataset.sprite = nombre;
    colocarSprite(img, sprite, escalas || escalasDeSprite(sprite), x, y, ancla, espejo);
    img.style.zIndex = zIndex;
    contenedor.appendChild(img);
    return img;
}

// Grosor del piso: una franja continua por los bordes de adelante de la casa, del mismo grosor en todas partes.
// Un borde queda a la vista cuando la celda no tiene vecina por ese lado.
const GROSOR_PISO = 7;

function dibujarGrosorDelSuelo(contenedor) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'grosor-piso');
    svg.setAttribute('width', mundo.ancho);
    svg.setAttribute('height', mundo.alto);
    svg.style.zIndex = 0;

    // Un paralelogramo bajo el borde que va de 'a' a 'b' (puntos en pantalla)
    const lado = (a, b, color) => {
        const puntos = `${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y + GROSOR_PISO} ${a.x},${a.y + GROSOR_PISO}`;
        return `<polygon points="${puntos}" fill="${color}"/>`;
    };

    let dibujo = '';
    mundo.celdas.forEach(c => {
        const [colorIzquierdo, colorDerecho] = SPRITES[c.piso].colorLados;
        const izquierda = aPantalla(c.cx, c.cy + 1);       // vértice izquierdo del rombo
        const abajo = aPantalla(c.cx + 1, c.cy + 1);       // vértice de abajo
        const derecha = aPantalla(c.cx + 1, c.cy);         // vértice derecho
        if (!mundo.celdas.has(claveCelda(c.cx, c.cy + 1))) dibujo += lado(izquierda, abajo, colorIzquierdo);
        if (!mundo.celdas.has(claveCelda(c.cx + 1, c.cy))) dibujo += lado(abajo, derecha, colorDerecho);
    });
    svg.innerHTML = dibujo;
    contenedor.appendChild(svg);
}

// Convierte los 4 vértices de la cara (en píxeles del PNG original) en un recorte en porcentajes
function recorteDeCara(sprite) {
    const [anchoOriginal, altoOriginal] = sprite.tam;
    const puntos = sprite.cara.map(([x, y]) => `${(x / anchoOriginal * 100).toFixed(2)}% ${(y / altoOriginal * 100).toFixed(2)}%`);
    return `polygon(${puntos.join(', ')})`;
}

function dibujarSuelo(contenedor) {
    dibujarGrosorDelSuelo(contenedor);

    const celdas = Array.from(mundo.celdas.values());
    celdas.forEach(c => {
        const arriba = aPantalla(c.cx, c.cy);   // vértice superior del rombo
        const baldosa = agregarSprite(contenedor, c.piso, arriba.x, arriba.y, 'centro-arriba', 0);
        baldosa.style.clipPath = recorteDeCara(SPRITES[c.piso]);   // solo la cara de arriba, sin su grosor
    });
}

// Regla de las paredes: si a una celda le falta vecina hacia atrás, hay pared en ese borde.
// Así la casa se ve "abierta" por delante y funciona con cualquier forma de casa.
//  - Si le falta vecina por los dos lados es la esquina: ahí va la pieza esquinera (así no se superponen).
//  - Cada pieza trae una "tapa" de grosor en un extremo. Se dibujan de modo que la pieza vecina quede
//    encima y la tape (la profundidad crece alejándose de la esquina), y solo se ve la tapa del final de la pared.
const ADELANTO_PARED_DERECHA = 12.5;   // la esquinera tiene el brazo derecho más corto: la primera pieza se acerca para cubrir ese hueco

// Las paredes exteriores son de dos pisos: se apila otra pieza encima de la primera. Así los muebles altos
// (nevera, closet, ducha) no sobresalen de la pared. La pieza trae una cornisa arriba y un zócalo abajo: al apilarlas
// forman una moldura entre pisos. Las paredes interiores (translúcidas) se quedan de un piso.
//  - ALTURA_PARED_PX: lo que mide una pared en vertical, de la base a la cornisa (medido en los PNG).
//  - SOLAPE_PISOS: un poco de traslape entre pisos para que no se vea una costura.
const PISOS_PAREDES_EXTERIORES = 2;
const ALTURA_PARED_PX = 52.5;
const SOLAPE_PISOS = 1.5;

function dibujarParedes(contenedor) {
    // Dibuja la pared de todos los pisos; las piezas de arriba usan la misma profundidad que la de abajo
    const levantarPared = (nombre, x, y, profundidad) => {
        for (let piso = 0; piso < PISOS_PAREDES_EXTERIORES; piso++) {
            agregarSprite(contenedor, nombre, x, y - piso * (ALTURA_PARED_PX - SOLAPE_PISOS), 'punto', profundidad);
        }
    };

    mundo.celdas.forEach(c => {
        const profundidad = (c.cx + c.cy) * 10 + 1;
        const faltaIzquierda = !mundo.celdas.has(claveCelda(c.cx - 1, c.cy));
        const faltaAtras = !mundo.celdas.has(claveCelda(c.cx, c.cy - 1));

        if (faltaIzquierda && faltaAtras) {
            const vertice = aPantalla(c.cx, c.cy);                       // vértice superior de la celda = vértice de la esquina
            levantarPared('pared_esquinera', vertice.x, vertice.y, profundidad);
        } else if (faltaIzquierda) {
            const extremo = aPantalla(c.cx, c.cy + 1);                   // extremo de abajo del borde izquierdo
            levantarPared('pared_izq', extremo.x, extremo.y, profundidad);
        } else if (faltaAtras) {
            const extremo = aPantalla(c.cx, c.cy);                       // extremo de arriba del borde trasero
            levantarPared('pared_derecha', extremo.x - ADELANTO_PARED_DERECHA, extremo.y - ADELANTO_PARED_DERECHA / 2, profundidad);
        }
    });
}

// Paredes entre habitaciones: son las mismas piezas que las paredes exteriores, pero casi transparentes
// (clase CSS 'pared-interior'). Así separan los espacios sin esconder lo que hay detrás.
// Se colocan igual que una pared exterior de su celda: ver dibujarParedes.
function dibujarParedesInteriores(contenedor) {
    mundo.paredesInteriores.forEach(p => {
        const profundidad = (p.cx + p.cy) * 10 + 1;
        let pared;
        if (p.sprite === 'pared_izq') {
            const extremo = aPantalla(p.cx, p.cy + 1);
            pared = agregarSprite(contenedor, 'pared_izq', extremo.x, extremo.y, 'punto', profundidad);
        } else {
            const extremo = aPantalla(p.cx, p.cy);
            pared = agregarSprite(contenedor, 'pared_derecha', extremo.x - ADELANTO_PARED_DERECHA, extremo.y - ADELANTO_PARED_DERECHA / 2, 'punto', profundidad);
        }
        pared.classList.add('pared-interior');
    });
}

// Cada mueble se apoya en el suelo por su huella real (du x dv celdas) y mide lo que miden sus medidas reales.
function dibujarMuebles(contenedor) {
    mundo.muebles.forEach(m => {
        const sprite = SPRITES[m.sprite];
        const centro = aPantalla(m.x + m.du / 2, m.y + m.dv / 2);   // centro de la huella
        const delantera = aPantalla(m.x + m.du, m.y + m.dv);        // esquina de la huella más cercana al espectador

        // El punto más bajo del dibujo cae en esa esquina. 'apoyo' (0 a 1) lo acerca al centro en los muebles
        // que no se apoyan en las esquinas, como un lavamanos de pedestal.
        const apoyo = sprite.apoyo === undefined ? 1 : sprite.apoyo;
        const sueloY = centro.y + (delantera.y - centro.y) * apoyo;

        // Orden de dibujo: según la última celda que ocupa (la más cercana al espectador)
        const profundidad = (Math.ceil(m.x + m.du) - 1 + Math.ceil(m.y + m.dv) - 1) * 10 + 3;
        const escalas = escalasDeMueble(sprite, m.du, m.dv);
        m.elemento = agregarSprite(contenedor, m.sprite, centro.x, sueloY, 'centro-abajo', profundidad, m.espejo, escalas);
        m.profundidad = profundidad;

        // Altura del cuerpo: lo que mide el mueble sin la tapa de arriba. Sobre la superficie (si tiene) se apoyan dispositivos
        // y sobre la estufa cuelga la campana.
        m.alturaCuerpo = (sprite.caja[3] - sprite.caja[1]) * escalas.sy - (m.du + m.dv) * ALTO_CELDA / 2;
        if (sprite.superficie) m.alturaSuperficie = m.alturaCuerpo * sprite.superficie.fraccion;
    });
}

// Punto de la habitación (en celdas) más despejado cerca de su centro, para poner el cartel con el nombre.
// Prueba varios puntos y se queda con el que está más lejos de los muebles (sin alejarse mucho del centro).
function puntoParaEtiqueta(hab) {
    const lado = CELDAS_POR_LADO;
    const muebles = mundo.muebles.filter(m => m.x >= hab.origenX && m.x < hab.origenX + lado && m.y >= hab.origenY && m.y < hab.origenY + lado);

    // Distancia (en celdas) de un punto al rectángulo de un mueble; 0 si el punto cae encima
    const distanciaAlMueble = (px, py, m) => Math.hypot(
        Math.max(m.x - px, 0, px - (m.x + m.du)),
        Math.max(m.y - py, 0, py - (m.y + m.dv)));

    let mejor = { x: hab.origenX + lado / 2, y: hab.origenY + lado / 2, puntaje: -Infinity };
    for (let dx = 1.5; dx <= 2.75; dx += 0.25) {
        for (let dy = 1.5; dy <= 2.75; dy += 0.25) {
            const px = hab.origenX + dx, py = hab.origenY + dy;
            const libre = Math.min(1.5, ...muebles.map(m => distanciaAlMueble(px, py, m)));
            const puntaje = libre - 0.3 * Math.hypot(dx - lado / 2, dy - lado / 2);   // prefiere lo cercano al centro
            if (puntaje > mejor.puntaje) mejor = { x: px, y: py, puntaje };
        }
    }
    return mejor;
}

// Cartel con el nombre de cada habitación (queda por debajo de muebles y avatar)
function dibujarEtiquetas(contenedor) {
    mundo.habitaciones.forEach(h => {
        const punto = puntoParaEtiqueta(h);
        const centro = aPantalla(punto.x, punto.y);
        const etiqueta = document.createElement('div');
        etiqueta.className = 'etiqueta-habitacion vidrio';
        etiqueta.textContent = h.nombre;
        etiqueta.title = 'Acercar a esta habitación';
        etiqueta.setAttribute('role', 'button');
        etiqueta.tabIndex = 0;
        etiqueta.addEventListener('click', e => { e.stopPropagation(); enfocarHabitacion(h); });
        etiqueta.addEventListener('keydown', e => { if (e.key === 'Enter') enfocarHabitacion(h); });
        etiqueta.style.left = centro.x + 'px';
        etiqueta.style.top = centro.y + 'px';
        contenedor.appendChild(etiqueta);
    });
}

// Celdas de una habitación donde todavía no hay muebles, en el orden en que se van llenando con dispositivos:
// primero el borde de la habitación (más cerca del espectador primero) y al final el centro, donde está el cartel.
function celdasLibresDeHabitacion(hab) {
    const libres = [];
    for (let dy = 0; dy < CELDAS_POR_LADO; dy++) {
        for (let dx = 0; dx < CELDAS_POR_LADO; dx++) {
            const cx = hab.origenX + dx, cy = hab.origenY + dy;
            const esBorde = dx === 0 || dy === 0 || dx === CELDAS_POR_LADO - 1 || dy === CELDAS_POR_LADO - 1;
            if (!mundo.bloqueadas.has(claveCelda(cx, cy))) libres.push({ cx, cy, esBorde });
        }
    }
    // Las celdas junto al cartel con el nombre se usan al final, para no taparlo
    const cartel = puntoParaEtiqueta(hab);
    libres.forEach(c => { c.cercaDelCartel = Math.hypot(c.cx + 0.5 - cartel.x, c.cy + 0.5 - cartel.y) < 1.1; });
    libres.sort((a, b) => (Number(a.cercaDelCartel) - Number(b.cercaDelCartel))
        || (Number(b.esBorde) - Number(a.esBorde))
        || ((b.cx + b.cy) - (a.cx + a.cy)));
    return libres;
}

// ----------------------------------------------------
// DISPOSITIVOS INSTALADOS
// ----------------------------------------------------
// Cada dispositivo se muestra de una de estas formas, de la más a la menos vistosa:
//  1. Si es un mueble de la habitación (nevera, estufa, TV, PC): ese mismo dibujo pasa a ser el dispositivo.
//  2. Si trae sprite y es "de superficie" (tostadora, licuadora...): se apoya sobre un mueble con sitio (mesón, mesa...).
//  3. Si trae sprite y es "de pared" (aire acondicionado, cámara, campana): cuelga de una pared trasera.
//  4. Si trae sprite y es "de suelo" (lavadora, ventilador...): de pie en una celda libre junto a la pared.
//  5. Si no tiene dibujo o ya no hay sitio: un disco (pin) con su emoji, como antes.
// En todos los casos, al pasar el mouse aparece la ficha con sus datos y el brillo indica su estado.

// Hace que un dibujo sea un dispositivo: brillo según su estado (ámbar: enchufado en reposo; azul: desconectado)
// y ficha con sus datos al pasar el mouse.
// El mouse no se recibe en la <img> sino en una zona transparente ajustada a la parte útil del dibujo: una <img>
// responde en todo su cuadro, también en lo transparente, y un dispositivo taparía a sus vecinos.
function hacerDispositivoInteractivo(elemento, aparato, habitacion) {
    elemento.classList.add('dispositivo-sprite', aparato.dejado_conectado ? 'en-reposo' : 'desconectado');

    const sprite = SPRITES[elemento.dataset.sprite];
    const reflejado = elemento.style.transform.includes('-1');
    const [anchoOriginal] = sprite.tam;
    const [izq, arriba, der, abajo] = sprite.caja;
    const sx = parseFloat(elemento.style.width) / anchoOriginal;
    const sy = parseFloat(elemento.style.height) / sprite.tam[1];
    const margen = 0.08;   // la zona es un poco más pequeña que el dibujo, para no pisar a los vecinos

    const zona = document.createElement('div');
    zona.className = 'zona-dispositivo';
    zona.style.left = (parseFloat(elemento.style.left) + (reflejado ? anchoOriginal - der : izq) * sx + (der - izq) * sx * margen) + 'px';
    zona.style.top = (parseFloat(elemento.style.top) + arriba * sy + (abajo - arriba) * sy * margen) + 'px';
    zona.style.width = (der - izq) * sx * (1 - 2 * margen) + 'px';
    zona.style.height = (abajo - arriba) * sy * (1 - 2 * margen) + 'px';
    zona.style.zIndex = elemento.style.zIndex;

    zona.addEventListener('mouseenter', e => { elemento.classList.add('resaltado'); mostrarFicha(e, aparato, habitacion); });
    zona.addEventListener('mousemove', moverFicha);
    zona.addEventListener('mouseleave', () => { elemento.classList.remove('resaltado'); ocultarFicha(); });
    elemento.after(zona);
}

// Dibuja un sprite de dispositivo con su ancho en pantalla. Su base (centro-abajo) queda en (x, y).
function agregarSpriteDispositivo(contenedor, nombreSprite, x, y, zIndex, espejo) {
    const sprite = SPRITES[nombreSprite];
    const sx = sprite.ancho / (sprite.caja[2] - sprite.caja[0]);
    return agregarSprite(contenedor, nombreSprite, x, y, 'centro-abajo', zIndex, espejo, { sx, sy: sx });
}

// Sitios libres sobre los muebles de una habitación (mesón, mesa...). Cada mueble con 'superficie' trae sus puntos.
function sitiosSobreMuebles(hab) {
    const sitios = [];
    mundo.muebles.filter(m => m.habitacion === hab.nombre && SPRITES[m.sprite].superficie).forEach(m => {
        SPRITES[m.sprite].superficie.puntos.forEach(([fu, fv]) => {
            // Si el dibujo está reflejado, sus ejes están intercambiados
            const [fraccionU, fraccionV] = m.espejo ? [fv, fu] : [fu, fv];
            sitios.push({ mueble: m, x: m.x + fraccionU * m.du, y: m.y + fraccionV * m.dv, ocupado: false });
        });
    });
    return sitios;
}

// Sitios en las paredes traseras de una habitación para lo que cuelga (aire acondicionado, cámara...).
//  - Pared 'atras' (y = origenY, la trasera derecha): el aparato mira a +v. Pared 'izquierda' (x = origenX): mira a +u.
//  - Se prefieren las paredes sin habitación vecina (opacas) y se salta el hueco de las puertas. Primero el centro de la pared.
function sitiosEnPared(hab) {
    const paredes = [
        { lado: 'atras', mira: 'v', conVecina: hab.puertaAtras },
        { lado: 'izquierda', mira: 'u', conVecina: hab.puertaIzquierda }
    ].sort((a, b) => Number(a.conVecina) - Number(b.conVecina));

    const sitios = [];
    [2.0, 3.1, 0.9].forEach(posicion => paredes.forEach(pared => {
        const x = pared.lado === 'atras' ? hab.origenX + posicion : hab.origenX;
        const y = pared.lado === 'atras' ? hab.origenY : hab.origenY + posicion;
        const cx = Math.floor(x), cy = Math.floor(y);
        if (!mundo.celdasDePuerta.has(claveCelda(cx, cy))) sitios.push({ x, y, cx, cy, mira: pared.mira, ocupado: false });
    }));
    return sitios;
}

// Cuelga un dispositivo de pared. La campana va sobre la estufa (si la hay); el resto, en el primer sitio libre.
// Devuelve false si no hay dónde ponerlo.
function colocarEnPared(contenedor, aparato, hab, nombreSprite, sitios) {
    let sitio, altura = null, profundidad;

    const estufa = nombreSprite === 'campana' && mundo.muebles.find(m => m.habitacion === hab.nombre && m.mueble === 'estufa' && !m.conCampana);
    if (estufa) {
        estufa.conCampana = true;
        const contraLaDerecha = estufa.mira === 'v';   // la estufa mira a +v cuando va contra la pared trasera derecha
        sitio = {
            x: contraLaDerecha ? estufa.x + estufa.du / 2 : estufa.x,
            y: contraLaDerecha ? estufa.y : estufa.y + estufa.dv / 2,
            mira: estufa.mira
        };
        altura = estufa.alturaCuerpo + 24;             // un poco por encima de la estufa
        profundidad = estufa.profundidad + 1;          // se dibuja sobre ella
    } else {
        sitio = sitios.find(s => !s.ocupado);
        if (!sitio) return false;
        sitio.ocupado = true;
        profundidad = (sitio.cx + sitio.cy) * 10 + 2;  // sobre la pared (1) y bajo los muebles (3)
    }

    const version = elegirVersion(nombreSprite, sitio.mira);
    if (altura === null) altura = SPRITES[version.sprite].altura;
    const base = aPantalla(sitio.x, sitio.y);
    const img = agregarSpriteDispositivo(contenedor, version.sprite, base.x, base.y - altura, profundidad, version.espejo);
    hacerDispositivoInteractivo(img, aparato, hab.nombre);
    return true;
}

// ¿Sirve este sitio para este dispositivo? Si el dispositivo pide un mueble concreto (campo 'sobre' del catálogo, p. ej. la manta
// térmica sobre la cama) solo va ahí. Los sitios 'exclusivos' (la cama) no los usa nadie que no los pida.
function sitioSirve(sitio, catalogo) {
    if (catalogo.sobre) return catalogo.sobre.includes(sitio.mueble.mueble);
    return !SPRITES[sitio.mueble.sprite].superficie.exclusiva;
}

// Una celda está "cerca de una puerta" si es de la puerta o toca una: ahí no se pone nada que estorbe el paso
function estaCercaDeUnaPuerta(cx, cy) {
    return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => mundo.celdasDePuerta.has(claveCelda(cx + dx, cy + dy)));
}

// Comprueba que, si se bloquea esta celda, el resto de la casa sigue conectado (ninguna habitación queda aislada).
// Recorre la casa en anchura desde una celda libre, antes y después de bloquear: si solo desaparece esa celda, es seguro.
function sePuedeBloquear(cx, cy) {
    const clave = claveCelda(cx, cy);
    const inicio = [...mundo.celdas.values()].find(c => esCeldaCaminable(c.cx, c.cy) && claveCelda(c.cx, c.cy) !== clave);
    if (!inicio) return false;

    const contarAlcanzables = () => {
        const visto = new Set([claveCelda(inicio.cx, inicio.cy)]);
        const cola = [{ x: inicio.cx, y: inicio.cy }];
        while (cola.length > 0) {
            const actual = cola.shift();
            PASOS.forEach(([dx, dy]) => {
                const vecino = { x: actual.x + dx, y: actual.y + dy };
                const claveVecino = claveCelda(vecino.x, vecino.y);
                if (!visto.has(claveVecino) && puedeMoverse(actual.x, actual.y, vecino.x, vecino.y)) {
                    visto.add(claveVecino);
                    cola.push(vecino);
                }
            });
        }
        return visto.size;
    };

    const antes = contarAlcanzables();
    mundo.bloqueadas.add(clave);
    const despues = contarAlcanzables();
    mundo.bloqueadas.delete(clave);
    return despues === antes - 1;
}

// Celda para un dispositivo de suelo: junto a las paredes de atrás, sin muebles, lejos de las puertas
// y sin cortar ningún paso (sePuedeBloquear). Devuelve undefined si no hay una celda que sirva.
function celdaParaDispositivoDeSuelo(hab) {
    const candidatas = celdasLibresDeHabitacion(hab).filter(c =>
        !mundo.ocupadas.has(claveCelda(c.cx, c.cy)) && !estaCercaDeUnaPuerta(c.cx, c.cy));
    const juntoAPared = candidatas.filter(c => c.cx === hab.origenX || c.cy === hab.origenY);
    const otras = candidatas.filter(c => !juntoAPared.includes(c));
    // primero las de la pared y, dentro de cada grupo, las del fondo
    const delFondo = (a, b) => (a.cx + a.cy) - (b.cx + b.cy);
    const ordenadas = [...juntoAPared.sort(delFondo), ...otras.sort(delFondo)];
    return ordenadas.find(c => sePuedeBloquear(c.cx, c.cy));
}

function dibujarDispositivos(contenedor) {
    mundo.habitaciones.forEach(hab => {
        const aparatos = casaUsuario[hab.nombre] || [];
        const sitios = sitiosSobreMuebles(hab);
        const sitiosPared = sitiosEnPared(hab);
        const sinColocar = [];

        aparatos.forEach(aparato => {
            const catalogo = catalogoExcel.find(d => d.id === aparato.id) || {};

            // 1. El mueble de la habitación es el dispositivo
            const mueble = mundo.muebles.find(m => m.habitacion === hab.nombre && m.dispositivoId === aparato.id && !m.reclamado);
            if (mueble && catalogo.montaje === 'mueble') {
                mueble.reclamado = true;
                hacerDispositivoInteractivo(mueble.elemento, aparato, hab.nombre);
                return;
            }

            // 2. Sobre un mueble con sitio libre
            if (catalogo.montaje === 'superficie' && catalogo.sprite) {
                const sitio = sitios.find(s => !s.ocupado && sitioSirve(s, catalogo));
                if (sitio) {
                    sitio.ocupado = true;
                    const version = elegirVersion(catalogo.sprite, sitio.mueble.mira);
                    const base = aPantalla(sitio.x, sitio.y);
                    // Un punto más que el mueble (y menos que el avatar) para que se vea encima de él
                    const img = agregarSpriteDispositivo(contenedor, version.sprite, base.x, base.y - sitio.mueble.alturaSuperficie, sitio.mueble.profundidad + 1, version.espejo);
                    hacerDispositivoInteractivo(img, aparato, hab.nombre);
                    return;
                }
            }

            // 3. Colgado de una pared
            if (catalogo.montaje === 'pared' && catalogo.sprite) {
                if (colocarEnPared(contenedor, aparato, hab, catalogo.sprite, sitiosPared)) return;
            }

            // 4. De pie en una celda libre
            if (catalogo.montaje === 'suelo' && catalogo.sprite) {
                const celda = celdaParaDispositivoDeSuelo(hab);
                if (celda) {
                    mundo.bloqueadas.add(claveCelda(celda.cx, celda.cy));    // el avatar no puede atravesarlo
                    const mira = celda.cx === hab.origenX ? 'u' : (celda.cy === hab.origenY ? 'v' : 'u');   // mira hacia el cuarto
                    const version = elegirVersion(catalogo.sprite, mira);
                    const centro = aPantalla(celda.cx + 0.5, celda.cy + 0.5);
                    const ancho = SPRITES[version.sprite].ancho;
                    // La base del dibujo va en la esquina delantera de su huella, que está unos px por debajo del centro de la celda
                    const img = agregarSpriteDispositivo(contenedor, version.sprite, centro.x, centro.y + ancho / 4, (celda.cx + celda.cy) * 10 + 3, version.espejo);
                    hacerDispositivoInteractivo(img, aparato, hab.nombre);
                    return;
                }
            }

            sinColocar.push(aparato);
        });

        // 5. Pines con emoji para lo que no tiene dibujo o no encontró sitio
        const libres = celdasLibresDeHabitacion(hab);
        if (libres.length === 0) return;

        sinColocar.forEach((aparato, i) => {
            const celda = libres[i % libres.length];   // si hay más dispositivos que celdas, vuelve a empezar
            const centro = aPantalla(celda.cx + 0.5, celda.cy + 0.5);

            const pin = document.createElement('div');
            const estado = aparato.dejado_conectado ? 'en-reposo' : 'desconectado';
            pin.className = 'pin-dispositivo ' + estado;
            pin.innerHTML = `<span>${aparato.icono || '🔌'}</span>`;
            pin.style.left = centro.x + 'px';
            pin.style.top = centro.y + 'px';
            pin.style.zIndex = (celda.cx + celda.cy) * 10 + 4;

            pin.addEventListener('mouseenter', e => mostrarFicha(e, aparato, hab.nombre));
            pin.addEventListener('mousemove', moverFicha);
            pin.addEventListener('mouseleave', ocultarFicha);
            contenedor.appendChild(pin);
        });
    });
}

let habitacionesDibujadas = 0;

function dibujarCasaIsometrica() {
    const contenedor = document.getElementById('casa-mundo');
    contenedor.innerHTML = '';
    mundo = construirMundo();

    // Si la casa creció o se achicó, el zoom y el desplazamiento de antes ya no sirven: vuelve a verse completa
    if (habitacionesDibujadas !== mundo.habitaciones.length) {
        vista = { zoom: 1, panX: 0, panY: 0 };
        habitacionEnfocada = null;
        habitacionesDibujadas = mundo.habitaciones.length;
    }

    if (mundo.celdas.size === 0) {
        avatar.elemento = null;
        contenedor.innerHTML = '<p class="casa-vacia">Crea tu primera habitación en «Modelar casa».</p>';
        ajustarEscalaCasa();
        return;
    }

    dibujarSuelo(contenedor);
    dibujarParedes(contenedor);
    dibujarParedesInteriores(contenedor);
    dibujarMuebles(contenedor);
    dibujarEtiquetas(contenedor);
    dibujarDispositivos(contenedor);
    crearAvatar(contenedor);
    ajustarEscalaCasa();
}

// ----------------------------------------------------
// VISTA: ajustar, zoom y arrastre
// ----------------------------------------------------
// La casa se dibuja en un "mundo" de tamaño fijo (#casa-mundo) y la vista lo mueve y lo escala con una transformación CSS:
//  - escalaAjuste: la escala con la que toda la casa cabe en la ventana.
//  - vista.zoom: cuánto se acercó el usuario respecto a esa escala (1 = ver toda la casa).
//  - vista.panX / panY: cuánto se desplazó el usuario, en píxeles de pantalla.
// La escala real (escalaVista = escalaAjuste x zoom) también la usan los clics y los carteles.
const ZOOM_MINIMO = 0.7;
const ZOOM_MAXIMO = 4;
let vista = { zoom: 1, panX: 0, panY: 0 };
let escalaAjuste = 1;
let arrastre = null;                  // datos del arrastre mientras el usuario tiene el botón pulsado
let ignorarSiguienteClic = false;     // al soltar un arrastre el navegador lanza un clic: no debe hacer caminar al avatar
let animacionVista = null;            // id del requestAnimationFrame de un movimiento suave
let habitacionEnfocada = null;        // nombre de la habitación a la que se acercó la vista (si sigue ahí)
const FRANJA_INFERIOR = 64;           // franja de abajo de la ventana (controles y ayuda): la casa se centra por encima

function medidasDeLaVentana() {
    const ventana = document.getElementById('casa-iso');
    return { ancho: ventana.clientWidth, alto: ventana.clientHeight };
}

// Esquina superior izquierda de la casa en pantalla cuando está centrada en la ventana con la escala s
function posicionCentrada(s) {
    const { ancho, alto } = medidasDeLaVentana();
    return { x: (ancho - mundo.ancho * s) / 2, y: (alto - FRANJA_INFERIOR - mundo.alto * s) / 2 };
}

// Que la casa nunca se pierda: siempre queda a la vista al menos una franja
function limitarVista() {
    const s = escalaAjuste * vista.zoom;
    const { ancho, alto } = medidasDeLaVentana();
    const base = posicionCentrada(s);
    const franjaX = Math.min(120, ancho * 0.25), franjaY = Math.min(120, alto * 0.25);
    const x = Math.min(Math.max(base.x + vista.panX, franjaX - mundo.ancho * s), ancho - franjaX);
    const y = Math.min(Math.max(base.y + vista.panY, franjaY - mundo.alto * s), alto - franjaY);
    vista.panX = x - base.x;
    vista.panY = y - base.y;
}

// Coloca la casa en la ventana según la vista actual
function aplicarVista() {
    if (!mundo || mundo.celdas.size === 0) return;
    limitarVista();
    const s = escalaAjuste * vista.zoom;
    escalaVista = s;
    const base = posicionCentrada(s);
    const contenedor = document.getElementById('casa-mundo');
    contenedor.style.setProperty('--escala', s);
    contenedor.style.transform = `translate(${base.x + vista.panX}px, ${base.y + vista.panY}px) scale(${s})`;

    // Los puntos del fondo de la ventana acompañan al arrastre: da sensación de mover la cámara
    const marco = document.querySelector('.ventana-casa');
    marco.style.setProperty('--pan-x', (base.x + vista.panX) + 'px');
    marco.style.setProperty('--pan-y', (base.y + vista.panY) + 'px');
    document.getElementById('nivel-zoom').textContent = Math.round(vista.zoom * 100) + '%';
}

// Hace que toda la casa quepa en la ventana, sin deformarla (con un pequeño margen)
function ajustarEscalaCasa() {
    const contenedor = document.getElementById('casa-mundo');
    if (!mundo || mundo.celdas.size === 0) {
        contenedor.style.cssText = '';
        return;
    }
    const { ancho, alto } = medidasDeLaVentana();
    escalaAjuste = Math.min(ancho / mundo.ancho, (alto - FRANJA_INFERIOR) / mundo.alto, 1.3) * 0.96;
    contenedor.style.width = mundo.ancho + 'px';
    contenedor.style.height = mundo.alto + 'px';
    aplicarVista();
}

function cancelarAnimacionVista() {
    if (animacionVista) cancelAnimationFrame(animacionVista);
    animacionVista = null;
}

// Mueve la vista de forma suave hasta 'destino' ({ zoom, panX, panY })
function animarVista(destino, milisegundos = 450) {
    cancelarAnimacionVista();
    const origen = { ...vista };
    const inicio = performance.now();
    const paso = ahora => {
        const avance = Math.min((ahora - inicio) / milisegundos, 1);
        const suave = 1 - Math.pow(1 - avance, 3);          // arranca rápido y frena al llegar
        vista.zoom = origen.zoom + (destino.zoom - origen.zoom) * suave;
        vista.panX = origen.panX + (destino.panX - origen.panX) * suave;
        vista.panY = origen.panY + (destino.panY - origen.panY) * suave;
        aplicarVista();
        animacionVista = avance < 1 ? requestAnimationFrame(paso) : null;
    };
    animacionVista = requestAnimationFrame(paso);
}

// Acerca o aleja manteniendo quieto el punto (px, py) de la ventana: así se hace zoom "hacia donde apunta el mouse"
function zoomHacia(factor, px, py) {
    const antes = escalaAjuste * vista.zoom;
    const nuevoZoom = Math.min(Math.max(vista.zoom * factor, ZOOM_MINIMO), ZOOM_MAXIMO);
    const despues = escalaAjuste * nuevoZoom;
    const baseAntes = posicionCentrada(antes);
    const mundoX = (px - baseAntes.x - vista.panX) / antes;      // punto de la casa que está bajo el cursor
    const mundoY = (py - baseAntes.y - vista.panY) / antes;
    vista.zoom = nuevoZoom;
    const baseDespues = posicionCentrada(despues);
    vista.panX = px - mundoX * despues - baseDespues.x;
    vista.panY = py - mundoY * despues - baseDespues.y;
    habitacionEnfocada = null;
    aplicarVista();
}

function zoomAlCentro(factor) {
    const { ancho, alto } = medidasDeLaVentana();
    cancelarAnimacionVista();
    zoomHacia(factor, ancho / 2, alto / 2);
}

function verTodaLaCasa() {
    habitacionEnfocada = null;
    animarVista({ zoom: 1, panX: 0, panY: 0 });
}

// Vista que encuadra una caja de la casa (en px del mundo) con un poco de aire alrededor
function vistaQueEncuadra(caja, aire = 1.25) {
    const { ancho, alto } = medidasDeLaVentana();
    const sQueCabe = Math.min(ancho / ((caja.x1 - caja.x0) * aire), (alto - FRANJA_INFERIOR) / ((caja.y1 - caja.y0) * aire));
    const zoom = Math.min(Math.max(sQueCabe / escalaAjuste, ZOOM_MINIMO), ZOOM_MAXIMO);
    const s = escalaAjuste * zoom;
    const base = posicionCentrada(s);
    return {
        zoom,
        panX: ancho / 2 - (caja.x0 + caja.x1) / 2 * s - base.x,
        panY: (alto - FRANJA_INFERIOR) / 2 - (caja.y0 + caja.y1) / 2 * s - base.y
    };
}

// Acerca la vista a una habitación; si ya estaba acercada a ella, vuelve a ver toda la casa
function enfocarHabitacion(hab) {
    if (habitacionEnfocada === hab.nombre) {
        verTodaLaCasa();
        return;
    }
    const lado = CELDAS_POR_LADO;
    const arriba = aPantalla(hab.origenX, hab.origenY);
    const abajo = aPantalla(hab.origenX + lado, hab.origenY + lado);
    const izquierda = aPantalla(hab.origenX, hab.origenY + lado);
    const derecha = aPantalla(hab.origenX + lado, hab.origenY);
    const altoParedes = PISOS_PAREDES_EXTERIORES * (ALTURA_PARED_PX - SOLAPE_PISOS);
    animarVista(vistaQueEncuadra({ x0: izquierda.x, x1: derecha.x, y0: arriba.y - altoParedes, y1: abajo.y }));
    habitacionEnfocada = hab.nombre;
}

// Si el usuario está acercado y el avatar camina hacia el borde de la ventana, la vista lo sigue con suavidad
function seguirAlAvatar() {
    if (vista.zoom < 1.15 || arrastre || animacionVista) return;
    const s = escalaVista;
    const base = posicionCentrada(s);
    const { ancho, alto } = medidasDeLaVentana();
    const p = aPantalla(avatar.x + 0.5, avatar.y + 0.5);
    const pantallaX = base.x + vista.panX + p.x * s;
    const pantallaY = base.y + vista.panY + (p.y - 35) * s;
    const margenX = ancho * 0.25, margenY = alto * 0.25;
    let corregirX = 0, corregirY = 0;
    if (pantallaX < margenX) corregirX = margenX - pantallaX;
    else if (pantallaX > ancho - margenX) corregirX = ancho - margenX - pantallaX;
    if (pantallaY < margenY) corregirY = margenY - pantallaY;
    else if (pantallaY > alto - margenY) corregirY = alto - margenY - pantallaY;
    if (corregirX === 0 && corregirY === 0) return;
    vista.panX += corregirX * 0.12;
    vista.panY += corregirY * 0.12;
    aplicarVista();
}

// ----------------------------------------------------
// 6. FICHA DEL DISPOSITIVO (hover)
// ----------------------------------------------------
function mostrarFicha(evento, aparato, habitacion) {
    const ficha = document.getElementById('ficha-dispositivo');
    const enReposo = aparato.dejado_conectado;
    const textoReposo = enReposo
        ? `Enchufado en reposo: gasta ${aparato.watts_standby} W aunque no lo uses`
        : 'Desenchufado en reposo: no gasta energía fantasma';
    const textoDesconexion = aparato.desconectable ? 'Fácil de desconectar' : 'Difícil de desconectar';

    ficha.innerHTML = `
        <strong>${aparato.nombre}</strong>
        <span class="ficha-lugar">${habitacion}</span>
        <span class="ficha-dato"><i class="status-dot ${enReposo ? 'dot-on' : 'dot-off'}"></i>${textoReposo}</span>
        <span class="ficha-dato">Uso: ${aparato.horas_uso.toFixed(1)} h al día · ${aparato.watts_activos} W activo</span>
        <span class="ficha-dato">${textoDesconexion}</span>`;
    ficha.classList.remove('oculto');
    moverFicha(evento);
}

// La ficha sigue al mouse, pero sin salirse de la ventana
function moverFicha(evento) {
    const ficha = document.getElementById('ficha-dispositivo');
    const margen = 16;
    const x = Math.min(evento.clientX + margen, window.innerWidth - ficha.offsetWidth - margen);
    const y = Math.min(evento.clientY + margen, window.innerHeight - ficha.offsetHeight - margen);
    ficha.style.left = x + 'px';
    ficha.style.top = y + 'px';
}

function ocultarFicha() {
    document.getElementById('ficha-dispositivo').classList.add('oculto');
}

// ----------------------------------------------------
// 7. AVATAR: dibujo, movimiento y búsqueda de camino
// ----------------------------------------------------
// Busca la celda caminable más cercana al centro de la primera habitación
function celdaInicialAvatar() {
    // Un poco más adelante del centro, para que no tape el cartel con el nombre de la habitación
    const primera = mundo.habitaciones[0];
    const centro = { x: primera.origenX + 1, y: primera.origenY + CELDAS_POR_LADO - 1 };
    const candidatas = Array.from(mundo.celdas.values()).filter(c => esCeldaCaminable(c.cx, c.cy));
    candidatas.sort((a, b) => distancia(a.cx, a.cy, centro) - distancia(b.cx, b.cy, centro));
    return candidatas[0];
}

function distancia(x, y, punto) {
    return Math.abs(x - punto.x) + Math.abs(y - punto.y);
}

function crearAvatar(contenedor) {
    // La primera vez nace en el centro de la primera habitación. Después, si la casa cambió y
    // el avatar quedó sobre un mueble o fuera de la casa, también vuelve al inicio.
    const cx = Math.round(avatar.x), cy = Math.round(avatar.y);
    if (!avatar.yaColocado || !esCeldaCaminable(cx, cy)) {
        const inicio = celdaInicialAvatar();
        avatar.x = inicio.cx;
        avatar.y = inicio.cy;
        avatar.ruta = [];
        avatar.yaColocado = true;
    }
    avatar.elemento = document.createElement('img');
    avatar.elemento.className = 'sprite-casa';
    avatar.elemento.alt = '';
    avatar.elemento.draggable = false;
    contenedor.appendChild(avatar.elemento);
    pintarAvatar(performance.now());
}

// Elige la imagen según hacia dónde mira y si está caminando
function spriteDelAvatar(caminando, ahora) {
    const [dx, dy] = avatar.direccion;
    let lado = 'der';
    let espejo = false;
    if (dx === 0 && dy === 1) lado = 'izq';
    if (dx === -1) lado = 'atras';
    if (dy === -1) { lado = 'atras'; espejo = true; }   // mirando arriba-derecha: la imagen de espaldas, reflejada

    // Al caminar alterna entre "quieto" y "caminando" para dar sensación de pasos
    const pasoDeCaminata = caminando && Math.floor(ahora / 170) % 2 === 0;
    return { nombre: (pasoDeCaminata ? 'avatar_cam_' : 'avatar_quieto_') + lado, espejo };
}

function pintarAvatar(ahora) {
    if (!avatar.elemento) return;
    const { nombre, espejo } = spriteDelAvatar(avatar.ruta.length > 0, ahora);
    const sprite = SPRITES[nombre];
    const rutaImagen = RUTA_ASSETS + sprite.archivo;
    if (!avatar.elemento.src.endsWith(sprite.archivo)) avatar.elemento.src = rutaImagen;

    const pies = aPantalla(avatar.x + 0.5, avatar.y + 0.5);     // centro de la celda donde pisa
    colocarSprite(avatar.elemento, sprite, { sx: ESCALA_AVATAR, sy: ESCALA_AVATAR }, pies.x, pies.y + 6, 'centro-abajo', espejo);
    avatar.elemento.style.zIndex = Math.round((avatar.x + avatar.y) * 10) + 5;
}

// Da un paso en una dirección, si el avatar está quieto y la celda de destino está libre
function darPaso(direccion) {
    if (avatar.ruta.length > 0) return;
    avatar.direccion = direccion;                               // aunque no pueda avanzar, gira hacia allá
    const origenX = Math.round(avatar.x), origenY = Math.round(avatar.y);
    const destinoX = origenX + direccion[0];
    const destinoY = origenY + direccion[1];
    if (puedeMoverse(origenX, origenY, destinoX, destinoY)) avatar.ruta.push({ x: destinoX, y: destinoY });
}

// Si el usuario mantiene una tecla pulsada, sigue caminando en esa dirección
function decidirSiguientePaso() {
    if (teclasPresionadas.length === 0) return;
    darPaso(teclasPresionadas[teclasPresionadas.length - 1]);
}

// Acerca al avatar a la siguiente celda de su ruta según el tiempo transcurrido
function avanzarAvatar(segundos) {
    if (avatar.ruta.length === 0) return;
    const destino = avatar.ruta[0];
    const faltaX = destino.x - avatar.x;
    const faltaY = destino.y - avatar.y;
    const falta = Math.hypot(faltaX, faltaY);
    const paso = VELOCIDAD_AVATAR * segundos;

    avatar.direccion = [Math.sign(faltaX), Math.sign(faltaY)];
    if (falta <= paso) {
        avatar.x = destino.x;
        avatar.y = destino.y;
        avatar.ruta.shift();
    } else {
        avatar.x += faltaX / falta * paso;
        avatar.y += faltaY / falta * paso;
    }
}

// BÚSQUEDA EN ANCHURA (BFS): explora la rejilla "en círculos" desde el origen, paso a paso.
// La primera vez que llega al destino ya sabe que es el camino más corto.
// 'anterior' recuerda de qué celda venimos, para reconstruir el camino al final.
function buscarCamino(origen, destino) {
    const anterior = new Map();
    const cola = [origen];
    anterior.set(claveCelda(origen.x, origen.y), null);

    while (cola.length > 0) {
        const actual = cola.shift();
        if (actual.x === destino.x && actual.y === destino.y) break;

        PASOS.forEach(([dx, dy]) => {
            const vecino = { x: actual.x + dx, y: actual.y + dy };
            const clave = claveCelda(vecino.x, vecino.y);
            if (!anterior.has(clave) && puedeMoverse(actual.x, actual.y, vecino.x, vecino.y)) {
                anterior.set(clave, actual);
                cola.push(vecino);
            }
        });
    }

    if (!anterior.has(claveCelda(destino.x, destino.y))) return [];   // no hay camino

    // Reconstruye el camino yendo hacia atrás desde el destino
    const camino = [];
    let paso = destino;
    while (paso && !(paso.x === origen.x && paso.y === origen.y)) {
        camino.unshift(paso);
        paso = anterior.get(claveCelda(paso.x, paso.y));
    }
    return camino;
}

function alHacerClicEnCasa(evento) {
    if (ignorarSiguienteClic) return;      // el clic que llega al soltar un arrastre no es para caminar
    if (!mundo || mundo.celdas.size === 0 || !avatar.elemento) return;

    // Posición del clic dentro de la casa, deshaciendo el zoom
    const caja = document.getElementById('casa-mundo').getBoundingClientRect();
    const x = (evento.clientX - caja.left) / escalaVista;
    const y = (evento.clientY - caja.top) / escalaVista;
    const destino = aCelda(x, y);
    if (!esCeldaCaminable(destino.cx, destino.cy)) return;

    // Si ya está dando un paso, termina ese paso y desde ahí sigue (así no da saltos)
    const pasoEnCurso = avatar.ruta.length > 0 ? [avatar.ruta[0]] : [];
    const origen = pasoEnCurso.length > 0 ? avatar.ruta[0] : { x: Math.round(avatar.x), y: Math.round(avatar.y) };
    avatar.ruta = pasoEnCurso.concat(buscarCamino(origen, { x: destino.cx, y: destino.cy }));
}

// ----------------------------------------------------
// 8. TECLADO Y BUCLE DE ANIMACIÓN
// ----------------------------------------------------
// No mover al avatar mientras el usuario escribe o tiene un panel abierto
function controlesBloqueados() {
    const activo = document.activeElement;
    const escribiendo = activo && ['INPUT', 'SELECT', 'TEXTAREA'].includes(activo.tagName);
    const panelAbierto = document.querySelector('.overlay-panel:not(.oculto)') !== null;
    return escribiendo || panelAbierto;
}

function nombreDeTecla(evento) {
    return evento.key.length === 1 ? evento.key.toLowerCase() : evento.key;
}

window.addEventListener('keydown', evento => {
    const tecla = nombreDeTecla(evento);
    if (mundo && !controlesBloqueados() && !evento.ctrlKey && !evento.metaKey) {     // zoom con el teclado (Ctrl +/- es del navegador)
        if (tecla === '+' || tecla === '=') { zoomAlCentro(1.25); return; }
        if (tecla === '-' || tecla === '_') { zoomAlCentro(0.8); return; }
        if (tecla === '0') { verTodaLaCasa(); return; }
    }
    const direccion = TECLAS_MOVIMIENTO[tecla];
    if (!direccion || controlesBloqueados()) return;
    evento.preventDefault();                                   // evita que las flechas muevan la página
    const yaPulsada = teclasPresionadas.includes(direccion);
    if (!yaPulsada) teclasPresionadas.push(direccion);
    avatar.ruta = avatar.ruta.slice(0, 1);                     // el teclado cancela una ruta de clic
    if (mundo && avatar.elemento) darPaso(direccion);          // da el paso ya, sin esperar al siguiente cuadro
});

window.addEventListener('keyup', evento => {
    const direccion = TECLAS_MOVIMIENTO[nombreDeTecla(evento)];
    teclasPresionadas = teclasPresionadas.filter(d => d !== direccion);
});

window.addEventListener('blur', () => { teclasPresionadas = []; });
window.addEventListener('resize', ajustarEscalaCasa);
const ventanaCasa = document.getElementById('casa-iso');
ventanaCasa.addEventListener('click', alHacerClicEnCasa);

// Arrastrar: un movimiento de más de 5 px mueve la vista; uno menor sigue siendo un clic (caminar)
ventanaCasa.addEventListener('mousedown', evento => {
    if (evento.button !== 0) return;
    cancelarAnimacionVista();
    arrastre = { x: evento.clientX, y: evento.clientY, panX: vista.panX, panY: vista.panY, movido: false };
});
window.addEventListener('mousemove', evento => {
    if (!arrastre) return;
    const dx = evento.clientX - arrastre.x, dy = evento.clientY - arrastre.y;
    if (!arrastre.movido && Math.hypot(dx, dy) < 5) return;
    arrastre.movido = true;
    habitacionEnfocada = null;
    ventanaCasa.classList.add('arrastrando');
    vista.panX = arrastre.panX + dx;
    vista.panY = arrastre.panY + dy;
    aplicarVista();
});
window.addEventListener('mouseup', () => {
    if (!arrastre) return;
    ignorarSiguienteClic = arrastre.movido;
    ventanaCasa.classList.remove('arrastrando');
    arrastre = null;
    setTimeout(() => { ignorarSiguienteClic = false; }, 0);   // el clic llega justo después de soltar
});

// La rueda no manda siempre la misma unidad: Chrome da píxeles (100 por muesca), Firefox da líneas (3 por muesca) y el
// pellizco de un trackpad llega con Ctrl y valores muy pequeños. Todo se convierte a "píxeles" para que una muesca
// acerque lo mismo en cualquier navegador. (Antes se usaba deltaY tal cual y en Firefox casi no se notaba el zoom.)
function pixelesDeRueda(evento) {
    const porUnidad = evento.deltaMode === 1 ? 33 : (evento.deltaMode === 2 ? 400 : 1);   // líneas, páginas o píxeles
    const pixeles = evento.deltaY * porUnidad * (evento.ctrlKey ? 8 : 1);
    return Math.max(-250, Math.min(250, pixeles));                                          // una muesca nunca da un salto enorme
}

// Rueda: zoom hacia donde apunta el mouse (una muesca = ~22 %)
ventanaCasa.addEventListener('wheel', evento => {
    evento.preventDefault();                                  // que la página no se desplace
    cancelarAnimacionVista();
    const caja = ventanaCasa.getBoundingClientRect();
    zoomHacia(Math.exp(-pixelesDeRueda(evento) * 0.002), evento.clientX - caja.left, evento.clientY - caja.top);
}, { passive: false });

// Botones: + y − acercan o alejan; el número vuelve a ver toda la casa
document.getElementById('btn-acercar').addEventListener('click', () => zoomAlCentro(1.3));
document.getElementById('btn-alejar').addEventListener('click', () => zoomAlCentro(1 / 1.3));
document.getElementById('nivel-zoom').addEventListener('click', verTodaLaCasa);

let ultimoCuadro = performance.now();
function bucleAvatar(ahora) {
    const segundos = Math.min((ahora - ultimoCuadro) / 1000, 0.1);   // tope: evita saltos si la pestaña estuvo oculta
    ultimoCuadro = ahora;
    if (mundo && avatar.elemento) {                                   // solo si ya hay casa dibujada
        decidirSiguientePaso();
        avanzarAvatar(segundos);
        pintarAvatar(ahora);
        if (avatar.ruta.length > 0) seguirAlAvatar();
    }
    requestAnimationFrame(bucleAvatar);
}
requestAnimationFrame(bucleAvatar);

// ----------------------------------------------------
// 9. PLANO EN TARJETAS (panel «Ver mi casa») + casa isométrica
// ----------------------------------------------------
function renderizarCasa() {
    habitacionesCreadas.forEach(hab => {
        const safeId = 'grid-' + hab.replace(/\s+/g, '-');
        const cont = document.getElementById(safeId);
        if(cont) cont.innerHTML = '';
    });

    for (const [hab, aparatos] of Object.entries(casaUsuario)) {
        const safeId = 'grid-' + hab.replace(/\s+/g, '-');
        const areaPlano = document.getElementById(safeId);
        if(areaPlano) {
            aparatos.forEach((ap, index) => {
                const claseBorde = ap.desconectable ? 'borde-desconectable' : 'borde-fijo';
                const dotClass = ap.dejado_conectado ? 'dot-on' : 'dot-off';
                const txtEstado = ap.dejado_conectado ? 'Standby ON' : 'Apagado';

                areaPlano.innerHTML += `
                    <div class="icono-aparato ${claseBorde}">
                        <button class="btn-eliminar-aparato" onclick="eliminarDispositivo('${hab}', ${index})" aria-label="Eliminar">×</button>
                        <strong>${ap.nombre}</strong>
                        <span>Activo: ${ap.horas_uso.toFixed(1)} h</span>
                        <span><i class="status-dot ${dotClass}"></i>${txtEstado}</span>
                    </div>`;
            });
        }
    }

    dibujarCasaIsometrica();
}
