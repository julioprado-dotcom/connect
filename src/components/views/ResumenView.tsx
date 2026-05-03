'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import {
  Loader2, Database, UserCircle, Mail, Newspaper, Radio,
  AlertTriangle, ChevronRight, Bell, Zap, Activity,
  CheckCircle2, XCircle, Package, ArrowRight,
} from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { KPICard, EmptyState } from '@/components/shared/KPICard';
import { SENTIMIENTO_STYLES, TIPO_MENCION_LABELS, NIVEL_LABELS } from '@/constants/ui';
import { PRODUCTOS } from '@/constants/products';
import { ALL_PRODUCTS } from '@/constants/nav';

export function ResumenView() {
  // Fine-grained store selectors — avoid re-renders on unrelated store changes
  const data = useDashboardStore((s) => s.data);
  const mediosHealth = useDashboardStore((s) => s.mediosHealth);
  const setError = useDashboardStore((s) => s.setError);
  const setActiveView = useDashboardStore((s) => s.setActiveView);
  const setData = useDashboardStore((s) => s.setData);
  const [seedLoading, setSeedLoading] = useState(false);

  // Memoize filtered unhealthy medios (used 3x in health banner)
  const mediosConProblema = useMemo(
    () => mediosHealth?.medios.filter((m) => m.salud !== 'sano') || [],
    [mediosHealth],
  );
  const mediosConProblemaNames = useMemo(
    () => mediosConProblema.slice(0, 3).map((m) => m.nombre).join(', '),
    [mediosConProblema],
  );

  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Error al cargar datos');
      const statsRes = await fetch('/api/stats');
      if (!statsRes.ok) throw new Error('Error al cargar estadísticas');
      const json = await statsRes.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seed button if no data */}
      {data && data.totalPersonas === 0 && (
        <div className="flex justify-center">
          <Button onClick={handleSeed} disabled={seedLoading} className="gap-2">
            {seedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Cargar datos de ejemplo
          </Button>
        </div>
      )}

      {/* KPI Cards — Centro de Comando */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          icon={<UserCircle className="h-5 w-5" />}
          value={data?.clientesActivos || 0}
          label="Clientes activos"
          subtext={`${data?.contratosVigentes || 0} contratos vigentes`}
          colorClass="text-primary"
        />
        <KPICard
          icon={<Mail className="h-5 w-5" />}
          value={data?.entregasHoy || 0}
          label="Entregas hoy"
          subtext="Boletines enviados"
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          icon={<Newspaper className="h-5 w-5" />}
          value={data?.mencionesHoy || 0}
          label="Menciones hoy"
          subtext={`${data?.mencionesSemana || 0} esta semana`}
          colorClass="text-sky-600 dark:text-sky-400"
        />
        <KPICard
          icon={<Radio className="h-5 w-5" />}
          value={data?.totalMedios || 0}
          label="Medios activos"
          subtext={`${data?.totalEjes || 0} ejes · ${data?.totalPersonas || 0} legisladores`}
          colorClass="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Health Alert Banner — auto-cargado al inicio */}
      {mediosHealth && (mediosHealth.resumen.muertos > 0 || mediosHealth.resumen.conErrores > 0) && (
        <div className={`p-3 rounded-lg border flex items-start gap-3 ${
          mediosHealth.resumen.muertos > 0
            ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
            : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
        }`}>
          <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${mediosHealth.resumen.muertos > 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {mediosHealth.resumen.muertos > 0
                ? `${mediosHealth.resumen.muertos} medio(s) sin respuesta (posiblemente cerrados o URL cambiada)`
                : `${mediosHealth.resumen.conErrores} medio(s) con errores frecuentes de captura`
              }
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {mediosConProblemaNames}
              {mediosConProblema.length > 3 ? ` y ${mediosConProblema.length - 3} más` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActiveView('captura')} className="text-xs text-muted-foreground shrink-0">
            Ver detalle <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}

      {/* Alertas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" />
                Alertas
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Crisis, oportunidades y monitoreo · tiempo real
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="text-xs gap-1 opacity-60"
                title="Captura automática pendiente de implementación"
              >
                <Zap className="h-3 w-3" />
                Generar alertas
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setActiveView('alertas')} className="text-xs text-muted-foreground">
                Ver historial <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-3 gap-3">
            {/* Negativas */}
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 text-center">
              <div className="text-2xl mb-1">🔴</div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{data?.alertas?.negativasHoy || 0}</p>
              <p className="text-[10px] font-medium text-red-600/80 dark:text-red-400/80">Negativas</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Crisis / Riesgo</p>
            </div>
            {/* Positivas */}
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
              <div className="text-2xl mb-1">🟢</div>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{data?.alertas?.positivasHoy || 0}</p>
              <p className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">Positivas</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Oportunidades</p>
            </div>
            {/* Neutras */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20 text-center">
              <div className="text-2xl mb-1">⚪</div>
              <p className="text-xl font-bold text-slate-600 dark:text-slate-300">{data?.alertas?.neutrasHoy || 0}</p>
              <p className="text-[10px] font-medium text-slate-600/80 dark:text-slate-400/80">Neutras</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Informativas</p>
            </div>
          </div>
          {data?.alertas?.ultimaAlerta ? (
            <div className="mt-3 p-2.5 rounded-lg bg-muted/50 border border-border">
              <p className="text-[10px] text-muted-foreground">
                Última alerta: {new Date(data.alertas.ultimaAlerta.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs text-foreground mt-0.5 line-clamp-1">{data.alertas.ultimaAlerta.resumen || 'Sin resumen'}</p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
              No hay alertas registradas. La captura automática de alertas está pendiente de implementación.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Últimas menciones */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-muted-foreground" />
              Últimas menciones capturadas
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setActiveView('menciones')} className="text-xs text-muted-foreground">
              Ver todas <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {data?.ultimasMenciones && data.ultimasMenciones.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Legislador</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Medio</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Título</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Sentimiento</TableHead>
                    <TableHead className="text-xs hidden xl:table-cell">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ultimasMenciones.slice(0, 8).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="py-2.5">
                        <div>
                          <p className="text-sm font-medium text-foreground max-w-[140px] truncate">{m.persona?.nombre || '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{m.persona?.partidoSigla}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{m.medio?.nombre || '—'}</span>
                      </TableCell>
                      <TableCell className="py-2.5 hidden md:table-cell">
                        <p className="text-xs text-foreground/80 max-w-[200px] truncate">{m.titulo || m.texto?.substring(0, 60) || '—'}</p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 hidden lg:table-cell">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado}`}>
                          {m.sentimiento.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                        {m.fechaCaptura ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState icon={<Newspaper className="h-10 w-10" />} text="Aún no hay menciones registradas" subtext="Usa la sección de Captura para buscar menciones automáticamente" />
          )}
        </CardContent>
      </Card>

      {/* Fuentes status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Estado de fuentes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setActiveView('captura')} className="text-xs text-muted-foreground">
              Salud de fuentes <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(data?.fuentesPorNivel || []).map((fuente) => {
              const tieneCaptura = fuente.ultimaCaptura !== null;
              const esReciente = tieneCaptura && (Date.now() - new Date(fuente.ultimaCaptura!).getTime()) < 86400000;
              return (
                <div key={fuente.nivel} className={`p-3 rounded-lg border transition-colors ${
                  esReciente && fuente.ultimaExitosa
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : tieneCaptura && !fuente.ultimaExitosa
                    ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-border bg-muted/50'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {esReciente && fuente.ultimaExitosa ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : tieneCaptura && !fuente.ultimaExitosa ? (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-stone-300 dark:border-stone-600 shrink-0" />
                    )}
                    <p className="text-xs font-medium text-foreground">{NIVEL_LABELS[fuente.nivel]}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {fuente.mediosCount} medios activos
                  </p>
                  {tieneCaptura && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Última: {new Date(fuente.ultimaCaptura!).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })} · {fuente.ultimoMencionesEncontradas} menc.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Productos Vigentes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Productos Vigentes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setActiveView('productos')} className="text-xs text-muted-foreground">
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <CardDescription className="text-xs">
            {ALL_PRODUCTS.filter(p => p.estado === 'operativo').length} operativos · {ALL_PRODUCTS.length} productos totales
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ALL_PRODUCTS.map((prod) => {
              const ProdIcon = prod.icon;
              const prodConfig = PRODUCTOS[prod.tipo];
              return (
                <div key={prod.tipo} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:border-primary/30 transition-colors">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: prod.color + '20' }}
                  >
                    <ProdIcon className="h-4 w-4" style={{ color: prod.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{prod.nombre}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        prod.estado === 'operativo'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        {prod.estado === 'operativo' ? '✅ Op.' : '⚠️ Def.'}
                      </span>
                      {prodConfig && (
                        <span className="text-[9px] text-muted-foreground">{prodConfig.horarioEnvio}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
