'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight, ArrowDownRight, Minus, ChevronRight,
  Flame, TrendingUp, Hash,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface VariacionItem {
  id: string;
  nombre: string;
  slug?: string;
  color?: string;
  icono?: string;
  partidoSigla?: string;
  camara?: string;
  mencionesActuales: number;
  mencionesAnteriores: number;
  variacion: number;
}

interface TopVariacionesData {
  personas: VariacionItem[];
  ejes: VariacionItem[];
}

interface TopVariationsProps {
  data: TopVariacionesData;
  onNavigate: (viewId: string) => void;
}

// ─── Variation row component ────────────────────────────

function VariacionRow({ item, index, type, onNavigate }: {
  item: VariacionItem;
  index: number;
  type: 'persona' | 'eje';
  onNavigate: (viewId: string) => void;
}) {
  const isUp = item.variacion > 0;
  const isDown = item.variacion < 0;
  const isNeutral = item.variacion === 0;

  const handleClick = () => {
    if (type === 'persona') onNavigate('menciones');
    else onNavigate('indicadores');
  };

  const rankColors = [
    'bg-amber-500 text-white',
    'bg-stone-400 text-white',
    'bg-amber-700 text-white',
    'bg-muted text-muted-foreground',
    'bg-muted text-muted-foreground',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
      onClick={handleClick}
    >
      {/* Rank badge */}
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${rankColors[index]}`}>
        {index + 1}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {type === 'persona' ? (
            <Flame className="h-3 w-3 text-orange-400 shrink-0" />
          ) : (
            <Hash className="h-3 w-3 shrink-0" style={{ color: item.color || '#888' }} />
          )}
          <p className="text-[11px] font-medium text-foreground truncate">
            {item.nombre}
          </p>
          {type === 'persona' && item.partidoSigla && (
            <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto shrink-0">
              {item.partidoSigla}
            </Badge>
          )}
        </div>
        <p className="text-[9px] text-muted-foreground ml-[18px]">
          {item.mencionesAnteriores} → {item.mencionesActuales} menciones
        </p>
      </div>

      {/* Variation indicator */}
      <div className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold shrink-0 ${
        isUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
        isDown ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
        'bg-muted text-muted-foreground'
      }`}>
        {isNeutral ? (
          <Minus className="h-3 w-3" />
        ) : isUp ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : (
          <ArrowDownRight className="h-3 w-3" />
        )}
        <span>{Math.abs(item.variacion)}%</span>
      </div>

      {/* Navigate arrow */}
      <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function TopVariations({ data, onNavigate }: TopVariationsProps) {
  const hasPersonas = data.personas.length > 0;
  const hasEjes = data.ejes.length > 0;
  const hasData = hasPersonas || hasEjes;

  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            Top 5 Mayor Variacion
            <Badge variant="secondary" className="text-[8px] px-1.5 py-0">
              7d vs 7d anterior
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3">
        {!hasData ? (
          <div className="py-6 text-center text-muted-foreground text-xs">
            Sin suficientes datos para calcular variaciones
          </div>
        ) : (
          <div className="space-y-1">
            {/* Personas section */}
            {hasPersonas && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                  Legisladores
                </p>
                {data.personas.map((p, i) => (
                  <VariacionRow key={p.id} item={p} index={i} type="persona" onNavigate={onNavigate} />
                ))}
              </div>
            )}

            {/* Ejes section */}
            {hasEjes && (
              <div className={hasPersonas ? 'mt-3 pt-3 border-t border-border/50' : ''}>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                  Ejes Tematicos
                </p>
                {data.ejes.map((e, i) => (
                  <VariacionRow key={e.id} item={e} index={i} type="eje" onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
