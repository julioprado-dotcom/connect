'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, Activity, Wifi, RefreshCw, ChevronRight, Terminal, Crosshair } from 'lucide-react';

// Tipos de datos (Deberían coincidir con tu backend)
type NivelAlerta = 'VERDE' | 'AMARILLO' | 'ROJO';
type EjeData = {
  id: string;
  nombre: string;
  estado: NivelAlerta;
  valor: number; // 0-100 para barra de progreso
  alertasCount: number;
};
type CruceData = {
  origen: string;
  destino: string;
  impacto: 'CRITICO' | 'ALTO' | 'MEDIO';
};
type DashboardData = {
  global: NivelAlerta;
  timestamp: string;
  ejes: EjeData[];
  cruces: CruceData[];
  totalAlertas: number;
};

// Datos Mock para demostración (Se reemplazan con fetch real)
const MOCK_DATA: DashboardData = {
  global: 'ROJO',
  timestamp: new Date().toISOString(),
  totalAlertas: 16,
  ejes: [
    { id: 'MACRO', nombre: 'MACROECONOMÍA', estado: 'ROJO', valor: 92, alertasCount: 4 },
    { id: 'SOCIAL', nombre: 'CONFLICTIVIDAD', estado: 'ROJO', valor: 88, alertasCount: 5 },
    { id: 'ENERGIA', nombre: 'ENERGÍA', estado: 'ROJO', valor: 75, alertasCount: 3 },
    { id: 'POLITICA', nombre: 'GOBERNANZA', estado: 'AMARILLO', valor: 45, alertasCount: 2 },
    { id: 'LOGISTICA', nombre: 'LOGÍSTICA', estado: 'ROJO', valor: 80, alertasCount: 1 },
    { id: 'AMBIENTE', nombre: 'CLIMA/AGUA', estado: 'ROJO', valor: 60, alertasCount: 1 },
  ],
  cruces: [
    { origen: 'ENERGÍA', destino: 'MINERÍA', impacto: 'CRITICO' },
    { origen: 'CAMBIO', destino: 'INFLACIÓN', impacto: 'ALTO' },
    { origen: 'BLOQUEOS', destino: 'ABASTECIMIENTO', impacto: 'CRITICO' },
  ]
};

export default function AlertasView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEje, setSelectedEje] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Cargar datos
  const fetchData = async () => {
    setLoading(true);
    try {
      // En producción: fetch('/api/alertas/estado')
      // Simulamos latencia de red baja
      await new Promise(r => setTimeout(r, 400));
      setData(MOCK_DATA);
    } catch (error) {
      console.error("Error fetching alerts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Polling ligero cada 60s (ajustable según necesidad)
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleSimulation = () => {
    setSimulating(!simulating);
    // Aquí podrías disparar un endpoint de test si existiera
    fetchData();
  };

  if (loading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-r-2 border-cyan-500 rounded-full animate-spin reverse"></div>
        </div>
        <p className="text-xs font-mono text-emerald-500/70 animate-pulse">ESTABLECIENDO ENLACE DE DATOS...</p>
      </div>
    );
  }

  // Colores dinámicos según estado
  const getColor = (state: string) => {
    switch (state) {
      case 'ROJO': return 'text-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] bg-red-500/10';
      case 'AMARILLO': return 'text-amber-400 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)] bg-amber-400/10';
      default: return 'text-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] bg-emerald-500/10';
    }
  };

  const getBgGlow = (state: string) => {
    if (state === 'ROJO') return 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-slate-950 to-slate-950';
    if (state === 'AMARILLO') return 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950';
    return 'bg-slate-950';
  };

  return (
    <div className={`min-h-screen w-full p-4 md:p-6 transition-colors duration-1000 ${getBgGlow(data.global)} font-mono text-slate-200 overflow-hidden`}>

      {/* HEADER TÁCTICO */}
      <header className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Crosshair className={`w-6 h-6 ${data.global === 'ROJO' ? 'animate-pulse text-red-500' : 'text-emerald-500'}`} />
          <div>
            <h1 className="text-lg font-bold tracking-widest uppercase text-white">Monitor de Riesgos ONION200</h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              EN LÍNEA • ACTUALIZADO: {new Date(data.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleSimulation} className="p-2 hover:bg-white/10 rounded border border-white/10 text-xs transition-colors">
            {simulating ? 'MODO REAL' : 'SIMULAR CRISIS'}
          </button>
          <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded border border-white/10 text-xs transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUMNA IZQ: SEMÁFORO GLOBAL (4 columnas) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* TARJETA DE ESTADO GLOBAL */}
          <div className={`relative overflow-hidden rounded-lg border backdrop-blur-md p-6 flex flex-col items-center justify-center aspect-square ${getColor(data.global)}`}>
            <div className="absolute top-2 right-2 text-[10px] opacity-70">ESTADO DEL SISTEMA</div>

            {/* Círculo Central Pulsante */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <div className={`absolute inset-0 rounded-full border-2 opacity-30 animate-ping ${data.global === 'ROJO' ? 'border-red-500' : data.global === 'AMARILLO' ? 'border-amber-400' : 'border-emerald-500'}`}></div>
              <div className={`absolute inset-4 rounded-full border border-dashed animate-[spin_10s_linear_infinite] ${data.global === 'ROJO' ? 'border-red-400/50' : 'border-white/30'}`}></div>
              <div className="text-center z-10">
                <span className="block text-4xl font-black tracking-tighter">{data.global === 'ROJO' ? 'ALERTA' : data.global === 'AMARILLO' ? 'PRECAUCIÓN' : 'ESTABLE'}</span>
                <span className="text-xs opacity-80 mt-1 block">NIVEL {data.global}</span>
              </div>
            </div>

            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs uppercase">
                <span>Alertas Activas</span>
                <span className="font-bold">{data.totalAlertas}</span>
              </div>
              <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                <div className={`h-full ${data.global === 'ROJO' ? 'bg-red-500' : 'bg-emerald-500'} w-full animate-pulse`}></div>
              </div>
            </div>
          </div>

          {/* CRUCES SISTÉMICOS (Red de riesgo) */}
          <div className="flex-1 rounded-lg border border-white/10 bg-slate-900/50 backdrop-blur-sm p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Cruces Sistémicos Detectados
            </h3>
            <div className="space-y-3">
              {data.cruces.length === 0 ? (
                <p className="text-xs text-slate-600 italic">Sin interdependencias críticas activas.</p>
              ) : (
                data.cruces.map((cruce, idx) => (
                  <div key={idx} className="group relative pl-4 border-l border-white/20 py-1 hover:border-red-500 transition-colors cursor-default">
                    <div className="text-[10px] text-slate-500 absolute -left-1 top-0 bg-slate-900 px-1">LINK {idx + 1}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{cruce.origen} <span className="text-red-500 font-bold">→</span> {cruce.destino}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cruce.impacto === 'CRITICO' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {cruce.impacto}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DER: EJES TEMÁTICOS (8 columnas) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
          {data.ejes.map((eje) => (
            <button
              key={eje.id}
              onClick={() => setSelectedEje(selectedEje === eje.id ? null : eje.id)}
              className={`relative overflow-hidden rounded-lg border p-4 text-left transition-all duration-300 group
                ${selectedEje === eje.id ? 'bg-white/10 border-white/40 scale-[1.02]' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60 hover:border-white/20'}
              `}
            >
              {/* Indicador de Estado (Barra lateral) */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${eje.estado === 'ROJO' ? 'bg-red-500 shadow-[0_0_10px_red]' : eje.estado === 'AMARILLO' ? 'bg-amber-400 shadow-[0_0_10px_amber]' : 'bg-emerald-500 shadow-[0_0_10px_green]'}`}></div>

              <div className="flex justify-between items-start mb-2 pl-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 tracking-wider">{eje.id}</h3>
                  <h2 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{eje.nombre}</h2>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold border ${getColor(eje.estado)}`}>
                  {eje.estado}
                </div>
              </div>

              {/* Barra de Progreso Técnica */}
              <div className="pl-2 mt-3">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>INTENSIDAD DE RIESGO</span>
                  <span>{eje.valor}%</span>
                </div>
                <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-out ${eje.estado === 'ROJO' ? 'bg-red-500' : eje.estado === 'AMARILLO' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${eje.valor}%` }}
                  ></div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                  <AlertTriangle className={`w-3 h-3 ${eje.alertasCount > 0 ? 'text-red-400' : 'hidden'}`} />
                  <span>{eje.alertasCount} alertas activas</span>
                  <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${selectedEje === eje.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Panel Expansible (Detalles) */}
              {selectedEje === eje.id && (
                <div className="mt-4 pt-4 border-t border-white/10 pl-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/40 p-2 rounded text-[10px]">
                      <span className="block text-slate-500 mb-1">ÚLTIMO EVENTO</span>
                      <span className="text-slate-300 truncate block">Umbral superado en 15%</span>
                    </div>
                    <div className="bg-black/40 p-2 rounded text-[10px]">
                      <span className="block text-slate-500 mb-1">FUENTE</span>
                      <span className="text-slate-300 truncate block">Sensores ONION200</span>
                    </div>
                  </div>
                  <button className="mt-2 w-full py-1.5 text-[10px] bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/30 rounded transition-colors flex items-center justify-center gap-2">
                    <Terminal className="w-3 h-3" /> VER LOG COMPLETO
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* FOOTER TÉCNICO */}
      <footer className="mt-8 border-t border-white/10 pt-4 flex justify-between items-center text-[10px] text-slate-600 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> LATENCIA: 24ms</span>
          <span>UPTIME: 99.98%</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" />
          <span>SYSTEM SECURE // ONION200 CORE</span>
        </div>
      </footer>
    </div>
  );
}
