'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface GeneratorPreviewModalProps {
  open: boolean;
  onClose: () => void;
  reporte: Record<string, unknown> | null;
}

export function GeneratorPreviewModal({ open, onClose, reporte }: GeneratorPreviewModalProps) {
  if (!open || !reporte) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl border border-border max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {(reporte.tipo as string)?.replace(/_/g, ' ') || 'Reporte'}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {new Date(reporte.fechaCreacion as string).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {(reporte.totalMenciones as number) > 0 && <span> · {(reporte.totalMenciones as number)} menciones</span>}
              {(reporte.enviado as boolean) && <span className="text-emerald-500 ml-1">· Enviado</span>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {(reporte.resumen as string) || 'Sin contenido de resumen.'}
            </p>
          </div>
          {(reporte.sentimientoPromedio as number) > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Sentimiento promedio</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${((reporte.sentimientoPromedio as number) / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-foreground">{(reporte.sentimientoPromedio as number).toFixed(1)}/5</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
