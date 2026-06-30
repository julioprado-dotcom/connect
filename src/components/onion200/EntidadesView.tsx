'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, ChevronLeft, ChevronRight, Search, Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PersonaRow {
  id: string;
  nombre: string;
  tipo: string;
  cargoDirectiva: string | null;
  partidoSigla: string;
  camara: string;
  departamento: string;
  fechaActualizacion: string;
}

export function EntidadesView() {
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [stats, setStats] = useState<{ titular: number; figura: number; total: number } | null>(null);

  const PAGE_SIZE = 25;

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/personas?${params}`);
      const json = await res.json();

      // Si hay filtro de tipo, filtramos en cliente
      let items = json.personas || [];
      if (filtroTipo !== 'TODOS') {
        items = items.filter((p: PersonaRow) => p.tipo === filtroTipo);
      }

      setPersonas(items);
      setTotal(json.total || 0);

      // Obtener resumen por tipo
      if (!stats) {
        const resStats = await fetch('/api/personas?limit=1&page=1');
        const jsonStats = await resStats.json();
        // Contar tipos directamente
        const todas = await fetch('/api/personas?limit=2000&page=1');
        const todasJson = await todas.json();
        const all = todasJson.personas || [];
        const titular = all.filter((p: PersonaRow) => p.tipo === 'Titular').length;
        const figura = all.filter((p: PersonaRow) => p.tipo === 'FIGURA_DETECTADA').length;
        setStats({ titular, figura, total: all.length });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, filtroTipo, stats]);

  useEffect(() => { fetchPersonas(); }, [fetchPersonas]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const tipoBadge = (tipo: string) => {
    if (tipo === 'FIGURA_DETECTADA') {
      return <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">FIGURA DETECTADA</Badge>;
    }
    if (tipo === 'Titular') {
      return <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">TITULAR</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-700">{tipo}</Badge>;
  };



  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Entidades</h2>
            <p className="text-xs text-muted-foreground">
              Registro verificado de personas y sus cargos
            </p>
          </div>
        </div>
        {stats && (
          <div className="flex gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-center">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{stats.titular}</p>
              <p className="text-[9px] text-blue-600/70 dark:text-blue-400/70">Titulares</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-center">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300">{stats.figura}</p>
              <p className="text-[9px] text-purple-600/70 dark:text-purple-400/70">Detectadas</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/30 text-center">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{stats.total}</p>
              <p className="text-[9px] text-gray-600/70 dark:text-gray-400/70">Total</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['TODOS', 'FIGURA_DETECTADA', 'Titular'].map((tipo) => (
                <Button
                  key={tipo}
                  variant={filtroTipo === tipo ? 'default' : 'outline'}
                  size="sm"
                  className="text-[10px] h-7 px-2.5"
                  onClick={() => { setFiltroTipo(tipo); setPage(1); }}
                >
                  {tipo === 'TODOS' ? 'Todos' : tipo === 'FIGURA_DETECTADA' ? 'Figuras Detectadas' : 'Titulares'}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-4 pt-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : personas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Nombre</TableHead>
                    <TableHead className="text-xs font-semibold">Tipo</TableHead>
                    <TableHead className="text-xs font-semibold">Cargo / Directiva</TableHead>
                    <TableHead className="text-xs font-semibold hidden sm:table-cell">Camara</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Depto</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">Partido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personas.map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {p.nombre.charAt(0)}
                          </div>
                          <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">{tipoBadge(p.tipo)}</TableCell>
                      <TableCell className="py-2.5">
                        {p.cargoDirectiva ? (
                          <span className="text-xs text-foreground font-medium">{p.cargoDirectiva}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin cargo registrado</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                        {p.camara || '—'}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                        {p.departamento || '—'}
                      </TableCell>
                      <TableCell className="py-2.5 hidden lg:table-cell">
                        {p.partidoSigla ? (
                          <Badge variant="secondary" className={`text-[10px] ${p.partidoSigla === 'MAS' ? 'bg-red-600 text-white' : p.partidoSigla === 'CC' ? 'bg-blue-600 text-white' : p.partidoSigla === 'CREEMS' ? 'bg-green-600 text-white' : ''}`}>
                            {p.partidoSigla}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? 'Sin resultados para la busqueda' : 'No hay entidades registradas'}
              </p>
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-xs h-7 px-2">
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground px-2 flex items-center">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="text-xs h-7 px-2">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/10">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <Eye className="h-4 w-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">Verificacion de entidades</p>
              <p className="text-[10px] text-violet-600/70 dark:text-violet-400/70 mt-0.5">
                Este modulo asocia nombres verificados con sus cargos reales. El pipeline de generacion consulta esta tabla
                para validar que los cargos atribuidos en los productos sean correctos. Las &quot;Figuras Detectadas&quot; son
                personas identificadas por IA y confirmadas. Los &quot;Titulares&quot; son legisladores oficiales del periodo 2025-2030.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
