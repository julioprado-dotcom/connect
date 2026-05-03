'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Radio } from 'lucide-react';
import { EmptyState, LevelTab } from '@/components/shared/KPICard';
import { NIVEL_LABELS, NIVEL_COLORS } from '@/constants/ui';
import type { MedioItem } from '@/types/dashboard';

export function MediosView() {
  const [medios, setMedios] = useState<MedioItem[]>([]);
  const [mediosLoading, setMediosLoading] = useState(false);
  const [mediosNivel, setMediosNivel] = useState('todos');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMediosLoading(true);
      try {
        const params = new URLSearchParams();
        if (mediosNivel !== 'todos') params.set('nivel', mediosNivel);
        const res = await fetch(`/api/medios?${params}`);
        const json = await res.json();
        if (!cancelled) setMedios(json.medios || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setMediosLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mediosNivel]);

  return (
    <div className="space-y-4">
      {/* Level tabs */}
      <div className="flex flex-wrap gap-2">
        <LevelTab active={mediosNivel === 'todos'} onClick={() => setMediosNivel('todos')} label="Todos" />
        {['1', '2', '3', '4', '5'].map((n) => (
          <LevelTab key={n} active={mediosNivel === n} onClick={() => setMediosNivel(n)} label={NIVEL_LABELS[n]} nivel={n} />
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          {mediosLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : medios.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {medios.map((m) => (
                <div key={m.id} className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.nombre}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{m.tipo}</p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${NIVEL_COLORS[m.nivel]}`}>
                      N{m.nivel}
                    </Badge>
                  </div>
                  {m.departamento && (
                    <p className="text-[11px] text-muted-foreground mt-1">{m.departamento}</p>
                  )}
                  {m.plataformas && (
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{m.plataformas}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">{m.mencionesCount} menciones</span>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                        Visitar <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Radio className="h-10 w-10" />} text="No hay medios registrados" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
