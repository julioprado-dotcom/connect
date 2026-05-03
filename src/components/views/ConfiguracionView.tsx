'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatItem } from '@/components/shared/KPICard';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { Settings, Database, Loader2 } from 'lucide-react';

export function ConfiguracionView() {
  const { data, setError, setData } = useDashboardStore();
  const [seedLoading, setSeedLoading] = useState(false);

  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        try {
          const statsRes = await fetch('/api/stats');
          if (statsRes.ok) {
            const statsJson = await statsRes.json();
            setData(statsJson);
            setError('');
          }
        } catch { /* silent */ }
      }
    } catch {
      setError('Error al ejecutar seed');
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Configuración del sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">Marco filosófico</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este sistema opera bajo los principios de pluralismo político y libertad de expresión
              consagrados en la Constitución Política del Estado Plurinacional de Bolivia (2009).
              No emitimos juicios de valor sobre las opiniones de legisladores ni partidos.
              Nuestro objetivo es proporcionar datos objetivos sobre la presencia mediática.
            </p>
          </div>

          <Separator />

          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">Datos del sistema</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <StatItem label="Legisladores" value={String(data?.totalPersonas || 0)} />
              <StatItem label="Medios" value={String(data?.totalMedios || 0)} />
              <StatItem label="Ejes temáticos" value={String(data?.totalEjes || 0)} />
              <StatItem label="Reportes" value={String(data?.totalReportes || 0)} />
            </div>
          </div>

          <Separator />

          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Acciones de administración</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSeed} disabled={seedLoading} className="text-xs gap-1">
                {seedLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                Cargar datos de ejemplo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
