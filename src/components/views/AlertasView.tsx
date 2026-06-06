'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ShieldCheck, Activity, Wifi, RefreshCw, ChevronRight, Terminal, Crosshair } from 'lucide-react';

// ─── Tipos del Componente (Frontend) ──────────────────────────────────

type NivelAlerta = 'INFO' | 'VIGILANCIA' | 'ALERTA';

type EjeData = {
  id: string;
  nombre: string;
  estado: NivelAlerta;
  valor: number;
  alertasCount: number;
  alertasDetalle: string[];
};

type CruceData = {
  origen: string;
  destino: string;
  impacto: 'CRITICO' | 'ALTO' | 'MEDIO';
  mensaje: string;
};

type DashboardData = {
  global: NivelAlerta;
  timestamp: string;
  ejes: EjeData[];
  cruces: CruceData[];
  totalAlertas: number;
  resumen: string;
  recomendacion: string;
  meta: {
    indicadores_disponibles: number;
    indicadores_total: number;
    umbrales_configurados: number;
  };
};

// ─── Nombres legibles para ejes ───────────────────────────────────────

const EJE_NOMBRES: Record<string, string> = {
  MACRO: 'MACROECONOMÍA',
  SOCIAL: 'CONFLICTIVIDAD',
  ENERGIA: 'ENERGÍA',
  POLITICA: 'GOBERNANZA',
  LOGISTICA: 'LOGÍSTICA',
  AMBIENTE: 'CLIMA/AGUA',
};

// ─── Adaptador: API response → DashboardData ─────────────────────────
// Transforma el AlertasConsolidado del backend al formato del componente.

function adaptarDatos(apiRes: {
  data: {
    estado_global: string;
    hora_actualizacion: string;
    fecha: string;
    ejes: Record<string, {
      eje: string;
      estado: string;
      alertas: Array<{ mensaje: string; nivel: string; valor: number }>;
      indicadoresEnAlerta: number;
      indicadoresEnVigilancia: number;
    }>;
    cruces_activos: Array<{
      ejeA: string;
      ejeB: string;
      nombre: string;
      nivel: string;
      mensaje: string;
    }>;
    alertas: Array<{ nivel: string }>;
    resumen: string;
    recomendacion_accion: string;
  };
  meta: {
    indicadores_disponibles: number;
    indicadores_total: number;
    umbrales_configurados: number;
  };
}): DashboardData {
  const { data, meta } = apiRes;

  // Mapear ejes: Record → Array
  const ejes: EjeData[] = Object.values(data.ejes).map(eje => {
    const alertas = eje.indicadoresEnAlerta || 0;
    const vigilancias = eje.indicadoresEnVigilancia || 0;
    const total = rojos + amarillos;
    // Calcular intensidad de riesgo (0-100) basada en alertas activas
    const valor = Math.min(100, (rojos * 40) + (amarillos * 20) + (total > 0 ? 10 : 0));

    return {
      id: eje.eje,
      nombre: EJE_NOMBRES[eje.eje] || eje.eje,
      estado: eje.estado as NivelAlerta,
      valor,
      alertasCount: eje.alertas.length,
      alertasDetalle: eje.alertas.map(a => a.mensaje),
    };
  });

  // Mapear cruces sistémicos
  const cruces: CruceData[] = data.cruces_activos.map(c => ({
    origen: c.ejeA,
    destino: c.ejeB,
    impacto: (c.nivel === 'alto' ? 'CRITICO' : c.nivel === 'medio' ? 'ALTO' : 'MEDIO') as CruceData['impacto'],
    mensaje: c.mensaje,
  }));

  return {
    global: data.estado_global as NivelAlerta,
    timestamp: new Date(`${data.fecha}T${data.hora_actualizacion}`).toISOString(),
    ejes,
    cruces,
    totalAlertas: data.alertas.length,
    resumen: data.resumen,
    recomendacion: data.recomendacion_accion,
    meta,
  };
}

// ─── Componente Principal ────────────────────────────────────────────

export default function AlertasView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEje, setSelectedEje] = useState<string | null>(null);
  const [lastFetchMs, setLastFetchMs] = useState<number>(0);

  // Cargar datos desde API real
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/alertas/estado');
      if (!response.ok) {
        throw new Error(`API respondió con ${response.status}`);
      }
      const json = await response.json();

      if (json.estado === 'sin_datos') {
        // No hay indicadores en la DB — mostrar estado vacío
        setData({
          global: 'INFO',
          timestamp: new Date().toISOString(),
          ejes: [
            { id: 'MACRO', nombre: 'MACROECONOMÍA', estado: 'INFO', valor: 0, alertasCount: 0, alertasDetalle: [] },
            { id: 'SOCIAL', nombre: 'CONFLICTIVIDAD', estado: 'INFO', valor: 0, alertasCount: 0, alertasDetalle: [] },
            { id: 'ENERGIA', nombre: 'ENERGÍA', estado: 'INFO', valor: 0, alertasCount: 0, alertasDetalle: [] },
            { id: 'POLITICA', nombre: 'GOBERNANZA', estado: 'INFO', valor: 0, alertasCount: 0, alertasDetalle: [] },
            { id: 'LOGISTICA', nombre: 'LOGÍSTICA', estado: 'INFO', valor: 0, alertasCount: 0, alertasDetalle: [] },
            { id: 'AMBIENTE', nombre: 'CLIMA/AGUA', estado: 'INFO', valor: 0, alertasCount: 0, alertasDetalle: [] },
          ],
          cruces: [],
          totalAlertas: 0,
          resumen: json.mensaje || 'No hay indicadores configurados. El sistema está en modo monitoreo pasivo.',
          recomendacion: '',
          meta: { indicadores_disponibles: 0, indicadores_total: 0, umbrales_configurados: 0 },
        });
        return;
      }

      const dashboardData = adaptarDatos(json);
      setData(dashboardData);
      setLastFetchMs(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      console.error('Error fetching alerts:', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Polling cada 60s
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Loader ──────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-r-2 border-cyan-500 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
        </div>
        <p className="text-xs font-mono text-emerald-500/70 animate-pulse">ESTABLECIENDO ENLACE DE DATOS...</p>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────

  if (error && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col space-y-4">
        <div className="text-red-500 text-4xl mb-2">⚠</div>
        <p className="text-xs font-mono text-red-400">ERROR DE CONEXIÓN</p>
        <p className="text-[10px] font-mono text-slate-500 max-w-md text-center">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 border border-red-500/30 text-red-400 text-xs rounded hover:bg-red-500/10 transition-colors">
          REINTENTAR
        </button>
      </div>
    );
  }

  if (!data) return null;

  // ─── Helpers de color ────────────────────────────────────────────────

  const getColor = (state: string) => {
    switch (state) {
      case 'ALERTA': return 'text-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] bg-red-500/10';
      case 'VIGILANCIA': return 'text-amber-400 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)] bg-amber-400/10';
      default: return 'text-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] bg-emerald-500/10';
    }
  };

  const getBgGlow = (state: string) => {
    if (state === 'ALERTA') return 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-slate-950 to-slate-950';
    if (state === 'VIGILANCIA') return 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950';
    return 'bg-slate-950';
  };

  const getBarGlow = (state: string) => {
    if (state === 'ALERTA') return 'shadow-[0_0_10px_red]';
    if (state === 'VIGILANCIA') return 'shadow-[0_0_10px_amber]';
    return 'shadow-[0_0_10px_green]';
  };

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen w-full p-4 md:p-6 transition-colors duration-700 ${getBgGlow(data.global)} font-mono text-slate-200 overflow-hidden`}>

      {/* HEADER TÁCTICO */}
      <header className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Crosshair className={`w-6 h-6 ${data.global === 'ALERTA' ? 'animate-pulse text-red-500' : data.global === 'VIGILANCIA' ? 'text-amber-400' : 'text-emerald-500'}`} />
          <div>
            <h1 className="text-lg font-bold tracking-widest uppercase text-white">Monitor de Riesgos ONION200</h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              EN LÍNEA • ACTUALIZADO: {new Date(data.timestamp).toLocaleTimeString('es-BO')}
              {lastFetchMs > 0 && (
                <span className="ml-2 text-slate-600">• {Math.round((Date.now() - lastFetchMs) / 1000)}s</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded border border-white/10 text-xs transition-colors" title="Refrescar datos">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Barra de Recomendación (si hay alertas activas) */}
      {data.recomendacion && (
        <div className={`mb-4 px-4 py-2 rounded-lg border text-xs ${
          data.global === 'ALERTA'
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : data.global === 'VIGILANCIA'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          {data.recomendacion}
        </div>
      )}

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUMNA IZQ: ALERTAS GLOBAL (4 columnas) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* TARJETA DE ESTADO GLOBAL */}
          <div className={`relative overflow-hidden rounded-lg border backdrop-blur-md p-6 flex flex-col items-center justify-center aspect-square ${getColor(data.global)}`}>
            <div className="absolute top-2 right-2 text-[10px] opacity-70">ESTADO DEL SISTEMA</div>

            {/* Círculo Central Pulsante */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <div className={`absolute inset-0 rounded-full border-2 opacity-30 animate-ping ${data.global === 'ALERTA' ? 'border-red-500' : data.global === 'VIGILANCIA' ? 'border-amber-400' : 'border-emerald-500'}`}></div>
              <div className={`absolute inset-4 rounded-full border border-dashed animate-[spin_10s_linear_infinite] ${data.global === 'ALERTA' ? 'border-red-400/50' : 'border-white/30'}`}></div>
              <div className="text-center z-10">
                <span className="block text-3xl md:text-4xl font-black tracking-tighter">
                  {data.global === 'ALERTA' ? 'ALERTA' : data.global === 'VIGILANCIA' ? 'PRECAUCIÓN' : 'ESTABLE'}
                </span>
                <span className="text-xs opacity-80 mt-1 block">NIVEL {data.global}</span>
              </div>
            </div>

            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs uppercase">
                <span>Alertas Activas</span>
                <span className="font-bold">{data.totalAlertas}</span>
              </div>
              <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${data.global === 'ALERTA' ? 'bg-red-500' : data.global === 'VIGILANCIA' ? 'bg-amber-400' : 'bg-emerald-500'} animate-pulse`}
                  style={{ width: `${Math.min(100, data.totalAlertas * 10)}%` }}
                ></div>
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
                      <span className="text-slate-300">{EJE_NOMBRES[cruce.origen] || cruce.origen} <span className="text-red-500 font-bold mx-1">→</span> {EJE_NOMBRES[cruce.destino] || cruce.destino}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cruce.impacto === 'CRITICO' ? 'bg-red-500/20 text-red-400' : cruce.impacto === 'ALTO' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {cruce.impacto}
                      </span>
                    </div>
                    {cruce.mensaje && (
                      <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">{cruce.mensaje}</p>
                    )}
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
              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-500 ${getBarGlow(eje.estado)} ${
                eje.estado === 'ALERTA' ? 'bg-red-500' : eje.estado === 'VIGILANCIA' ? 'bg-amber-400' : 'bg-emerald-500'
              }`}></div>

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
                    className={`h-full transition-all duration-700 ease-out ${
                      eje.estado === 'ALERTA' ? 'bg-red-500' : eje.estado === 'VIGILANCIA' ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${eje.valor}%` }}
                  ></div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                  <AlertTriangle className={`w-3 h-3 ${eje.alertasCount > 0 ? 'text-red-400' : 'hidden'}`} />
                  <span>{eje.alertasCount} alerta{eje.alertasCount !== 1 ? 's' : ''} activa{eje.alertasCount !== 1 ? 's' : ''}</span>
                  <ChevronRight className={`w-3 h-3 ml-auto transition-transform duration-200 ${selectedEje === eje.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Panel Expansible (Detalles) */}
              {selectedEje === eje.id && (
                <div className="mt-4 pt-4 border-t border-white/10 pl-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  {eje.alertasDetalle.length > 0 ? (
                    <div className="space-y-2">
                      {eje.alertasDetalle.map((msg, idx) => (
                        <div key={idx} className="bg-black/40 p-2 rounded text-[10px]">
                          <span className="block text-slate-500 mb-0.5">ALERTA #{idx + 1}</span>
                          <span className="text-slate-300 block leading-relaxed">{msg}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-black/40 p-2 rounded text-[10px]">
                      <span className="block text-slate-500">Sin alertas activas en este eje</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* FOOTER TÉCNICO */}
      <footer className="mt-8 border-t border-white/10 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-slate-600 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> EN VIVO</span>
          <span>INDICADORES: {data.meta.indicadores_disponibles}/{data.meta.indicadores_total}</span>
          <span>UMBRALES: {data.meta.umbrales_configurados}</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" />
          <span>SYSTEM SECURE // ONION200 CORE</span>
        </div>
      </footer>
    </div>
  );
}
