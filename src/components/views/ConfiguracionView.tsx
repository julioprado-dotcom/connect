'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatItem } from '@/components/shared/KPICard';
import { useDashboardStore } from '@/stores/useDashboardStore';
import {
  Settings, RefreshCw, Trash2, Loader2, Database, AlertTriangle,
  Shield, Activity, CheckCircle2, XCircle, Info, Server,
} from 'lucide-react';

interface SystemStatus {
  version: string;
  timestamp: string;
  referencia: { persona: number; medio: number; ejeTematico: number; indicador: number };
  monitoreo: { mencion: number; mencionTema: number; comentario: number; reporte: number; capturaLog: number };
  indicadoresDatos: { indicadorValor: number; indicadorEvaluacion: number };
  clientes: { cliente: number; contrato: number; suscriptorGratuito: number; entrega: number };
  sistema: { job: number; fuenteEstado: number };
}

interface PurgePreview {
  eliminar: Record<string, number>;
  preservar: Record<string, number>;
}

export function ConfiguracionView() {
  const { data } = useDashboardStore();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    exito: boolean; exitosos: Array<{slug: string; valorTexto: string; confiable: boolean}>;
    fallidos: Array<{slug: string; error: string}>;
    total: number; seeded: number; timestamp: string;
  } | null>(null);

  // Purge state
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgePreview, setPurgePreview] = useState<PurgePreview | null>(null);
  const [purgeResult, setPurgeResult] = useState<Record<string, number> | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  // Fetch system status
  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/admin/status');
      if (!res.ok) return;
      const json = await res.json();
      // Solo guardar si tiene la estructura esperada
      if (json && typeof json === 'object' && 'referencia' in json) {
        setSystemStatus(json as SystemStatus);
      }
    } catch { /* silent */ } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  // Sync handler
  const handleSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/indicadores/sync', { method: 'POST' });
      const json = await res.json();
      setSyncResult(json);
      fetchStatus();
    } catch {
      setSyncResult({ exito: false, exitosos: [], fallidos: [{ slug: '-', error: 'Error de conexion' }], total: 0, seeded: 0, timestamp: new Date().toISOString() });
    } finally {
      setSyncLoading(false);
    }
  };

  // Purge preview
  const handlePurgePreview = async () => {
    try {
      const res = await fetch('/api/admin/purge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const json = await res.json();
      setPurgePreview(json);
      setConfirmPurge(false);
      setPurgeResult(null);
    } catch { /* silent */ }
  };

  // Purge execute
  const handlePurgeExecute = async () => {
    setPurgeLoading(true);
    try {
      const res = await fetch('/api/admin/purge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
      const json = await res.json();
      setPurgeResult(json.eliminados || json);
      setConfirmPurge(false);
      setPurgePreview(null);
      fetchStatus();
    } catch { /* silent */ } finally {
      setPurgeLoading(false);
    }
  };

  const totalEliminables = purgePreview ? Object.values(purgePreview.eliminar).reduce((a, b) => a + b, 0) : 0;
  const totalPreservables = purgePreview ? Object.values(purgePreview.preservar).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-4">
      {/* Modo Prueba Banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
          Modo Prueba Activo — v{systemStatus?.version || '0.9.0'}
        </p>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-medium ml-auto">
          TESTING
        </span>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              Estado del Sistema
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={statusLoading} className="text-xs gap-1">
              {statusLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {systemStatus ? (
            <>
              {/* Reference data */}
              <div className="p-3 rounded-lg border border-border">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Datos de Referencia</h4>
                <div className="grid grid-cols-4 gap-2">
                  <StatItem label="Personas" value={String(systemStatus.referencia.persona)} />
                  <StatItem label="Medios" value={String(systemStatus.referencia.medio)} />
                  <StatItem label="Ejes" value={String(systemStatus.referencia.ejeTematico)} />
                  <StatItem label="Indicadores" value={String(systemStatus.referencia.indicador)} />
                </div>
              </div>
              {/* Monitoring data */}
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <h4 className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">Datos de Monitoreo (Preservados)</h4>
                <div className="grid grid-cols-5 gap-2">
                  <StatItem label="Menciones" value={String(systemStatus.monitoreo.mencion)} />
                  <StatItem label="Temas" value={String(systemStatus.monitoreo.mencionTema)} />
                  <StatItem label="Comentarios" value={String(systemStatus.monitoreo.comentario)} />
                  <StatItem label="Reportes" value={String(systemStatus.monitoreo.reporte)} />
                  <StatItem label="Capturas" value={String(systemStatus.monitoreo.capturaLog)} />
                </div>
              </div>
              {/* Indicator data */}
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <h4 className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">Datos de Indicadores</h4>
                <div className="grid grid-cols-2 gap-2">
                  <StatItem label="Valores cuantitativos" value={String(systemStatus.indicadoresDatos.indicadorValor)} />
                  <StatItem label="Evaluaciones cualitativas" value={String(systemStatus.indicadoresDatos.indicadorEvaluacion)} />
                </div>
              </div>
              {/* Client data */}
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <h4 className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-2">Datos Comerciales (Eliminables)</h4>
                <div className="grid grid-cols-4 gap-2">
                  <StatItem label="Clientes" value={String(systemStatus.clientes.cliente)} />
                  <StatItem label="Contratos" value={String(systemStatus.clientes.contrato)} />
                  <StatItem label="Suscriptores" value={String(systemStatus.clientes.suscriptorGratuito)} />
                  <StatItem label="Entregas" value={String(systemStatus.clientes.entrega)} />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">
                Actualizado: {new Date(systemStatus.timestamp).toLocaleString('es-BO')}
              </p>
            </>
          ) : (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}
        </CardContent>
      </Card>

      {/* Sync Indicadores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            Sincronizar Indicadores
          </CardTitle>
          <CardDescription className="text-xs">
            Ejecuta el seed de indicadores (si faltan) y luego intenta capturar valores reales de Tier 1.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <Button onClick={handleSync} disabled={syncLoading} className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
            {syncLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Sincronizar ahora
          </Button>
          {syncResult && (
            <div className="space-y-2 p-3 rounded-lg border border-border">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-lg font-bold text-emerald-600">{syncResult.total}</p>
                  <p className="text-[10px] text-muted-foreground">Procesados</p>
                </div>
                <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-950/20">
                  <p className="text-lg font-bold text-blue-600">{syncResult.exitosos.length}</p>
                  <p className="text-[10px] text-muted-foreground">Exitosos</p>
                </div>
                <div className="text-center p-2 rounded bg-amber-50 dark:bg-amber-950/20">
                  <p className="text-lg font-bold text-amber-600">{syncResult.fallidos.length}</p>
                  <p className="text-[10px] text-muted-foreground">Fallidos</p>
                </div>
              </div>
              {syncResult.seeded > 0 && (
                <p className="text-xs text-emerald-600 font-medium">+{syncResult.seeded} indicadores nuevos registrados</p>
              )}
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {syncResult.exitosos.map(e => (
                  <div key={e.slug} className="flex items-center gap-2 text-[10px] p-1 rounded">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="font-medium flex-1 truncate">{e.slug}</span>
                    <span className="text-muted-foreground">{e.valorTexto}</span>
                  </div>
                ))}
                {syncResult.fallidos.map(f => (
                  <div key={f.slug} className="flex items-center gap-2 text-[10px] p-1 rounded">
                    <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    <span className="font-medium flex-1 truncate">{f.slug}</span>
                    <span className="text-red-600">{f.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purgar Datos de Prueba */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            Purgar Datos de Prueba
          </CardTitle>
          <CardDescription className="text-xs">
            Elimina clientes, contratos, suscriptores y entregas. Preserva todo el historial de monitoreo, menciones, capturas y datos de indicadores.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {!purgePreview && !purgeResult && (
            <Button variant="outline" onClick={handlePurgePreview} className="text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
              <Shield className="h-3 w-3" />
              Vista previa de purga
            </Button>
          )}

          {purgePreview && !confirmPurge && (
            <div className="space-y-2 p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-semibold text-foreground">Vista previa</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <p className="text-[10px] font-semibold text-red-600 mb-1">SE ELIMINARA ({totalEliminables} registros)</p>
                  {Object.entries(purgePreview.eliminar).map(([tabla, count]) => (
                    <div key={tabla} className="text-[10px] text-muted-foreground">
                      {tabla}: <span className="font-medium text-red-600">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[10px] font-semibold text-emerald-600 mb-1">SE PRESERVARA ({totalPreservables} registros)</p>
                  {Object.entries(purgePreview.preservar).map(([tabla, count]) => (
                    <div key={tabla} className="text-[10px] text-muted-foreground">
                      {tabla}: <span className="font-medium text-emerald-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={() => setConfirmPurge(true)} className="text-xs gap-1">
                  <Trash2 className="h-3 w-3" />
                  Confirmar purga
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPurgePreview(null); }} className="text-xs">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {confirmPurge && (
            <div className="p-3 rounded-lg border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30">
              <p className="text-xs font-bold text-red-600 mb-2">
                CONFIRMACION FINAL: Se eliminaran {totalEliminables} registros. Esta accion no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handlePurgeExecute} disabled={purgeLoading} className="text-xs gap-1">
                  {purgeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Ejecutar purga ahora
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmPurge(false)} className="text-xs">
                  Me arrepenti
                </Button>
              </div>
            </div>
          )}

          {purgeResult && (
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700">Purga ejecutada correctamente</p>
              </div>
              {Object.entries(purgeResult).map(([tabla, count]) => (
                <div key={tabla} className="text-[10px] text-muted-foreground">
                  {tabla}: <span className="font-medium text-foreground">{count} eliminados</span>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPurgeResult(null)} className="text-xs mt-2">Cerrar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Philosophy (kept from original) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Marco Filosofico
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este sistema opera bajo los principios de pluralismo politico y libertad de expresion
              consagrados en la Constitucion Politica del Estado Plurinacional de Bolivia (2009).
              No emitimos juicios de valor sobre las opiniones de legisladores ni partidos.
              Nuestro objetivo es proporcionar datos objetivos sobre la presencia mediatica.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
