'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES, FRECUENCIA_LABELS } from '@/constants/nav';
import { PRODUCTOS } from '@/constants/products';
import type { TipoBoletin } from '@/types/bulletin';
import { Check } from 'lucide-react';

/* ─── STEP 2: Product Selection ───────────────────────────── */
export function StepProducts({
  selected,
  onToggle,
}: {
  selected: TipoBoletin[];
  onToggle: (tipo: TipoBoletin) => void;
}) {
  const categories = PRODUCT_CATEGORIES.filter((c) => c.id !== 'gratuito');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Seleccionar Productos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Elija los productos que desea contratar.
        </p>
      </div>

      {categories.map((cat) => {
        const products = ALL_PRODUCTS.filter((p) => p.categoria === cat.id);
        if (products.length === 0) return null;
        const catLabel = cat.label;

        return (
          <div key={cat.id} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {catLabel}
            </p>
            <div className="space-y-2">
              {products.map((prod) => {
                const isSelected = selected.includes(prod.tipo);
                const config = PRODUCTOS[prod.tipo];
                const Icon = prod.icon;
                return (
                  <button
                    key={prod.tipo}
                    type="button"
                    onClick={() => onToggle(prod.tipo)}
                    className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/30'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    {/* checkbox indicator */}
                    <div
                      className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {/* icon */}
                    <div
                      className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: prod.color + '18' }}
                    >
                      <Icon className="h-4.5 w-4.5" style={{ color: prod.color }} />
                    </div>
                    {/* info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {prod.nombre}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {FRECUENCIA_LABELS[config.frecuencia] || config.frecuencia}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {config.descripcion}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary */}
      {selected.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-0">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {selected.length} producto{selected.length > 1 ? 's' : ''} seleccionado{selected.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selected.map((tipo) => {
                const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
                return (
                  <Badge key={tipo} variant="outline" className="text-[10px]">
                    {prod?.nombre || tipo}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
