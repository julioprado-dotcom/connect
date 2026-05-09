'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileBarChart, FileText } from 'lucide-react';
import { EmptyState } from '@/components/shared/KPICard';
import { useDashboardStore } from '@/stores/useDashboardStore';

export function ReportesView() {
  const { setError } = useDashboardStore();
  const [reportes, setReportes] = useState<Record<string, unknown>[]>([]);
  const [reportesLoading, setReportesLoading] = useState(false);
  const [generarReporteLoading, setGenerarReporteLoading] = useState(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReportesLoading(true);
      try {
        const res = await fetch('/api/reportes');
        const json = await res.json();
        if (!cancelled) setReportes(json.reportes || json || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setReportesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Refresh for after generating
  const refreshReportes = useCallback(async () => {
    setReportesLoading(true);
    try {
      const res = await fetch('/api/reportes');
      const json = await res.json();
      setReportes(json.reportes || json || []);
    } catch {
      // silent
    } finally {
      setReportesLoading(false);
    }
  }, []);

  const handleGenerarReporte = async () => {
    setGenerarReporteLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reportes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'semanal' }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else await refreshReportes();
    } catch {
      setError('Error al generar reporte');
    } finally {
      setGenerarReporteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-muted-foreground" />
                Reportes generados
              </CardTitle>
            </div>
            <Button onClick={handleGenerarReporte} disabled={generarReporteLoading} size="sm" className="gap-2 text-xs">
              {generarReporteLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              Generar reporte semanal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {reportesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reportes.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {reportes.map((r: Record<string, unknown>, i: number) => (
                <div key={String(r.id || i)} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground capitalize">
                      {(r.tipo as string)?.replace(/_/g, ' ') || 'Reporte'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {r.totalMenciones ? `${r.totalMenciones} menciones · ` : ''}
                      {r.fechaCreacion ? new Date(r.fechaCreacion as string).toLocaleDateString('es-BO') : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {String(r.totalMenciones || 0)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<FileBarChart className="h-10 w-10" />} text="No hay reportes generados" subtext="Genera tu primer reporte semanal" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
