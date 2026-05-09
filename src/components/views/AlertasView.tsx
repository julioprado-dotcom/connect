'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bell, AlertTriangle } from 'lucide-react';

export function AlertasView() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-red-500" />
            Alerta Temprana
          </CardTitle>
          <CardDescription className="text-xs">
            Detección en tiempo real de crisis y picos de sentimiento negativo
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Product info card */}
          <div className="p-4 rounded-lg border-2 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <Bell className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-foreground">Alerta Temprana</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Premium Alta</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">⚠️ Definido</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Alertas en tiempo real por WhatsApp. Detección temprana de crisis, picos de sentimiento negativo y eventos relevantes. Solo para clientes premium.
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-[10px] text-muted-foreground">🕐 Inmediata</span>
                  <span className="text-[10px] text-muted-foreground">📱 WhatsApp</span>
                  <span className="text-[10px] text-muted-foreground">⏱ 1 min lectura</span>
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder section */}
          <div className="p-6 rounded-lg border border-dashed border-border text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Monitoreo de alertas en tiempo real</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Próximamente: detección automática de picos de sentimiento negativo y crisis.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              En desarrollo
            </div>
          </div>

          {/* Configuration placeholder */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
            <h4 className="text-xs font-semibold text-foreground">Configuración futura</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-lg border border-border">
                <p className="text-[11px] font-medium text-foreground">Umbral de sentimiento</p>
                <p className="text-[10px] text-muted-foreground">Configurar nivel de alerta: negativo, crítico, elogioso</p>
              </div>
              <div className="p-3 rounded-lg border border-border">
                <p className="text-[11px] font-medium text-foreground">Sujetos monitoreados</p>
                <p className="text-[10px] text-muted-foreground">Seleccionar legisladores y temas para alertas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
