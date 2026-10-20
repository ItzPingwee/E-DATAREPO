import heapq

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

app = FastAPI(title="E-DATA API Local")

# Permisos para que el HTML se comunique con Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS ESTRUCTURALES ---
class Dispositivo(BaseModel):
    nombre: str
    watts_activos: float
    watts_standby: float
    horas_uso: float
    dejado_conectado: bool
    desconectable: bool

class Habitacion(BaseModel):
    nombre: str
    dispositivos: list[Dispositivo]

class SimulacionRequest(BaseModel):
    habitaciones: list[Habitacion]
    tarifa_kwh: float = 875.04
    presupuesto_diario: float = 2000.0

class IARequest(BaseModel):
    prompt_texto: str

# --- ENDPOINT 1: SIMULACIÓN MATEMÁTICA ---
@app.post("/api/simular")
def simular_consumo(datos: SimulacionRequest):
    total_kwh_dia = 0
    max_heap = []
    
    for hab in datos.habitaciones:
        for disp in hab.dispositivos:
            # 1. Gasto por uso activo
            kwh_activo = (disp.watts_activos * disp.horas_uso) / 1000
            
            kwh_standby = 0
            # 2. Gasto por Standby (Si el usuario lo dejó enchufado)
            if disp.dejado_conectado and disp.horas_uso < 24:
                horas_inactivo = 24 - disp.horas_uso
                kwh_standby = (disp.watts_standby * horas_inactivo) / 1000
                
                # 3. MAX-HEAP: Solo entran los desconectables físicos con fuga real
                if disp.desconectable and disp.watts_standby > 0:
                    heapq.heappush(max_heap, (-disp.watts_standby, disp.nombre, hab.nombre))
            
            total_kwh_dia += (kwh_activo + kwh_standby)
    
    costo_total_cop = total_kwh_dia * datos.tarifa_kwh
    costo_mensual_proyectado = costo_total_cop * 30
    
    # Procesar Vampiros
    vampiros_ordenados = []
    ahorro_mensual_potencial = 0
    nombres_vampiros = []
    
    while max_heap:
        neg_watts, nombre_disp, nombre_hab = heapq.heappop(max_heap)
        watts_reales = -neg_watts
        
        vampiros_ordenados.append({
            "dispositivo": nombre_disp,
            "habitacion": nombre_hab,
            "watts_fantasma": watts_reales
        })
        nombres_vampiros.append(nombre_disp)
        ahorro_mensual_potencial += ((watts_reales * 24) / 1000) * 30 * datos.tarifa_kwh
        
    # Construir Prompt Unificado oculto
    estado_presupuesto = "respetó" if costo_total_cop <= datos.presupuesto_diario else "superó"
    
    prompt_ia = (
        f">>> DATOS E-DATA:\n"
        f"- Balance: El usuario {estado_presupuesto} su presupuesto.\n"
        f"- Gasto diario: ${costo_total_cop:.0f} COP.\n"
        f"- Proyección mensual: ${costo_mensual_proyectado:.0f} COP.\n"
    )
    if vampiros_ordenados:
        prompt_ia += f"- Consumo fantasma: {', '.join(nombres_vampiros)}.\n- Ahorro al mes si los desconecta: ${ahorro_mensual_potencial:.0f} COP."
    else:
        prompt_ia += "- No hay consumo fantasma."

    return {
        "consumo_total_kwh": round(total_kwh_dia, 2),
        "costo_simulado_cop": round(costo_total_cop, 2),
        "ranking_vampiros": vampiros_ordenados,
        "prompt_generado": prompt_ia
    }

# --- ENDPOINT 2: CONSULTA A GEMMA 4 (LM STUDIO) ---
@app.post("/api/ia")
def consultar_ia(req: IARequest):
    try:
        cliente = OpenAI(base_url="http://localhost:6767/v1", api_key="lm-studio")
        instruccion = (
            "Eres el AI Analyst de E-DATA. Evalúa el gasto de energía y sugiere "
            "desconectar los vampiros con su respectivo ahorro mensual en COP. "
            "Usa tono amigable, persuasivo y responde en un solo párrafo."
        )
        respuesta = cliente.chat.completions.create(
            model="local-model",
            messages=[
                {"role": "system", "content": instruccion},
                {"role": "user", "content": req.prompt_texto}
            ],
            temperature=0.6,
            max_tokens=250
        )
        return {"mensaje_ia": respuesta.choices[0].message.content}
    except Exception as e:
        return {"mensaje_ia": f"Error LM Studio: {str(e)}"}