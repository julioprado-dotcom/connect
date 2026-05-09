'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, AlertOctagon, Clock, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import { StatusPill } from '@/components/dashboard/gauges/StatusOrb';

// ─── Types ────────────────────────────────────────────────────

interface FallidaConDiagnostico {
  id: string;
  tipoBoletin: string;
  canal: string;
  fechaEnvio: string | null;
  error: string | null;
  contrato: string;
  clienteNombre: string;
  diagnostico: {
    causa: string;
    accion: string;
    equipo: string;
  };
}

export interface EntregasHoyData {
  total: number;
  enviadas: number;
  pendientes: number;
  fallidas: number;
  enProcesoCount: number;
  porTipo: Record<string, { total: number; enviadas: number; pendientes: number; fallidas: number }>;
  fallidasConDiagnostico: FallidaConDiagnostico[];
  enProceso: {
    id: string;
    tipoBoletin: string;
    canal: string;
    fechaCreacion: string;
    contrato: string;
    clienteNombre: string;
    fechaProgramada: string | null;
  }[];
}

// ─── Props ────────────────────────────────────────────────────

interface EntregasHoyProps {
  entregasHoy: EntregasHoyData | null;
  setActiveView: (viewId: string) => void;
}

// ─── Component ────────────────────────────────────────────────

export function EntregasHoy({ entregasHoy }: EntregasHoyProps) {
  const [showEntregasDetail, setShowEntregasDetail] = useState(false);

  return (
    <Card className="border">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Entregas Hoy</span>
            {entregasHoy && entregasHoy.fallidas > 0 && (
              <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] gap-1 h-6 px-2"
            onClick={() => setShowEntregasDetail(prev => !prev)}
          >
            {showEntregasDetail ? 'Ocultar' : 'Ver mas'}
            {showEntregasDetail
              ? <ChevronUp className="h-3 w-3" />
              : <ChevronDown className="h-3 w-3" />
            }
          </Button>
        </div>

        {/* 4 contadores en fila */}
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
            <span className="text-lg font-bold text-foreground">{entregasHoy?.total ?? '--'}</span>
            <span className="text-[9px] text-muted-foreground">Total</span>
          </div>
          <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{entregasHoy?.enviadas ?? '--'}</span>
            <span className="text-[9px] text-muted-foreground">Enviadas</span>
          </div>
          <div className="flex flex-col items-center py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{entregasHoy?.pendientes ?? '--'}</span>
            <span className="text-[9px] text-muted-foreground">En proceso</span>
          </div>
          <div className="flex flex-col items-center py-2 rounded-lg bg-red-500/5 border border-red-500/20">
            <span className="text-lg font-bold text-red-600 dark:text-red-400">{entregasHoy?.fallidas ?? '--'}</span>
            <span className="text-[9px] text-muted-foreground">Fallidas</span>
          </div>
        </div>

        {/* Alarma por rechazos con diagnostico */}
        {entregasHoy && entregasHoy.fallidas > 0 && entregasHoy.fallidasConDiagnostico.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-500" />
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {entregasHoy.fallidas} entrega{entregasHoy.fallidas > 1 ? 's' : ''} fallida{entregasHoy.fallidas > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {entregasHoy.fallidasConDiagnostico.slice(0, 3).map((f) => (
                <div key={f.id} className="bg-background/50 rounded-md p-2 border border-red-500/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-foreground truncate">
                      {f.clienteNombre} — {f.tipoBoletin.replace(/_/g, ' ')}
                    </span>
                    <StatusPill level="critical" label={f.canal} compact />
                  </div>
                  <p className="text-[9px] text-red-600 dark:text-red-400 font-medium">{f.diagnostico.causa}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{f.diagnostico.accion}</p>
                </div>
              ))}
              {entregasHoy.fallidasConDiagnostico.length > 3 && (
                <p className="text-[9px] text-muted-foreground text-center">
                  +{entregasHoy.fallidasConDiagnostico.length - 3} fallida{entregasHoy.fallidasConDiagnostico.length - 3 > 1 ? 's' : ''} mas
                </p>
              )}
            </div>
          </div>
        )}

        {/* Expandible: detalle por tipo + en proceso */}
        {showEntregasDetail && entregasHoy && (
          <div className="space-y-3 border-t border-border/50 pt-3">
            {/* Por tipo de boletin */}
            {Object.keys(entregasHoy.porTipo).length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Por tipo de boletin</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(entregasHoy.porTipo).map(([tipo, counts]) => (
                    <div key={tipo} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{tipo.replace(/_/g, ' ')}</p>
                        <p className="text-[9px] text-muted-foreground">{counts.total} total</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {counts.fallidas > 0 && <StatusPill level="critical" label={`${counts.fallidas} fall.`} compact />}
                        {counts.pendientes > 0 && <StatusPill level="warning" label={`${counts.pendientes} pend.`} compact />}
                        {counts.enviadas > 0 && <StatusPill level="ok" label={`${counts.enviadas} env.`} compact />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* En proceso */}
            {entregasHoy.enProceso.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  En proceso ({entregasHoy.enProceso.length})
                </p>
                <div className="space-y-1.5">
                  {entregasHoy.enProceso.map((ep) => (
                    <div key={ep.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/20 border border-border/20">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{ep.clienteNombre}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {ep.tipoBoletin.replace(/_/g, ' ')} · {ep.canal}
                          {ep.fechaProgramada && (
                            <span className="ml-1">
                              · <Timer className="h-2.5 w-2.5 inline" />{' '}
                              {new Date(ep.fechaProgramada).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                      <StatusPill level="warning" label="pendiente" compact icon={<Clock className="h-2.5 w-2.5" />} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(entregasHoy.porTipo).length === 0 && entregasHoy.enProceso.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Sin entregas registradas hoy
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
