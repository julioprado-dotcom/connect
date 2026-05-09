'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Newspaper, Radio, Bell, UserCircle, Package, TrendingUp,
  ArrowUpRight, CheckCircle2, AlertTriangle, BarChart3,
} from 'lucide-react';
import { MiniGauge } from '@/components/dashboard/gauges/MiniGauge';
import { ALL_PRODUCTS } from '@/constants/nav';
import type { DashboardData, MediosHealthData } from '@/types/dashboard';
import { CategoryCard } from '../shared/CategoryCard';
import { TrendIndicator } from '../shared/TrendIndicator';

// ─── Props ────────────────────────────────────────────────────

interface CategoryCardsGridProps {
  data: DashboardData;
  mediosHealth: MediosHealthData | null;
  setActiveView: (viewId: string) => void;
}

// ─── Component ────────────────────────────────────────────────

export function CategoryCardsGrid({ data, mediosHealth, setActiveView }: CategoryCardsGridProps) {
  const totalCapturasHoy = useMemo(() => {
    if (!data.fuentesPorNivel) return 0;
    return data.fuentesPorNivel.reduce((sum, f) => sum + f.capturasHoy, 0);
  }, [data.fuentesPorNivel]);

  const saludPercent = useMemo(
    () => mediosHealth?.resumen.porcentajeSalud || 0,
    [mediosHealth?.resumen.porcentajeSalud]
  );

  const productsOperativo = useMemo(
    () => ALL_PRODUCTS.filter((p) => p.estado === 'operativo'),
    []
  );

  const productsByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    ALL_PRODUCTS.forEach((p) => {
      const cat = (p as unknown as Record<string, unknown>).categoria as string || 'otro';
      cats[cat] = (cats[cat] || 0) + 1;
    });
    return cats;
  }, []);

  const topPartido = useMemo(() => {
    if (!data.mencionesPorPartido?.length) return null;
    return data.mencionesPorPartido[0];
  }, [data.mencionesPorPartido]);

  const mencionesTrend = useMemo(() => {
    const hoy = data.mencionesHoy || 0;
    const semana = data.mencionesSemana || 0;
    const promedio = semana / 7;
    if (promedio === 0) return hoy > 0 ? 100 : 0;
    return Math.round(((hoy - promedio) / promedio) * 100);
  }, [data.mencionesHoy, data.mencionesSemana]);

  const mediosConProblema = useMemo(
    () => mediosHealth?.medios.filter((m) => m.salud !== 'sano') || [],
    [mediosHealth]
  );

  const monitoreoBorder = useMemo(() => {
    if (!mediosHealth) return '';
    if (mediosHealth.resumen.muertos > 0) return 'border-l-4 border-l-red-500';
    if (mediosHealth.resumen.degradados > 0) return 'border-l-4 border-l-amber-500';
    return 'border-l-4 border-l-emerald-500';
  }, [mediosHealth]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      {/* 1. Analisis */}
      <CategoryCard
        index={0}
        icon={<Newspaper className="h-5 w-5" />}
        title="Analisis"
        viewId="menciones"
        onClick={() => setActiveView('menciones')}
        kpis={[
          { value: data.totalPersonas, label: 'Legisladores' },
          { value: data.mencionesHoy, label: 'Hoy', color: 'text-sky-600 dark:text-sky-400' },
          { value: data.mencionesSemana, label: 'Semana' },
        ]}
        featured={
          data.topActores?.[0] ? (
            <div className="flex items-start gap-2">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{data.topActores[0].nombre}</p>
                <p className="text-[10px] text-muted-foreground">
                  {data.topActores[0].partidoSigla} · {data.topActores[0].mencionesCount} menciones
                </p>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">Sin datos de actores</span>
          )
        }
        variation={
          <TrendIndicator value={mencionesTrend} label="vs. promedio diario" />
        }
      />

      {/* 2. Monitoreo */}
      <CategoryCard
        index={1}
        icon={<Radio className="h-5 w-5" />}
        title="Monitoreo"
        viewId="captura"
        onClick={() => setActiveView('captura')}
        kpis={[
          { value: data.totalMedios, label: 'Monitoreando' },
          { value: `${Math.round(saludPercent)}%`, label: 'Salud', color: saludPercent >= 80 ? 'text-emerald-600 dark:text-emerald-400' : saludPercent >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400' },
          { value: totalCapturasHoy, label: 'Capturas' },
        ]}
        featured={
          mediosConProblema.length > 0 ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-amber-700 dark:text-amber-400 truncate">
                  {mediosConProblema[0]?.nombre}
                  {mediosConProblema.length > 1 && ` +${mediosConProblema.length - 1}`}
                </p>
                <p className="text-[10px] text-muted-foreground">con problemas de captura</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">Todos sanos</span>
            </div>
          )
        }
        variation={
          <div className="flex items-center gap-2">
            <MiniGauge value={saludPercent} label="Salud" size={36} />
            <span className="text-[10px] text-muted-foreground">{mediosHealth?.resumen.sanos || 0} sanos · {mediosHealth?.resumen.muertos || 0} caidos</span>
          </div>
        }
        borderColor={monitoreoBorder}
      />

      {/* 3. Alertas */}
      <CategoryCard
        index={2}
        icon={<Bell className="h-5 w-5" />}
        title="Alertas"
        viewId="alertas"
        onClick={() => setActiveView('alertas')}
        kpis={[
          { value: data.alertas.negativasHoy, label: 'Rojas', color: 'text-red-600 dark:text-red-400' },
          { value: data.alertas.positivasHoy, label: 'Verdes', color: 'text-emerald-600 dark:text-emerald-400' },
          { value: data.alertas.neutrasHoy, label: 'Neutras' },
        ]}
        featured={
          data.alertas.ultimaAlerta ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-foreground truncate">{data.alertas.ultimaAlerta.resumen}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(data.alertas.ultimaAlerta.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">Sin alertas registradas</span>
          )
        }
        variation={
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {data.alertas.negativasHoy + data.alertas.positivasHoy + data.alertas.neutrasHoy > 0 ? (
              <>
                <span className="font-medium text-foreground">{data.alertas.negativasHoy + data.alertas.positivasHoy + data.alertas.neutrasHoy}</span>
                <span>alertas procesadas hoy</span>
              </>
            ) : (
              <span>Sin actividad de alertas</span>
            )}
          </div>
        }
      />

      {/* 4. Comercial */}
      <CategoryCard
        index={3}
        icon={<UserCircle className="h-5 w-5" />}
        title="Comercial"
        viewId="clientes"
        onClick={() => setActiveView('clientes')}
        kpis={[
          { value: data.clientesActivos, label: 'Clientes' },
          { value: data.contratosVigentes, label: 'Contratos' },
          { value: data.entregasHoy, label: 'Entregas', color: 'text-emerald-600 dark:text-emerald-400' },
        ]}
        featured={
          data.entregasHoy > 0 ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-foreground">{data.entregasHoy} entregas procesadas hoy</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">Sin entregas procesadas hoy</span>
          )
        }
        variation={
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>{data.totalReportes} reportes generados</span>
          </div>
        }
      />

      {/* 5. Productos */}
      <CategoryCard
        index={4}
        icon={<Package className="h-5 w-5" />}
        title="Productos"
        viewId="productos"
        onClick={() => setActiveView('productos')}
        kpis={[
          { value: productsOperativo.length, label: 'Operativos', color: 'text-emerald-600 dark:text-emerald-400' },
          { value: ALL_PRODUCTS.length, label: 'Total' },
          { value: data.totalReportes, label: 'Reportes' },
        ]}
        featured={
          <div className="space-y-1">
            {ALL_PRODUCTS.slice(0, 3).map((prod) => {
              const ProdIcon = prod.icon;
              return (
                <div key={prod.tipo} className="flex items-center gap-1.5">
                  <ProdIcon className="h-3 w-3 shrink-0" style={{ color: prod.color }} />
                  <span className="text-foreground text-[11px]">{prod.nombre}</span>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">
                    {prod.estado === 'operativo' ? 'Op.' : 'Def.'}
                  </Badge>
                </div>
              );
            })}
          </div>
        }
        variation={
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(productsByCategory).map(([cat, count]) => (
              <span key={cat} className="text-[10px] text-muted-foreground">
                {cat}: <span className="font-medium text-foreground">{count}</span>
              </span>
            ))}
          </div>
        }
      />

      {/* 6. Indicadores */}
      <CategoryCard
        index={5}
        icon={<TrendingUp className="h-5 w-5" />}
        title="Indicadores"
        viewId="indicadores"
        onClick={() => setActiveView('indicadores')}
        kpis={[
          { value: data.totalEjes, label: 'Ejes' },
          { value: data.totalComentarios, label: 'Comentarios' },
          { value: data.enlacesRotos, label: 'Rotos', color: data.enlacesRotos > 0 ? 'text-red-600 dark:text-red-400' : undefined },
        ]}
        featured={
          topPartido ? (
            <div className="flex items-start gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{topPartido.partido}</p>
                <p className="text-[10px] text-muted-foreground">{topPartido.count} menciones · partido lider</p>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">Sin datos de partidos</span>
          )
        }
        variation={
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Diputados: <span className="font-medium text-foreground">{data.distribucionCamara.diputados}</span></span>
            <span className="text-border">|</span>
            <span>Senadores: <span className="font-medium text-foreground">{data.distribucionCamara.senadores}</span></span>
          </div>
        }
      />
    </div>
  );
}
