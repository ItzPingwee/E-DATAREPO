// E-DATA — portada: una "cortina" que cubre la app hasta que el usuario la levanta.
// Se puede levantar de cuatro formas, para que nadie se quede atrapado:
//   1) arrastrando hacia arriba con el mouse (el gesto principal)
//   2) girando la rueda hacia abajo
//   3) haciendo clic en las flechas
//   4) con el teclado (Enter, Espacio o flecha arriba)

const portada = document.getElementById('portada');
const botonEntrar = document.getElementById('btn-entrar');

const FRACCION_PARA_ENTRAR = 0.3;   // hay que arrastrar al menos el 30 % del alto; si no, la cortina rebota
const MS_SUBIDA = 600;              // debe coincidir con la transición de #portada en el CSS

const PIXELES_DE_CLIC = 5;          // si el mouse se movió menos que esto, fue un clic y no un arrastre

let inicioArrastre = null;          // altura (clientY) donde empezó el arrastre; null = no se está arrastrando
let empezoEnLasFlechas = false;     // true si el usuario pulsó justo sobre el botón de las flechas
let subida = 0;                     // cuánto se ha levantado la cortina, en píxeles

function moverCortina(pixeles) {
    subida = Math.max(0, pixeles);   // nunca baja más allá de su posición inicial
    portada.style.transform = `translateY(${-subida}px)`;
    // --progreso va de 0 a 1 hasta la distancia que basta para entrar: el CSS enciende la hoja del logo con ese valor
    const distanciaParaEntrar = window.innerHeight * FRACCION_PARA_ENTRAR;
    portada.style.setProperty('--progreso', Math.min(subida / distanciaParaEntrar, 1));
}

// Sube la cortina del todo. Al terminar la animación se desactiva para que no tape ni intercepte nada.
function entrarALaApp() {
    if (!portada.classList.contains('visible')) return;
    portada.classList.remove('visible');
    portada.classList.remove('arrastrando');
    portada.style.transform = 'translateY(-100%)';
    portada.style.setProperty('--progreso', 1);
    portada.setAttribute('inert', '');   // inert: nada dentro de la portada recibe foco ni clics
    setTimeout(() => { portada.style.visibility = 'hidden'; }, MS_SUBIDA);
}

portada.addEventListener('pointerdown', (evento) => {
    inicioArrastre = evento.clientY;
    empezoEnLasFlechas = evento.target.closest('#btn-entrar') !== null;
    portada.setPointerCapture(evento.pointerId);   // seguimos el mouse aunque salga de la portada
    portada.classList.add('arrastrando');          // mientras se arrastra no hay transición: la cortina sigue la mano al instante
});

portada.addEventListener('pointermove', (evento) => {
    if (inicioArrastre === null) return;
    moverCortina(inicioArrastre - evento.clientY);
});

function soltarCortina() {
    if (inicioArrastre === null) return;
    const hastaDondeSubio = subida;
    inicioArrastre = null;
    portada.classList.remove('arrastrando');
    const fueUnClic = hastaDondeSubio < PIXELES_DE_CLIC;
    if (hastaDondeSubio > window.innerHeight * FRACCION_PARA_ENTRAR) entrarALaApp();
    else if (fueUnClic && empezoEnLasFlechas) entrarALaApp();   // clic en las flechas: entra sin necesidad de arrastrar
    else moverCortina(0);   // no llegó lo suficiente: rebota a su sitio
}
portada.addEventListener('pointerup', soltarCortina);
portada.addEventListener('pointercancel', soltarCortina);

// Rueda hacia abajo (deltaY positivo) = "bajar la página": la cortina sube
portada.addEventListener('wheel', (evento) => {
    if (evento.deltaY > 0) entrarALaApp();
}, { passive: true });

// Enter o Espacio sobre el botón disparan 'click' (con el mouse el clic lo resuelve pointerup, porque la portada captura el puntero)
botonEntrar.addEventListener('click', entrarALaApp);

// Teclado: Enter, Espacio o flecha arriba, sin necesidad de enfocar nada primero
// (así no hace falta darle foco al botón al cargar, que dibujaría un recuadro verde sobre la portada)
document.addEventListener('keydown', (evento) => {
    if (['Enter', ' ', 'ArrowUp'].includes(evento.key)) entrarALaApp();
});
