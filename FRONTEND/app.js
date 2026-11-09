// E-DATA — estado global, interfaz y conexión con el backend
// ----------------------------------------------------
// 1. BASE DE DATOS Y ESTADO GLOBAL
// ----------------------------------------------------
function toggleOverlay(id) { document.getElementById(id).classList.toggle('oculto'); }

// El botón principal tiene tres estados y esta función es el único sitio que los cambia:
//  IDLE = listo para simular · CALCULANDO = simulando y esperando a la IA · LISTO = el análisis ya se puede abrir
// El texto lo escribe JS; el ícono lo elige el CSS según la clase ('calculando' o 'listo').
const TEXTO_BOTON_IA = { IDLE: 'Simular día', CALCULANDO: 'Calculando…', LISTO: 'Ver análisis' };

function ponerEstadoBotonIA(estado) {
    estadoBotonFlotante = estado;
    const boton = document.getElementById('btn-chat-ia');
    boton.classList.toggle('calculando', estado === 'CALCULANDO');
    boton.classList.toggle('listo', estado === 'LISTO');
    document.getElementById('txt-btn-ia').textContent = TEXTO_BOTON_IA[estado];
    document.getElementById('badge-ia').classList.toggle('oculto', estado !== 'LISTO');   // el punto ámbar avisa que hay análisis nuevo
}


let habitacionesCreadas = ["Sala", "Cocina", "Habitación Principal", "Baño"]; 
let casaUsuario = { "Sala": [], "Cocina": [], "Habitación Principal": [], "Baño": [] }; 

// Duración de un día simulado (24 h): 2 minutos. Reloj, contadores y ciclo día/noche usan este mismo valor.
const DURACION_SIMULACION_MS = 120000;

let indexSeleccionado = 0;
let estadoBotonFlotante = 'IDLE'; 

window.onload = () => { 
    actualizarTodoElUI(); 
    filtrarCatalogo(); 
};

function agregarHabitacion() {
    const input = document.getElementById('input-nueva-hab');
    const nombre = input.value.trim();
    if(nombre === "") return;
    
    if (habitacionesCreadas.length >= MAX_HABITACIONES) {
        alert(`Tu casa puede tener hasta ${MAX_HABITACIONES} habitaciones para que se siga viendo completa.`);
        return;
    }

    if(!habitacionesCreadas.includes(nombre)) {
        habitacionesCreadas.push(nombre);
        casaUsuario[nombre] = [];
        actualizarTodoElUI();
        input.value = "";
    } else {
        alert("Esa habitación ya existe.");
    }
}

function eliminarHabitacion(nombre) {
    habitacionesCreadas = habitacionesCreadas.filter(h => h !== nombre);
    delete casaUsuario[nombre]; 
    actualizarTodoElUI();
    
    ponerEstadoBotonIA('IDLE');
}

function actualizarTodoElUI() {
    const listaMod = document.getElementById('lista-habitaciones-creadas');
    listaMod.innerHTML = '';
    habitacionesCreadas.forEach(hab => {
        listaMod.innerHTML += `
            <div class="item-lista">
                <span>${hab}</span>
                <button class="btn-eliminar-small" onclick="eliminarHabitacion('${hab}')" aria-label="Eliminar">×</button>
            </div>`;
    });

    const selector = document.getElementById('select-habitacion');
    selector.innerHTML = '';
    habitacionesCreadas.forEach(hab => {
        selector.innerHTML += `<option value="${hab}">${hab}</option>`;
    });

    const plano = document.getElementById('plano-grid-dinamico');
    plano.innerHTML = '';
    habitacionesCreadas.forEach(hab => {
        const safeId = 'grid-' + hab.replace(/\s+/g, '-');
        plano.innerHTML += `
            <div class="habitacion-grid">
                <h3>${hab}</h3>
                <div class="grid-items" id="${safeId}"></div>
            </div>`;
    });

    renderizarCasa(); 
    renderizarListaAgregadosEnCatalogo();
}

// HTML de la foto de un dispositivo. Si no tiene foto (o el archivo no carga) se muestra su emoji.
// encodeURI convierte espacios y letras como la ñ en una ruta válida para el navegador.
function htmlImagenDispositivo(item) {
    if (!item.imagen) return `<div class="img-placeholder">${item.icono}</div>`;
    const ruta = encodeURI(CARPETA_IMAGENES + item.imagen);
    return `<img src="${ruta}" class="img-dispositivo" alt="${item.nombre}" loading="lazy" data-icono="${item.icono}" onerror="reemplazarPorEmoji(this)">`;
}

// Se ejecuta si una foto no carga: cambia la <img> rota por el emoji del dispositivo
function reemplazarPorEmoji(img) {
    const placeholder = document.createElement('div');
    placeholder.className = 'img-placeholder';
    placeholder.textContent = img.dataset.icono;
    img.replaceWith(placeholder);
}

function filtrarCatalogo() {
    // normalizarTexto quita tildes y mayúsculas: buscar "bano" o "cafe" encuentra "Baño" y "Café"
    const texto = normalizarTexto(document.getElementById('input-buscador').value);
    const zonaSelec = document.getElementById('filtro-zona').value;

    const grid = document.getElementById('grid-catalogo');
    grid.innerHTML = '';

    catalogoExcel.forEach((item) => {
        const matchTexto = normalizarTexto(item.nombre).includes(texto) || normalizarTexto(item.marcas).includes(texto);
        const matchZona = (zonaSelec === "Todas" || item.zona === zonaSelec);

        if (matchTexto && matchZona) {
            const claseSeleccion = item.id === indexSeleccionado ? 'carta-seleccionada' : '';
            const imagenVisual = htmlImagenDispositivo(item);

            grid.innerHTML += `
                <div class="carta-dispositivo ${claseSeleccion}" onclick="seleccionarDispositivo(${item.id})">
                    <div class="checkmark-seleccion">✓</div>
                    
                    ${imagenVisual}
                    
                    <h4>${item.nombre}</h4>
                    
                    <!-- INFO DETALLADA EN HOVER -->
                    <div class="hover-info">
                        <span class="marcas-texto"><strong>Marcas:</strong><br>${item.marcas}</span>
                        <span class="potencia-info">Uso: ~${item.watts_activos} W</span>
                        <span class="standby-info">Standby: ~${item.watts_standby} W</span>
                    </div>
                </div>
            `;
        }
    });
    actualizarFormularioUI();
}

function seleccionarDispositivo(id) {
    indexSeleccionado = id;
    // Al elegir un dispositivo, la habitación de destino se ajusta a su zona (una nevera -> Cocina)
    const aparato = catalogoExcel.find(item => item.id === id);
    sincronizarHabitacionConZona(aparato.zona);

    // El formulario propone el uso típico del aparato. Se carga aquí (y no en actualizarFormularioUI)
    // porque esa función corre también al buscar o filtrar y borraría los minutos que el usuario escribió.
    if (aparato.minutos_tipicos) {
        document.getElementById('input-minutos').value = aparato.minutos_tipicos;
    }
    filtrarCatalogo();
}

// Convierte minutos a texto legible: 20 -> "20 min", 240 -> "4 h", 90 -> "1 h 30 min"
function formatearMinutos(minutos) {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas === 0) return `${resto} min`;
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

// Panel derecho: foto grande, marcas, consumos y, si existe, la fuente del dato
function dibujarVistaSeleccion(aparato) {
    const fuente = aparato.fuente
        ? `<p class="fuente-dato">Fuente: <a href="${aparato.fuente}" target="_blank" rel="noopener noreferrer">consultar</a>${aparato.nota_fuente ? ' · ' + aparato.nota_fuente : ''}</p>`
        : '';
    document.getElementById('vista-seleccion').innerHTML = `
        ${htmlImagenDispositivo(aparato)}
        <p class="marcas-seleccion"><strong>Marcas:</strong> ${aparato.marcas}</p>
        <p class="consumos-seleccion">
            <span class="potencia-info">Uso: ~${aparato.watts_activos} W</span>
            <span class="standby-info">Standby: ~${aparato.watts_standby} W</span>
        </p>
        ${fuente}`;
}

// Quita tildes y mayúsculas para poder comparar textos ("Habitación" == "habitacion")
function normalizarTexto(texto) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Busca entre las habitaciones creadas una cuyo nombre contenga la zona y la deja seleccionada.
// Ej.: zona "Cocina" -> "Cocina"; zona "Habitación" -> "Habitación Principal".
// Si no hay coincidencia (o la zona es "Todas" / "General"), no cambia nada.
function sincronizarHabitacionConZona(zona) {
    if (zona === "Todas" || zona === "General") return;

    const selector = document.getElementById('select-habitacion');
    const zonaNormalizada = normalizarTexto(zona);
    const habitacionCoincidente = habitacionesCreadas.find(hab => normalizarTexto(hab).includes(zonaNormalizada));

    if (habitacionCoincidente) selector.value = habitacionCoincidente;
}

// Se ejecuta al cambiar el filtro de zona: sincroniza la habitación y actualiza el catálogo
function cambiarFiltroZona() {
    sincronizarHabitacionConZona(document.getElementById('filtro-zona').value);
    filtrarCatalogo();
}

function actualizarFormularioUI() {
    const aparato = catalogoExcel.find(item => item.id === indexSeleccionado);
    if (!aparato) return;

    document.getElementById('txt-nombre-seleccion').innerText = `Configurando: ${aparato.nombre}`;
    dibujarVistaSeleccion(aparato);
    document.getElementById('txt-uso-tipico').textContent = aparato.minutos_tipicos
        ? `Uso típico estimado: ${formatearMinutos(aparato.minutos_tipicos)} al día`
        : '';
    const divMin = document.getElementById('div-minutos');
    const divCon = document.getElementById('div-conexion');
    const txtInfo = document.getElementById('txt-info-fija');
    const chkDesc = document.getElementById('check-desconectable');

    if (aparato.tipo === "variable") {
        divMin.style.display = "block"; divCon.style.display = "flex"; txtInfo.style.display = "none";
        chkDesc.checked = true;
    } else if (aparato.tipo === "ciclo") {
        divMin.style.display = "none"; divCon.style.display = "none"; txtInfo.style.display = "block";
        txtInfo.innerHTML = "Motor cíclico: funciona ~30% del día en modo automático.";
        chkDesc.checked = false;
    } else {
        divMin.style.display = "none"; divCon.style.display = "none"; txtInfo.style.display = "block";
        txtInfo.innerHTML = "Equipo continuo: requiere conexión 24 h activa.";
        chkDesc.checked = false;
    }
}

function instalarDispositivo() {
    if (habitacionesCreadas.length === 0) {
        alert("Primero debes modelar tu casa y crear al menos una habitación.");
        return;
    }

    const hab = document.getElementById('select-habitacion').value;
    const aparato = catalogoExcel.find(item => item.id === indexSeleccionado);
    let hrs = 0, conectado = true;

    if (aparato.tipo === "variable") {
        hrs = document.getElementById('input-minutos').value / 60;
        conectado = document.getElementById('check-conectado').checked;
    } else if (aparato.tipo === "ciclo") {
        hrs = 24 * 0.30; conectado = true;
    } else { hrs = 24; conectado = true; }

    casaUsuario[hab].push({
        id: aparato.id,   // con el id, la casa sabe qué dibujo usar (el backend ignora este campo)
        nombre: aparato.nombre, icono: aparato.icono, watts_activos: aparato.watts_activos, watts_standby: aparato.watts_standby,
        horas_uso: hrs, dejado_conectado: conectado, desconectable: document.getElementById('check-desconectable').checked
    });

    renderizarCasa();
    renderizarListaAgregadosEnCatalogo();
    ponerEstadoBotonIA('IDLE');
}

function eliminarDispositivo(hab, indexAparato) {
    casaUsuario[hab].splice(indexAparato, 1);
    renderizarCasa();
    renderizarListaAgregadosEnCatalogo();
    
    ponerEstadoBotonIA('IDLE');
}

function renderizarListaAgregadosEnCatalogo() {
    const lista = document.getElementById('lista-dispositivos-agregados');
    lista.innerHTML = '';
    let contadorTotal = 0;
    
    for (const [hab, aparatos] of Object.entries(casaUsuario)) {
        aparatos.forEach((ap, index) => {
            contadorTotal++;
            lista.innerHTML += `
                <div class="item-lista-agregado">
                    <span><strong>${ap.nombre}</strong> <span class="ubicacion">${hab}</span></span>
                    <button class="btn-eliminar-small" onclick="eliminarDispositivo('${hab}', ${index})" aria-label="Eliminar">×</button>
                </div>`;
        });
    }
    if(contadorTotal === 0) lista.innerHTML = `<span class="vacio">Aún no has agregado dispositivos.</span>`;
}


async function manejarClickBotonFlotante() {
    let totalEquipos = 0;
    for (let h in casaUsuario) totalEquipos += casaUsuario[h].length;
    
    if (totalEquipos === 0) {
        alert("Para simular, primero debes instalar al menos un dispositivo en tu casa.");
        return;
    }

    if (estadoBotonFlotante === 'IDLE') await ejecutarMotorTotal();
    else if (estadoBotonFlotante === 'LISTO') abrirChatIA();
}

function abrirChatIA() {
    document.getElementById('panel-chat-ia').classList.remove('oculto');
    document.getElementById('badge-ia').classList.add('oculto'); 
}

function cerrarChatIA() { document.getElementById('panel-chat-ia').classList.add('oculto'); }

async function ejecutarMotorTotal() {
    ponerEstadoBotonIA('CALCULANDO');
    cerrarChatIA();

    const payload = { habitaciones: Object.entries(casaUsuario).map(([hab, disp]) => ({ nombre: hab, dispositivos: disp })) };

    try {
        const resMath = await fetch('http://127.0.0.1:8000/api/simular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!resMath.ok) throw new Error("Error en servidor local.");
        const datos = await resMath.json();
        
        let htmlVampiros = "";
        if (datos.ranking_vampiros.length > 0) {
            htmlVampiros = `<h4 class="titulo-fugas">Fugas en reposo detectadas</h4>`;
            datos.ranking_vampiros.forEach(v => {
                htmlVampiros += `<div class="vampiro-item"><strong>${v.dispositivo}</strong> - ${v.watts_fantasma} W desperdiciados</div>`;
            });
        }
        document.getElementById('resumen-fugas').innerHTML = htmlVampiros;

        document.getElementById('panel-vista').style.animation = "none";
        void document.getElementById('panel-vista').offsetWidth; 
        document.getElementById('panel-vista').style.animation = `cicloDiaNoche ${DURACION_SIMULACION_MS / 1000}s ease-in-out forwards`;
        animarContadoresTiempoReal(datos.consumo_total_kwh, datos.costo_simulado_cop);

        document.getElementById('mensaje-ia-texto').innerText = "Gemma 4 está analizando tus datos...";
        const resIA = await fetch('http://127.0.0.1:8000/api/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_texto: datos.prompt_generado }) });
        const datosIA = await resIA.json();
        document.getElementById('mensaje-ia-texto').innerText = datosIA.mensaje_ia;
        
        ponerEstadoBotonIA('LISTO');
    } catch (error) { 
        alert(error.message);
        ponerEstadoBotonIA('IDLE');
    }
}

// Mueve el sol (06:00 a 18:00) y la luna (18:00 a 06:00) por el arco del reloj.
// Cada astro tarda 12 horas simuladas en cruzar el cielo de izquierda a derecha.
function actualizarCielo(minutosSimulados) {
    const horas = minutosSimulados / 60;
    const esDia = horas >= 6 && horas < 18;

    // fraccion: 0 = el astro sale por la izquierda, 0.5 = punto más alto, 1 = se oculta por la derecha
    const fraccion = ((horas - 6 + 24) % 12) / 12;
    const x = (1 - Math.cos(Math.PI * fraccion)) / 2;   // avance horizontal (0 a 1)
    const y = Math.sin(Math.PI * fraccion);             // altura (0 a 1): forma el arco

    const reloj = document.getElementById('reloj-simulacion');
    reloj.style.setProperty('--x', x.toFixed(3));       // el CSS usa estas variables para colocar el astro
    reloj.style.setProperty('--y', y.toFixed(3));
    reloj.classList.toggle('es-dia', esDia);
}

function animarContadoresTiempoReal(kwhFinal, copFinal) {
    const reloj = document.getElementById('reloj-simulacion');
    const horaDigital = document.getElementById('hora-digital');
    const contadores = document.getElementById('contadores-tiempo-real');
    reloj.style.display = 'block'; contadores.style.display = 'flex';

    const txtKwh = document.getElementById('live-kwh');
    const txtCop = document.getElementById('live-cop');

    const inicio = performance.now();
    function actualizar(tiempo) {
        let progreso = (tiempo - inicio) / DURACION_SIMULACION_MS;
        if (progreso > 1) progreso = 1;
        let minSim = Math.floor(progreso * 1440);
        horaDigital.innerText = `${Math.floor(minSim / 60).toString().padStart(2, '0')}:${(minSim % 60).toString().padStart(2, '0')}`;
        actualizarCielo(minSim);
        txtKwh.innerText = `${(progreso * kwhFinal).toFixed(2)} kWh`;
        txtCop.innerText = `$${Math.floor(progreso * copFinal).toLocaleString('es-CO')}`;
        if (progreso < 1) requestAnimationFrame(actualizar);
    }
    requestAnimationFrame(actualizar);
}
