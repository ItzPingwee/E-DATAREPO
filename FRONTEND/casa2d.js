// E-DATA — dibujo de la casa. En la V4 aquí vivirá la simulación 2D isométrica.

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
}
