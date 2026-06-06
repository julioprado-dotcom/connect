'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface GeneratorPreviewModalProps {
  open: boolean;
  onClose: () => void;
  reporte: Record<string, unknown> | null;
}

function parseContenido(reporte: Record<string, unknown>): string | null {
  const raw = reporte.contenido;
  if (!raw) return null;

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed.textoCompleto || parsed.texto || parsed.contenido || null;
  } catch {
    return typeof raw === 'string' ? raw : null;
  }
}

function formatResumen(resumen: string): string {
  return resumen.replace(/\\n/g, '\n');
}

export function GeneratorPreviewModal({ open, onClose, reporte }: GeneratorPreviewModalProps) {
  if (!open || !reporte) return null;

  const resumen = (reporte.resumen as string) || '';
  const contenidoCompleto = parseContenido(reporte);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl border border-border max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Contenido completo */}
          {contenidoCompleto ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="rounded-lg p-4" style={{ background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.1)' }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: '#00ff88' }}>
                  Contenido del reporte
                </p>
                <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-[inherit]" style={{ fontFamily: 'inherit' }}>
                  {contenidoCompleto}
                </pre>
              </div>
            </div>
          ) : resumen ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {formatResumen(resumen)}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8" style={{ color: '#6b7280' }}>
              <p className="text-xs">Sin contenido disponible para este reporte.</p>
            </div>
          )}

          {/* Sentimiento */}
          {(reporte.sentimientoPromedio as number) > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
