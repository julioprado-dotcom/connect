'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert, Clock, AlertTriangle, FileWarning,
  ChevronRight, UserPlus, Package, Radio,
  CalendarClock, Send,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface ContratoPorVencer {
  id: string;
  clienteId: string;
  clienteNombre: string;
  tipoProducto: string;
  frecuencia: string;
  fechaFin: string;
  diasRestantes: number;
  montoMensual: number;
  moneda: string;
}

interface SolicitudPendiente {
  contratoId: string;
  tipo: string;
  descripcion: string;
  clienteNombre: string;
}

interface AlarmasComercialesProps {
  contratosPorVencer: ContratoPorVencer[];
  solicitudesPendientes: SolicitudPendiente[];
  entregasPendientes: number;
  onNavigate: (viewId: string) => void;
}

// ─── Urgency helpers ────────────────────────────────────

function getUrgency(dias: number): { color: string; bg: string; label: string } {
  if (dias <= 7) return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', label: 'Urgente' };
  if (dias <= 15) return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', label: 'Proximo' };
  return { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10', label: 'Atencion' };
}

function getTipoIcon(tipo: string) {
  switch (tipo) {
    case 'sin_contrato': return <UserPlus className="h-3 w-3 text-blue-500" />;
    case 'sin_medios': return <Radio className="h-3 w-3 text-purple-500" />;
    case 'sin_parlamentarios': return <UserPlus className="h-3 w-3 text-cyan-500" />;
    case 'sin_productos': return <Package className="h-3 w-3 text-orange-500" />;
    default: return <FileWarning className="h-3 w-3 text-muted-foreground" />;
  }
}

function getTipoColor(tipo: string): string {
  switch (tipo) {
    case 'sin_contrato': return 'text-blue-700 dark:text-blue-400';
    case 'sin_medios': return 'text-purple-700 dark:text-purple-400';
    case 'sin_parlamentarios': return 'text-cyan-700 dark:text-cyan-400';
    case 'sin_productos': return 'text-orange-700 dark:text-orange-400';
    default: return 'text-muted-foreground';
  }
}

// ─── Contrato por vencer row ────────────────────────────

function ContratoRow({ contrato, onNavigate }: {
  contrato: ContratoPorVencer;
  onNavigate: (viewId: string) => void;
}) {
  const urgency = getUrgency(contrato.diasRestantes);

  const handleClick = () => onNavigate('clientes');

  return (
    <div
      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
      onClick={handleClick}
    >
      {/* Urgency indicator */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${
        contrato.diasRestantes <= 7 ? 'bg-red-500 animate-pulse' :
        contrato.diasRestantes <= 15 ? 'bg-amber-500' :
        'bg-yellow-500'
      }`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-foreground truncate">
          {contrato.clienteNombre}
        </p>
        <p className="text-[9px] text-muted-foreground">
          {contrato.frecuencia} · {contrato.moneda} {contrato.montoMensual}/mes
        </p>
      </div>

      {/* Dias restantes */}
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold shrink-0 ${urgency.bg} ${urgency.color}`}>
        <Clock className="h-3 w-3" />
        <span>{contrato.diasRestantes}d</span>
      </div>

      <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0">
        {urgency.label}
      </Badge>

      <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </div>
  );
}

// ─── Solicitud pendiente row ────────────────────────────

function SolicitudRow({ solicitud, onNavigate }: {
  solicitud: SolicitudPendiente;
  onNavigate: (viewId: string) => void;
}) {
  const handleClick = () => {
    if (solicitud.tipo === 'sin_contrato') onNavigate('clientes');
    else onNavigate('clientes');
  };

  return (
    <div
      className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
      onClick={handleClick}
    >
      {getTipoIcon(solicitud.tipo)}
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-medium truncate ${getTipoColor(solicitud.tipo)}`}>
          {solicitud.descripcion}
        </p>
        <p className="text-[9px] text-muted-foreground">{solicitud.clienteNombre}</p>
      </div>
      <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function AlarmasComerciales({ contratosPorVencer, solicitudesPendientes, entregasPendientes, onNavigate }: AlarmasComercialesProps) {
  const totalAlertas = contratosPorVencer.length + solicitudesPendientes.length;

  return (
    <Card className={`hover:shadow-md transition-all ${totalAlertas > 0 ? 'border-l-4 border-l-red-500' : ''}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Alarmas Comerciales
            {totalAlertas > 0 && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                {totalAlertas}
              </Badge>
            )}
          </CardTitle>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            Ver contratos <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3">
        {totalAlertas === 0 && entregasPendientes === 0 ? (
          <div className="py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-medium">Todo en orden</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Sin contratos por vencer ni solicitudes pendientes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Contratos por vencer */}
            {contratosPorVencer.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5 px-2">
                  <CalendarClock className="h-3 w-3 text-red-500" />
                  <p className="text-[9px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Contratos por vencer ({contratosPorVencer.length})
                  </p>
                </div>
                <div className="space-y-0.5">
                  {contratosPorVencer.map((c) => (
                    <ContratoRow key={c.id} contrato={c} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            )}

            {/* Solicitudes pendientes */}
            {solicitudesPendientes.length > 0 && (
              <div className={contratosPorVencer.length > 0 ? 'pt-3 border-t border-border/50' : ''}>
                <div className="flex items-center gap-1.5 mb-1.5 px-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Solicitudes pendientes ({solicitudesPendientes.length})
                  </p>
                </div>
                <div className="space-y-0.5">
                  {solicitudesPendientes.slice(0, 6).map((s, i) => (
                    <SolicitudRow key={`${s.tipo}-${s.contratoId}-${i}`} solicitud={s} onNavigate={onNavigate} />
                  ))}
                  {solicitudesPendientes.length > 6 && (
                    <p className="text-[9px] text-muted-foreground text-center py-1">
                      y {solicitudesPendientes.length - 6} solicitudes mas...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Entregas pendientes */}
            {entregasPendientes > 0 && (
              <div className={`pt-3 border-t border-border/50 ${contratosPorVencer.length > 0 || solicitudesPendientes.length > 0 ? '' : ''}`}>
                <div
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors"
                  onClick={() => onNavigate('jobs')}
                >
                  <Send className="h-3 w-3 text-amber-500" />
                  <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 flex-1">
                    {entregasPendientes} entregas pendientes de envio
                  </p>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
