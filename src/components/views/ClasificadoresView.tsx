'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Tag, Plus, Trash2, ChevronUp } from 'lucide-react';
import { EmptyState } from '@/components/shared/KPICard';
import type { EjeItem } from '@/types/dashboard';

export function ClasificadoresView() {
  const [ejes, setEjes] = useState<EjeItem[]>([]);
  const [ejesLoading, setEjesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form fields
  const [formNombre, setFormNombre] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcono, setFormIcono] = useState('⛏️');
  const [formColor, setFormColor] = useState('#6b7280');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formOrden, setFormOrden] = useState(0);

  const fetchEjes = useCallback(async () => {
    setEjesLoading(true);
    try {
      const res = await fetch('/api/ejes');
      const json = await res.json();
      setEjes(json.ejes || []);
    } catch { /* silent */ }
    finally { setEjesLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setEjesLoading(true);
      try {
        const res = await fetch('/api/ejes');
        const json = await res.json();
        if (!cancelled) setEjes(json.ejes || []);
      } catch { /* silent */ }
      finally { if (!cancelled) setEjesLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Auto-generate slug from nombre
  const handleNombreChange = (val: string) => {
    setFormNombre(val);
    if (!formSlug || formSlug === generateSlug(formNombre)) {
      setFormSlug(generateSlug(val));
    }
  };

  const resetForm = () => {
    setFormNombre('');
    setFormSlug('');
    setFormIcono('⛏️');
    setFormColor('#6b7280');
    setFormDescripcion('');
    setFormKeywords('');
    setFormOrden(0);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) { setFormError('Nombre requerido'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch('/api/ejes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre.trim(),
          slug: formSlug.trim() || generateSlug(formNombre),
          icono: formIcono,
          color: formColor,
          descripcion: formDescripcion,
          keywords: formKeywords,
          orden: formOrden,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear');
      resetForm();
      setShowForm(false);
      await fetchEjes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ejes?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await fetchEjes();
    } catch { /* silent */ }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Ejes temáticos
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {ejes.length} clasificadores activos para análisis de menciones
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="text-xs gap-1.5"
            >
              {showForm ? <ChevronUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showForm ? 'Cerrar' : 'Añadir clasificador'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Inline form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="p-4 rounded-lg border border-primary/20 bg-muted/30 space-y-3">
              <p className="text-xs font-semibold text-foreground">Nuevo clasificador</p>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Nombre *</label>
                  <Input value={formNombre} onChange={e => handleNombreChange(e.target.value)} placeholder="Ej: Minería y Metales" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Slug</label>
                  <Input value={formSlug} onChange={e => setFormSlug(e.target.value)} placeholder="mineria-metales" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Icono</label>
                  <Input value={formIcono} onChange={e => setFormIcono(e.target.value)} placeholder="⛏️" className="h-8 text-xs w-20" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer border border-border" />
                    <Input value={formColor} onChange={e => setFormColor(e.target.value)} className="h-8 text-xs w-28" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Orden</label>
                  <Input type="number" value={formOrden} onChange={e => setFormOrden(Number(e.target.value))} className="h-8 text-xs w-20" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Descripción</label>
                <textarea
                  value={formDescripcion}
                  onChange={e => setFormDescripcion(e.target.value)}
                  placeholder="Descripción del clasificador..."
                  className="w-full min-h-[60px] px-3 py-2 text-xs rounded-md border border-border bg-background resize-y"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Keywords (separadas por coma)</label>
                <Input value={formKeywords} onChange={e => setFormKeywords(e.target.value)} placeholder="minería,estano,zinc,litio" className="h-8 text-xs" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={formLoading} className="text-xs">
                  {formLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Crear clasificador
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-xs">Cancelar</Button>
              </div>
            </form>
          )}

          {/* Classifier cards grid */}
          {ejesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : ejes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ejes.map((eje) => (
                <div key={eje.id} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {eje.icono && <span className="text-sm shrink-0">{eje.icono}</span>}
                        {eje.color && (
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: eje.color }} />
                        )}
                        <p className="text-sm font-semibold text-foreground truncate">{eje.nombre}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{eje.descripcion || eje.slug}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                        {eje.mencionesCount}
                      </Badge>
                      {deleteId === eje.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(eje.id)} className="text-[10px] text-red-500 hover:underline font-medium">Sí</button>
                          <button onClick={() => setDeleteId(null)} className="text-[10px] text-muted-foreground hover:underline">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteId(eje.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-opacity"
                          title="Desactivar clasificador"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  {eje.keywords && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {eje.keywords.split(',').slice(0, 5).map((kw, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {kw.trim()}
                        </span>
                      ))}
                      {eje.keywords.split(',').length > 5 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          +{eje.keywords.split(',').length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Tag className="h-10 w-10" />} text="No hay clasificadores registrados" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
