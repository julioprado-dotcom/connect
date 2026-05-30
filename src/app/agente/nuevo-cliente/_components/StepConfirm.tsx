'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ALL_PRODUCTS, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';
import { PRODUCTOS } from '@/constants/products';
import type { TipoBoletin } from '@/types/bulletin';
import { Check, CheckCircle2 } from 'lucide-react';
import { type ClienteData, type ProductConfig, getDefaultPrice, todayStr } from './shared';

/* ─── Step indicator ──────────────────────────────────────── */
export function StepIndicator({ step }: { step: number }) {
  const steps = ['Cliente', 'Productos', 'Confirmar'];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = step === stepNum;
        const isDone = step > stepNum;
        return (
          <div key={stepNum} className="flex items-center gap-2 flex-1">
            <div
              className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : isDone
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── STEP 3: Configuration + Confirm ─────────────────────── */
export function StepConfirm({
  cliente,
  products,
  productConfigs,
  onUpdateConfig,
}: {
  cliente: ClienteData;
  products: TipoBoletin[];
  productConfigs: Record<string, ProductConfig>;
  onUpdateConfig: (tipo: TipoBoletin, config: Partial<ProductConfig>) => void;
}) {
  const totalMensual = products.reduce(
    (sum, tipo) => sum + (productConfigs[tipo]?.precio || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Configuraci&oacute;n + Confirmar</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Revise y ajuste la configuraci&oacute;n de cada producto.
        </p>
      </div>

      {/* Product config cards */}
      <div className="space-y-3">
        {products.map((tipo) => {
          const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
          const config = PRODUCTOS[tipo];
          const pc = productConfigs[tipo] || {
            tipo,
            canal: 'whatsapp',
            frecuencia: config.frecuencia,
            precio: getDefaultPrice(tipo),
            fechaInicio: todayStr(),
          };

          return (
            <Card key={tipo} className="space-y-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{prod?.nombre || tipo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {/* Canal */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Canal de entrega
                  </label>
                  <div className="flex gap-2">
                    {['whatsapp', 'email', 'ambos'].map((canal) => (
                      <button
                        key={canal}
                        type="button"
                        onClick={() => onUpdateConfig(tipo, { canal })}
                        className={`flex-1 h-8 rounded-lg text-xs font-medium transition-colors ${
                          pc.canal === canal
                            ? 'bg-emerald-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {canal === 'ambos' ? 'Ambos' : CANAL_LABELS[canal] || canal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frecuencia */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Frecuencia
                  </label>
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={pc.frecuencia}
                    onChange={(e) => onUpdateConfig(tipo, { frecuencia: e.target.value })}
                  >
                    {Object.entries(FRECUENCIA_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Precio + Fecha row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Precio mensual (Bs)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={pc.precio}
                      onChange={(e) =>
                        onUpdateConfig(tipo, { precio: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Fecha inicio
                    </label>
                    <Input
                      type="date"
                      value={pc.fechaInicio}
                      onChange={(e) => onUpdateConfig(tipo, { fechaInicio: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Final summary */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium text-foreground">{cliente.nombre}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{cliente.email}</span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="space-y-1.5">
            {products.map((tipo) => {
              const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
              const pc = productConfigs[tipo];
              return (
                <div key={tipo} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{prod?.nombre}</span>
                  <span className="font-medium text-foreground">
                    Bs {pc?.precio.toLocaleString('es-BO', { minimumFractionDigits: 0 }) || 0}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between text-sm font-bold">
            <span className="text-foreground">Total mensual</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Bs {totalMensual.toLocaleString('es-BO', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Success State ───────────────────────────────────────── */
export function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">&iexcl;Registro exitoso!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          El cliente y los contratos han sido creados correctamente.
        </p>
      </div>
      <Button onClick={onReset} variant="outline" size="sm">
        Crear otro cliente
      </Button>
    </div>
  );
}
