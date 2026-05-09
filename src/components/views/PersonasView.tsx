'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, FilterSelect } from '@/components/shared/KPICard';
import { PARTIDO_COLORS, CAMARAS, DEPARTAMENTOS, PARTIDOS } from '@/constants/ui';
import type { PersonaListItem } from '@/types/dashboard';

export function PersonasView() {
  const [personaList, setPersonaList] = useState<PersonaListItem[]>([]);
  const [personaTotal, setPersonaTotal] = useState(0);
  const [personaPage, setPersonaPage] = useState(1);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [filtroCamara, setFiltroCamara] = useState('Todas');
  const [filtroDepto, setFiltroDepto] = useState('Todos');
  const [filtroPartido, setFiltroPartido] = useState('Todos');
  const [personaSearch, setPersonaSearch] = useState('');

  // Initial load + reload on filter/page change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPersonaLoading(true);
      try {
        const params = new URLSearchParams({ page: String(personaPage), limit: '20' });
        if (filtroCamara !== 'Todas') params.set('camara', filtroCamara);
        if (filtroDepto !== 'Todos') params.set('departamento', filtroDepto);
        if (filtroPartido !== 'Todos') params.set('partido', filtroPartido);
        if (personaSearch) params.set('search', personaSearch);
        const res = await fetch(`/api/personas?${params}`);
        const json = await res.json();
        if (!cancelled) {
          setPersonaList(json.personas || []);
          setPersonaTotal(json.total || 0);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setPersonaLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [personaPage, filtroCamara, filtroDepto, filtroPartido, personaSearch]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Buscar legislador..."
              value={personaSearch}
              onChange={(e) => setPersonaSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <FilterSelect value={filtroCamara} onChange={setFiltroCamara} options={CAMARAS} />
              <FilterSelect value={filtroDepto} onChange={setFiltroDepto} options={DEPARTAMENTOS} />
              <FilterSelect value={filtroPartido} onChange={setFiltroPartido} options={PARTIDOS} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Legisladores registrados
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Total: {personaTotal} personas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {personaLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : personaList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Cámara</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Departamento</TableHead>
                    <TableHead className="text-xs">Partido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personaList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="py-2.5">
                        <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{p.camara}</TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">{p.departamento}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            PARTIDO_COLORS[p.partidoSigla]
                              ? `${PARTIDO_COLORS[p.partidoSigla]} text-white`
                              : ''
                          }`}
                        >
                          {p.partidoSigla}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState icon={<Users className="h-10 w-10" />} text="No se encontraron legisladores" />
          )}
          {/* Pagination */}
          {personaTotal > 20 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Página {personaPage} de {Math.ceil(personaTotal / 20)}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={personaPage <= 1} onClick={() => setPersonaPage((p) => p - 1)} className="text-xs">
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" disabled={personaPage >= Math.ceil(personaTotal / 20)} onClick={() => setPersonaPage((p) => p + 1)} className="text-xs">
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
