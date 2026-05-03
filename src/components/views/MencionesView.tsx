'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Newspaper, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/KPICard';
import { SENTIMIENTO_STYLES, TIPO_MENCION_LABELS } from '@/constants/ui';
import type { MencionRow } from '@/types/dashboard';

export function MencionesView() {
  const [menciones, setMenciones] = useState<MencionRow[]>([]);
  const [mencionesTotal, setMencionesTotal] = useState(0);
  const [mencionesPage, setMencionesPage] = useState(1);
  const [mencionesLoading, setMencionesLoading] = useState(false);

  // Initial load + reload on page change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMencionesLoading(true);
      try {
        const res = await fetch(`/api/menciones?page=${mencionesPage}&limit=15`);
        const json = await res.json();
        if (!cancelled) {
          setMenciones(json.menciones || []);
          setMencionesTotal(json.total || 0);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setMencionesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mencionesPage]);

  // Manual refresh
  const refreshMenciones = useCallback(async () => {
    setMencionesLoading(true);
    try {
      const res = await fetch(`/api/menciones?page=${mencionesPage}&limit=15`);
      const json = await res.json();
      setMenciones(json.menciones || []);
      setMencionesTotal(json.total || 0);
    } catch {
      // silent
    } finally {
      setMencionesLoading(false);
    }
  }, [mencionesPage]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                Registro de menciones
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Total: {mencionesTotal} menciones
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshMenciones} className="text-xs gap-1">
                <RefreshCw className="h-3 w-3" /> Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {mencionesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : menciones.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Legislador</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Cámara</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Partido</TableHead>
                    <TableHead className="text-xs">Medio</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Título</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Sentimiento</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menciones.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="py-2.5">
                        <p className="text-sm font-medium text-foreground max-w-[140px] truncate">{m.persona?.nombre || '—'}</p>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{m.persona?.camara || '—'}</TableCell>
                      <TableCell className="py-2.5 hidden md:table-cell">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{m.persona?.partidoSigla || '—'}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">{m.medio?.nombre || '—'}</TableCell>
                      <TableCell className="py-2.5 hidden lg:table-cell">
                        <p className="text-xs text-foreground/80 max-w-[180px] truncate">{m.titulo || m.texto?.substring(0, 50) || '—'}</p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-[10px] text-muted-foreground">{TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}</span>
                      </TableCell>
                      <TableCell className="py-2.5 hidden sm:table-cell">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado}`}>
                          {m.sentimiento.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                        {m.fechaCaptura ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState icon={<Newspaper className="h-10 w-10" />} text="No hay menciones registradas" />
          )}
          {/* Pagination */}
          {mencionesTotal > 15 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Página {mencionesPage} de {Math.ceil(mencionesTotal / 15)}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={mencionesPage <= 1} onClick={() => setMencionesPage((p) => p - 1)} className="text-xs">
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" disabled={mencionesPage >= Math.ceil(mencionesTotal / 15)} onClick={() => setMencionesPage((p) => p + 1)} className="text-xs">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
