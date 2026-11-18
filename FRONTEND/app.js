// E-DATA — estado global, interfaz y conexión con el backend
// ----------------------------------------------------
// 1. ESTADO GLOBAL
// ----------------------------------------------------
let habitacionesCreadas = ["Sala", "Cocina", "Habitación Principal", "Baño"];
let casaUsuario = { "Sala": [], "Cocina": [], "Habitación Principal": [], "Baño": [] };

// Duración de un día simulado (24 h): 2 minutos. Reloj, contadores y ciclo día/noche usan este mismo valor.
const DURACION_SIMULACION_MS = 120000;

// Dirección del backend (FastAPI). Está en un solo sitio para no repetirla en cada petición.
const URL_BACKEND = 'http://127.0.0.1:8000';

let idSeleccionado = 0;      // id (en catalogoExcel) del dispositivo elegido en el catálogo
let estadoBotonFlotante = 'IDLE';
let numeroSimulacion = 0;   // cuenta las simulaciones: así una animación vieja no muestra el botón de resultados de otra

window.onload = () => {
    actualizarTodoElUI();
    filtrarCatalogo();
};

// ----------------------------------------------------
// 2. PANELES Y BOTÓN PRINCIPAL
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
    // Si la casa cambió (IDLE), los resultados guardados ya no corresponden a ella: se esconde su botón
    if (estado === 'IDLE') document.getElementById('btn-resultados').classList.add('oculto');
}

// ----------------------------------------------------
// 3. HABITACIONES
// ----------------------------------------------------
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
        plano.innerHTML += `
            <div class="habitacion-grid">
                <h3>${hab}</h3>
                <div class="grid-items" id="${idDeHabitacion(hab)}"></div>
            </div>`;
    });

    renderizarCasa();
    renderizarListaAgregadosEnCatalogo();
}

// id HTML de la tarjeta de una habitación en «Mis dispositivos»: "Habitación Principal" -> "grid-Habitación-Principal"
// (un id no puede llevar espacios). Lo usan actualizarTodoElUI y renderizarCasa, así que vive en un solo sitio.
function idDeHabitacion(hab) {
    return 'grid-' + hab.replace(/\s+/g, '-');
}

// Después de instalar o quitar un dispositivo: se redibujan la casa y la lista, y el botón vuelve a "Simular día"
// porque los resultados anteriores ya no corresponden a la casa.
function casaCambio() {
    renderizarCasa();
    renderizarListaAgregadosEnCatalogo();
    ponerEstadoBotonIA('IDLE');
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
            const claseSeleccion = item.id === idSeleccionado ? 'carta-seleccionada' : '';
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
    idSeleccionado = id;
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

// Texto que explica por qué los equipos 'ciclo' y 'continuo' no piden minutos de uso
const TEXTO_TIPO_FIJO = {
    ciclo: "Motor cíclico: funciona ~30% del día en modo automático.",
    continuo: "Equipo continuo: requiere conexión 24 h activa."
};

function actualizarFormularioUI() {
    const aparato = catalogoExcel.find(item => item.id === idSeleccionado);
    if (!aparato) return;

    document.getElementById('txt-nombre-seleccion').innerText = `Configurando: ${aparato.nombre}`;
    dibujarVistaSeleccion(aparato);
    document.getElementById('txt-uso-tipico').textContent = aparato.minutos_tipicos
        ? `Uso típico estimado: ${formatearMinutos(aparato.minutos_tipicos)} al día`
        : '';

    // Solo los de uso 'variable' piden minutos y si se dejan enchufados; los otros dos tipos muestran un texto fijo
    const esVariable = aparato.tipo === "variable";
    const txtInfo = document.getElementById('txt-info-fija');
    document.getElementById('div-minutos').style.display = esVariable ? "block" : "none";
    document.getElementById('div-conexion').style.display = esVariable ? "flex" : "none";
    txtInfo.style.display = esVariable ? "none" : "block";
    if (!esVariable) txtInfo.textContent = TEXTO_TIPO_FIJO[aparato.tipo];
    document.getElementById('check-desconectable').checked = esVariable;
}

// ----------------------------------------------------
// 4. DISPOSITIVOS INSTALADOS
// ----------------------------------------------------
function instalarDispositivo() {
    if (habitacionesCreadas.length === 0) {
        alert("Primero debes modelar tu casa y crear al menos una habitación.");
        return;
    }

    const hab = document.getElementById('select-habitacion').value;
    const aparato = catalogoExcel.find(item => item.id === idSeleccionado);
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
    casaCambio();
}

function eliminarDispositivo(hab, indexAparato) {
    casaUsuario[hab].splice(indexAparato, 1);
    casaCambio();
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

// ----------------------------------------------------
// 5. SIMULACIÓN Y CONEXIÓN CON EL BACKEND
// ----------------------------------------------------
// Envía 'datos' en JSON a una ruta del backend (POST) y devuelve la respuesta ya convertida a objeto.
// Las dos peticiones de la app (/api/simular y /api/ia) se hacen igual, por eso viven en una sola función.
async function enviarAlBackend(ruta, datos) {
    const respuesta = await fetch(URL_BACKEND + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });
    if (!respuesta.ok) throw new Error("Error en servidor local.");
    return respuesta.json();
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
    const miSimulacion = ++numeroSimulacion;

    const payload = { habitaciones: Object.entries(casaUsuario).map(([hab, disp]) => ({ nombre: hab, dispositivos: disp })) };

    try {
        const datos = await enviarAlBackend('/api/simular', payload);

        // Reinicia la animación del ciclo día/noche: quitarla, forzar que el navegador lo note (offsetWidth) y ponerla otra vez
        const panelVista = document.getElementById('panel-vista');
        panelVista.style.animation = "none";
        void panelVista.offsetWidth;
        panelVista.style.animation = `cicloDiaNoche ${DURACION_SIMULACION_MS / 1000}s ease-in-out forwards`;
        // Al terminar el día simulado (2 min) aparece el botón del panel de resultados. No espera a la IA, que es lenta.
        animarContadoresTiempoReal(datos.consumo_total_kwh, datos.costo_simulado_cop, () => {
            const sigueVigente = miSimulacion === numeroSimulacion && estadoBotonFlotante !== 'IDLE';
            if (!sigueVigente) return;   // la casa cambió o empezó otra simulación: estos datos ya no sirven
            dibujarPanelResultados(datos);
            document.getElementById('btn-resultados').classList.remove('oculto');
        });

        document.getElementById('mensaje-ia-texto').innerText = "Gemma 4 está analizando tus datos...";
        const datosIA = await enviarAlBackend('/api/ia', { prompt_texto: datos.prompt_generado });
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

// Escribe la hora del reloj digital: 545 minutos -> "09:05"
function formatearHora(minutos) {
    const dosCifras = n => n.toString().padStart(2, '0');
    return `${dosCifras(Math.floor(minutos / 60))}:${dosCifras(minutos % 60)}`;
}

// Escribe un valor en pesos colombianos: 1234567.8 -> "$1.234.568"
function formatearPesos(valor) {
    return '$' + Math.round(valor).toLocaleString('es-CO');
}

// Escribe energía con coma decimal: 1.4816 -> "1,48 kWh". Así el punto queda solo para los miles de los pesos ("$1.296")
// y los dos números juntos no se confunden.
function formatearKwh(valor) {
    return valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kWh';
}

// Llena el panel de resultados con lo que devolvió /api/simular. No usa la IA.
function dibujarPanelResultados(datos) {
    const ahorroMes = datos.ahorro_mensual_cop || 0;
    const ahorroAnio = ahorroMes * 12;   // el backend calcula el mes con 30 días; el año son 12 de esos meses

    document.getElementById('res-kwh').textContent = formatearKwh(datos.consumo_total_kwh);
    document.getElementById('res-cop').textContent = formatearPesos(datos.costo_simulado_cop);
    document.getElementById('res-ahorro-mes').textContent = formatearPesos(ahorroMes);
    document.getElementById('res-ahorro-anio').textContent = formatearPesos(ahorroAnio);
    document.getElementById('res-costo-mes').textContent = formatearPesos(datos.costo_simulado_cop * 30);

    const ranking = datos.ranking_vampiros;
    const hayAhorro = ranking.length > 0;
    document.querySelector('.ahorro-resultados').classList.toggle('sin-ahorro', !hayAhorro);   // sin vampiros, las cifras se apagan
    document.getElementById('res-mensaje').textContent = hayAhorro
        ? 'Si desconectas tus dispositivos vampiro, ahorrarías'
        : 'Ningún dispositivo desconectable gasta en reposo, así que no hay nada que desconectar.';

    const lista = document.getElementById('res-vampiros');
    document.getElementById('res-titulo-vampiros').hidden = !hayAhorro;   // sin vampiros no hay ranking: tampoco su título
    if (!hayAhorro) {
        lista.innerHTML = '';
        return;
    }

    // El backend ya entrega el ranking de mayor a menor, así que el primero es el que llena la barra completa.
    // Aquí sí se numera: el orden del ranking es justo lo que importa.
    const maximo = ranking[0].watts_fantasma;
    lista.innerHTML = ranking.map((v, i) => `
        <li class="fila-vampiro">
            <span class="puesto-vampiro">${i + 1}</span>
            <span class="nombre-vampiro"><strong>${v.dispositivo}</strong><small>${v.habitacion}</small></span>
            <span class="barra-vampiro"><span class="relleno-vampiro" style="width: ${(v.watts_fantasma / maximo) * 100}%"></span></span>
            <span class="watts-vampiro">${v.watts_fantasma} W</span>
        </li>`).join('');
}

function animarContadoresTiempoReal(kwhFinal, copFinal, alTerminar) {
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
        const minSim = Math.floor(progreso * 1440);   // 1440 = minutos de un día
        horaDigital.innerText = formatearHora(minSim);
        actualizarCielo(minSim);
        txtKwh.innerText = formatearKwh(progreso * kwhFinal);
        txtCop.innerText = formatearPesos(progreso * copFinal);
        if (progreso < 1) requestAnimationFrame(actualizar);
        else alTerminar();
    }
    requestAnimationFrame(actualizar);
}
