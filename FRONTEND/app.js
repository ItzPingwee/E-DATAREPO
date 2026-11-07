// E-DATA — estado global, interfaz y conexión con el backend
// ----------------------------------------------------
// 1. BASE DE DATOS Y ESTADO GLOBAL
// ----------------------------------------------------
function toggleOverlay(id) { document.getElementById(id).classList.toggle('oculto'); }


let habitacionesCreadas = ["Sala", "Cocina", "Habitación Principal", "Baño"]; 
let casaUsuario = { "Sala": [], "Cocina": [], "Habitación Principal": [], "Baño": [] }; 

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
    
    estadoBotonFlotante = 'IDLE'; 
    document.getElementById('icono-btn-ia').innerText = '🤖';
    document.getElementById('badge-ia').classList.add('oculto');
}

function actualizarTodoElUI() {
    const listaMod = document.getElementById('lista-habitaciones-creadas');
    listaMod.innerHTML = '';
    habitacionesCreadas.forEach(hab => {
        listaMod.innerHTML += `
            <div class="item-lista">
                <span>${hab}</span>
                <button class="btn-eliminar-small" onclick="eliminarHabitacion('${hab}')">✖</button>
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
            <div class="habitacion-grid" style="border-top: 3px solid #66fcf1;">
                <h3>${hab}</h3>
                <div class="grid-items" id="${safeId}"></div>
            </div>`;
    });

    renderizarCasa(); 
    renderizarListaAgregadosEnCatalogo();
}

function filtrarCatalogo() {
    const texto = document.getElementById('input-buscador').value.toLowerCase();
    const zonaSelec = document.getElementById('filtro-zona').value;
    
    const grid = document.getElementById('grid-catalogo');
    grid.innerHTML = '';
    
    catalogoExcel.forEach((item) => {
        const matchTexto = item.nombre.toLowerCase().includes(texto) || item.marcas.toLowerCase().includes(texto);
        const matchZona = (zonaSelec === "Todas" || item.zona === zonaSelec);
        
        if (matchTexto && matchZona) {
            const claseSeleccion = item.id === indexSeleccionado ? 'carta-seleccionada' : '';
            
            const imagenVisual = item.url_imagen 
                ? `<img src="${item.url_imagen}" class="img-dispositivo" alt="${item.nombre}">` 
                : `<div class="img-placeholder">${item.icono}</div>`;

            grid.innerHTML += `
                <div class="carta-dispositivo ${claseSeleccion}" onclick="seleccionarDispositivo(${item.id})">
                    <div class="checkmark-seleccion">✔</div>
                    
                    ${imagenVisual}
                    
                    <h4>${item.nombre}</h4>
                    
                    <!-- INFO DETALLADA EN HOVER -->
                    <div class="hover-info">
                        <span class="marcas-texto"><strong>Marcas:</strong><br>${item.marcas}</span>
                        <span class="potencia-info">⚡ Uso: ~${item.watts_activos}W</span>
                        <span class="standby-info">🔌 Standby: ~${item.watts_standby}W</span>
                    </div>
                </div>
            `;
        }
    });
    actualizarFormularioUI();
}

function seleccionarDispositivo(id) {
    indexSeleccionado = id;
    filtrarCatalogo();
}

function actualizarFormularioUI() {
    const aparato = catalogoExcel.find(item => item.id === indexSeleccionado);
    if (!aparato) return;

    document.getElementById('txt-nombre-seleccion').innerText = `Configurando: ${aparato.nombre}`;
    const divMin = document.getElementById('div-minutos');
    const divCon = document.getElementById('div-conexion');
    const txtInfo = document.getElementById('txt-info-fija');
    const chkDesc = document.getElementById('check-desconectable');

    if (aparato.tipo === "variable") {
        divMin.style.display = "block"; divCon.style.display = "flex"; txtInfo.style.display = "none";
        chkDesc.checked = true;
    } else if (aparato.tipo === "ciclo") {
        divMin.style.display = "none"; divCon.style.display = "none"; txtInfo.style.display = "block";
        txtInfo.innerHTML = "ℹ️ Motor cíclico: Funciona ~30% del día en modo automático.";
        chkDesc.checked = false;
    } else {
        divMin.style.display = "none"; divCon.style.display = "none"; txtInfo.style.display = "block";
        txtInfo.innerHTML = "ℹ️ Equipo Continuo: Requiere conexión 24h activa.";
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
        nombre: aparato.nombre, watts_activos: aparato.watts_activos, watts_standby: aparato.watts_standby,
        horas_uso: hrs, dejado_conectado: conectado, desconectable: document.getElementById('check-desconectable').checked
    });

    renderizarCasa();
    renderizarListaAgregadosEnCatalogo();
    estadoBotonFlotante = 'IDLE'; 
    document.getElementById('icono-btn-ia').innerText = '🤖';
    document.getElementById('badge-ia').classList.add('oculto');
}

function eliminarDispositivo(hab, indexAparato) {
    casaUsuario[hab].splice(indexAparato, 1);
    renderizarCasa();
    renderizarListaAgregadosEnCatalogo();
    
    estadoBotonFlotante = 'IDLE'; 
    document.getElementById('icono-btn-ia').innerText = '🤖';
    document.getElementById('badge-ia').classList.add('oculto');
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
                    <span><strong>${ap.nombre}</strong> <span style="color:#aaa;">📍 ${hab}</span></span>
                    <button class="btn-eliminar-small" onclick="eliminarDispositivo('${hab}', ${index})">✖</button>
                </div>`;
        });
    }
    if(contadorTotal === 0) lista.innerHTML = `<span style="color:#aaa; font-size:12px; font-style:italic;">Aún no has agregado dispositivos.</span>`;
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
    estadoBotonFlotante = 'CALCULANDO';
    document.getElementById('icono-btn-ia').innerText = '⏳';
    document.getElementById('badge-ia').classList.add('oculto');
    cerrarChatIA();

    const payload = { habitaciones: Object.entries(casaUsuario).map(([hab, disp]) => ({ nombre: hab, dispositivos: disp })) };

    try {
        const resMath = await fetch('http://127.0.0.1:8000/api/simular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!resMath.ok) throw new Error("Error en servidor local.");
        const datos = await resMath.json();
        
        let htmlVampiros = "";
        if (datos.ranking_vampiros.length > 0) {
            htmlVampiros = `<hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;"><h4 style="color:#ff4d4d; margin:0 0 10px 0;">Fugas en Reposo Detectadas:</h4>`;
            datos.ranking_vampiros.forEach(v => {
                htmlVampiros += `<div class="vampiro-item"><strong>${v.dispositivo}</strong> - ${v.watts_fantasma}W desperdiciados</div>`;
            });
        }
        document.getElementById('resumen-fugas').innerHTML = htmlVampiros;

        document.getElementById('panel-vista').style.animation = "none";
        void document.getElementById('panel-vista').offsetWidth; 
        document.getElementById('panel-vista').style.animation = "cicloDiaNoche 60s ease-in-out forwards";
        animarContadoresTiempoReal(datos.consumo_total_kwh, datos.costo_simulado_cop);

        document.getElementById('mensaje-ia-texto').innerText = "Gemma 4 está analizando tus datos...";
        const resIA = await fetch('http://127.0.0.1:8000/api/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_texto: datos.prompt_generado }) });
        const datosIA = await resIA.json();
        document.getElementById('mensaje-ia-texto').innerText = datosIA.mensaje_ia;
        
        estadoBotonFlotante = 'LISTO';
        document.getElementById('icono-btn-ia').innerText = '🤖';
        document.getElementById('badge-ia').classList.remove('oculto'); 
    } catch (error) { 
        alert(error.message);
        estadoBotonFlotante = 'IDLE'; document.getElementById('icono-btn-ia').innerText = '🤖';
    }
}

function animarContadoresTiempoReal(kwhFinal, copFinal) {
    const reloj = document.getElementById('reloj-simulacion');
    const contadores = document.getElementById('contadores-tiempo-real');
    reloj.style.display = 'block'; contadores.style.display = 'flex';
    
    const txtKwh = document.getElementById('live-kwh');
    const txtCop = document.getElementById('live-cop');
    
    const duracion = 60000; const inicio = performance.now();
    function actualizar(tiempo) {
        let progreso = (tiempo - inicio) / duracion;
        if (progreso > 1) progreso = 1;
        let minSim = Math.floor(progreso * 1440);
        reloj.innerText = `${Math.floor(minSim / 60).toString().padStart(2, '0')}:${(minSim % 60).toString().padStart(2, '0')}`;
        txtKwh.innerText = `${(progreso * kwhFinal).toFixed(2)} kWh`;
        txtCop.innerText = `$${Math.floor(progreso * copFinal).toLocaleString('es-CO')}`;
        if (progreso < 1) requestAnimationFrame(actualizar);
    }
    requestAnimationFrame(actualizar);
}
