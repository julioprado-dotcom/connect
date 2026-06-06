'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Tag, Plus, Trash2, ChevronUp, Eye, EyeOff, Power, RotateCcw, Pencil, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/shared/KPICard';
import type { EjeItem } from '@/types/dashboard';

// ─── Dimension config ─────────────────────────────────────────

const DIMENSIONS = [
  { key: '', label: 'Todas', emoji: '' },
  { key: 'produccion', label: 'Producción', emoji: '🟢' },
  { key: 'precio', label: 'Precio', emoji: '💰' },
  { key: 'conflicto', label: 'Conflicto', emoji: '🔴' },
  { key: 'regulacion', label: 'Regulación', emoji: '🔵' },
  { key: 'infraestructura', label: 'Infraestructura', emoji: '⚪' },
] as const;

const DIMENSION_BADGE: Record<string, string> = {
  produccion: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  precio: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  conflicto: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  regulacion: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  infraestructura: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
};

const DIMENSION_LABEL: Record<string, string> = {
  produccion: '🟢 Producción',
  precio: '💰 Precio',
  conflicto: '🔴 Conflicto',
  regulacion: '🔵 Regulación',
  infraestructura: '⚪ Infraestructura',
};

// ─── Slug generator ───────────────────────────────────────────

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ─── Form state type ──────────────────────────────────────────

interface FormState {
  tipo: 'root' | 'child';
  parentId: string;
  dimension: string;
  nombre: string;
  slug: string;
  icono: string;
  color: string;
  descripcion: string;
  keywords: string;
  orden: number;
}

function emptyForm(): FormState {
  return {
    tipo: 'root',
    parentId: '',
    dimension: '',
    nombre: '',
    slug: '',
    icono: '⛏️',
    color: '#6b7280',
    descripcion: '',
    keywords: '',
    orden: 0,
  };
}

// ─── Component ────────────────────────────────────────────────

export function ClasificadoresView() {
  const [ejes, setEjes] = useState<EjeItem[]>([]);
  const [ejesLoading, setEjesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [dimensionFilter, setDimensionFilter] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());

  // Add form state
  const [form, setForm] = useState<FormState>(emptyForm());

  const fetchEjes = useCallback(async () => {
    setEjesLoading(true);
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set('all', 'true');
      if (dimensionFilter) params.set('dimension', dimensionFilter);
      const res = await fetch(`/api/ejes?${params.toString()}`);
      const json = await res.json();
      setEjes(json.ejes || []);
    } catch { /* silent */ }
    finally { setEjesLoading(false); }
  }, [showInactive, dimensionFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setEjesLoading(true);
      try {
        const params = new URLSearchParams();
        if (showInactive) params.set('all', 'true');
        if (dimensionFilter) params.set('dimension', dimensionFilter);
        const res = await fetch(`/api/ejes?${params.toString()}`);
        const json = await res.json();
        if (!cancelled) setEjes(json.ejes || []);
      } catch { /* silent */ }
      finally { if (!cancelled) setEjesLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [showInactive, dimensionFilter]);

  // Auto-generate slug from nombre (for add form)
  const handleNombreChange = (val: string, isEdit: boolean) => {
    const targetForm = isEdit ? editForm : form;
    const setTargetForm = isEdit ? setEditForm : setForm;

    setTargetForm({ ...targetForm, nombre: val });
    const currentSlug = isEdit ? editForm.slug : form.slug;
    if (!currentSlug || currentSlug === generateSlug(isEdit ? editForm.nombre : form.nombre)) {
      setTargetForm({ ...targetForm, slug: generateSlug(val) });
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setFormError('');
  };

  // ─── Create ─────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setFormError('Nombre requerido'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch('/api/ejes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          slug: form.slug.trim() || generateSlug(form.nombre),
          parentId: form.tipo === 'child' ? form.parentId : null,
          dimension: form.tipo === 'child' ? form.dimension : '',
          icono: form.icono,
          color: form.color,
          descripcion: form.descripcion,
          keywords: form.keywords,
          orden: form.orden,
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

  // ─── Edit ───────────────────────────────────────────────────

  const startEdit = (eje: EjeItem) => {
    setEditingId(eje.id);
    setEditForm({
      tipo: eje.parentId ? 'child' : 'root',
      parentId: eje.parentId || '',
      dimension: eje.dimension || '',
      nombre: eje.nombre,
      slug: eje.slug,
      icono: eje.icono,
      color: eje.color,
      descripcion: eje.descripcion,
      keywords: eje.keywords,
      orden: eje.orden,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm());
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.nombre.trim() || !editingId) return;
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch(`/api/ejes?id=${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editForm.nombre.trim(),
          slug: editForm.slug.trim(),
          parentId: editForm.tipo === 'child' ? editForm.parentId : null,
          dimension: editForm.tipo === 'child' ? editForm.dimension : '',
          icono: editForm.icono,
          color: editForm.color,
          descripcion: editForm.descripcion,
          keywords: editForm.keywords,
          orden: editForm.orden,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al editar');
      cancelEdit();
      await fetchEjes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error');
    } finally { setFormLoading(false); }
  };

  // ─── Toggle & Delete ────────────────────────────────────────

  const handleToggle = async (id: string, activo: boolean) => {
    try {
      const res = await fetch(`/api/ejes?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !activo }),
      });
      if (!res.ok) throw new Error();
      await fetchEjes();
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ejes?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await fetchEjes();
    } catch { /* silent */ }
    setDeleteId(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Counts ─────────────────────────────────────────────────

  const allEjes = ejes.flatMap((e) => [e, ...(e.children || [])]);
  const activeCount = allEjes.filter((e) => e.activo).length;
  const inactiveCount = allEjes.filter((e) => !e.activo).length;

  // Root ejes for parent selector
  const rootEjes = ejes.map((e) => ({ id: e.id, nombre: e.nombre }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Ejes Temáticos
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {activeCount} habilitados{inactiveCount > 0 && ` · ${inactiveCount} deshabilitados`}
                {' · '}{allEjes.length} elementos en total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant={showInactive ? 'secondary' : 'ghost'}
                onClick={() => setShowInactive(!showInactive)}
                className="text-xs gap-1.5"
                title={showInactive ? 'Ocultar deshabilitados' : 'Mostrar todos'}
              >
                {showInactive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {showInactive ? 'Todos' : 'Activos'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { resetForm(); setShowForm(!showForm); }}
                className="text-xs gap-1.5"
              >
                {showForm ? <ChevronUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showForm ? 'Cerrar' : 'Añadir'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Dimension filter bar */}
          <div className="flex flex-wrap gap-1.5">
            {DIMENSIONS.map((dim) => (
              <button
                key={dim.key || '_all'}
                onClick={() => setDimensionFilter(dim.key)}
                className={`
                  text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium
                  ${dimensionFilter === dim.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }
                `}
              >
                {dim.emoji && <span className="mr-1">{dim.emoji}</span>}
                {dim.label}
              </button>
            ))}
          </div>

          {/* Add form */}
          {showForm && (
            <EjeForm
              form={form}
              setForm={setForm}
              isEdit={false}
              rootEjes={rootEjes}
              formError={formError}
              formLoading={formLoading}
              onSubmit={handleSubmit}
              onCancel={() => { setShowForm(false); resetForm(); }}
              onNombreChange={(val) => handleNombreChange(val, false)}
            />
          )}

          {/* Ejes hierarchy */}
          {ejesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : ejes.length > 0 ? (
            <div className="space-y-3">
              {ejes.map((eje) => (
                <div key={eje.id} className="space-y-2">
                  {/* Root eje card */}
                  {editingId === eje.id ? (
                    <EjeForm
                      form={editForm}
                      setForm={setEditForm}
                      isEdit={true}
                      rootEjes={rootEjes.filter((r) => r.id !== eje.id)}
                      formError={formError}
                      formLoading={formLoading}
                      onSubmit={handleEditSubmit}
                      onCancel={cancelEdit}
                      onNombreChange={(val) => handleNombreChange(val, true)}
                    />
                  ) : (
                    <RootCard
                      eje={eje}
                      deleteId={deleteId}
                      setDeleteId={setDeleteId}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onEdit={startEdit}
                      onExpand={toggleExpand}
                      isExpanded={expandedParents.has(eje.id)}
                    />
                  )}

                  {/* Children */}
                  {eje.children && eje.children.length > 0 && expandedParents.has(eje.id) && (
                    <div className="ml-6 border-l-2 border-primary/10 pl-4 space-y-2">
                      {eje.children.map((child) => (
                        editingId === child.id ? (
                          <EjeForm
                            key={child.id}
                            form={editForm}
                            setForm={setEditForm}
                            isEdit={true}
                            rootEjes={rootEjes}
                            formError={formError}
                            formLoading={formLoading}
                            onSubmit={handleEditSubmit}
                            onCancel={cancelEdit}
                            onNombreChange={(val) => handleNombreChange(val, true)}
                          />
                        ) : (
                          <ChildCard
                            key={child.id}
                            eje={child}
                            deleteId={deleteId}
                            setDeleteId={setDeleteId}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            onEdit={startEdit}
                          />
                        )
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Tag className="h-10 w-10" />} text="No hay ejes temáticos registrados" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Root Card ────────────────────────────────────────────────

function RootCard({
  eje, deleteId, setDeleteId, onToggle, onDelete, onEdit, onExpand, isExpanded,
}: {
  eje: EjeItem;
  deleteId: string | null;
  setDeleteId: (id: string | null) => void;
  onToggle: (id: string, activo: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (eje: EjeItem) => void;
  onExpand: (id: string) => void;
  isExpanded: boolean;
}) {
  const childCount = eje.children?.length || 0;
  const activeChildCount = eje.children?.filter((c) => c.activo).length || 0;

  return (
    <div
      className={`
        p-4 rounded-lg border transition-colors group relative
        ${eje.activo
          ? 'border-border hover:border-primary/30 bg-card'
          : 'border-dashed border-muted-foreground/30 bg-muted/20 opacity-60'
        }
      `}
    >
      {/* Status badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {childCount > 0 && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
            onClick={() => onExpand(eje.id)}
          >
            {activeChildCount}/{childCount} sub
          </span>
        )}
        <span
          className={`
            inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full
            ${eje.activo
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
            }
          `}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${eje.activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {eje.activo ? 'Habilitado' : 'Deshabilitado'}
        </span>
      </div>

      {/* Card content */}
      <div className="flex items-start gap-2 pr-36">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {childCount > 0 && (
              <button
                onClick={() => onExpand(eje.id)}
                className="p-0.5 rounded hover:bg-muted transition-transform"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {eje.icono && <span className="text-sm shrink-0">{eje.icono}</span>}
            {eje.color && (
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: eje.color }} />
            )}
            <p className={`text-sm font-semibold truncate ${eje.activo ? 'text-foreground' : 'text-muted-foreground'}`}>
              {eje.nombre}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{eje.descripcion || eje.slug}</p>
        </div>
      </div>

      {/* Keywords */}
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

      {/* Bottom actions */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
          {eje.mencionesCount} menciones
        </Badge>
        <div className="flex items-center gap-1">
          {deleteId === eje.id ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(eje.id)} className="text-[10px] text-red-500 hover:underline font-medium">Sí</button>
              <button onClick={() => setDeleteId(null)} className="text-[10px] text-muted-foreground hover:underline">No</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onEdit(eje)}
                className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-blue-500" />
              </button>
              <button
                onClick={() => onToggle(eje.id, eje.activo)}
                className={`p-1 rounded transition-colors ${eje.activo
                  ? 'hover:bg-amber-50 dark:hover:bg-amber-950/30 opacity-0 group-hover:opacity-100'
                  : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
                title={eje.activo ? 'Deshabilitar' : 'Habilitar'}
              >
                {eje.activo
                  ? <Power className="h-3.5 w-3.5 text-muted-foreground hover:text-amber-500" />
                  : <RotateCcw className="h-3.5 w-3.5 text-muted-foreground hover:text-emerald-500" />
                }
              </button>
              {eje.activo && (
                <button
                  onClick={() => setDeleteId(eje.id)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Desactivar"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Child Card ───────────────────────────────────────────────

function ChildCard({
  eje, deleteId, setDeleteId, onToggle, onDelete, onEdit,
}: {
  eje: EjeItem;
  deleteId: string | null;
  setDeleteId: (id: string | null) => void;
  onToggle: (id: string, activo: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (eje: EjeItem) => void;
}) {
  return (
    <div
      className={`
        p-3 rounded-lg border transition-colors group
        ${eje.activo
          ? 'border-border hover:border-primary/30 bg-card'
          : 'border-dashed border-muted-foreground/30 bg-muted/20 opacity-60'
        }
      `}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {eje.icono && <span className="text-xs shrink-0">{eje.icono}</span>}
            {eje.color && (
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: eje.color }} />
            )}
            <p className={`text-xs font-semibold ${eje.activo ? 'text-foreground' : 'text-muted-foreground'}`}>
              {eje.nombre}
            </p>
            {/* Dimension badge */}
            {eje.dimension && DIMENSION_LABEL[eje.dimension] && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DIMENSION_BADGE[eje.dimension] || ''}`}>
                {DIMENSION_LABEL[eje.dimension]}
              </span>
            )}
            {/* Status dot */}
            <span
              className={`
                inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full
                ${eje.activo
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                }
              `}
            >
              <span className={`h-1 w-1 rounded-full mr-1 ${eje.activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {eje.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          {eje.descripcion && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{eje.descripcion}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {deleteId === eje.id ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(eje.id)} className="text-[10px] text-red-500 hover:underline font-medium">Sí</button>
              <button onClick={() => setDeleteId(null)} className="text-[10px] text-muted-foreground hover:underline">No</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onEdit(eje)}
                className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Editar"
              >
                <Pencil className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
              </button>
              <button
                onClick={() => onToggle(eje.id, eje.activo)}
                className={`p-1 rounded transition-colors ${eje.activo
                  ? 'hover:bg-amber-50 dark:hover:bg-amber-950/30 opacity-0 group-hover:opacity-100'
                  : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
                title={eje.activo ? 'Deshabilitar' : 'Habilitar'}
              >
                {eje.activo
                  ? <Power className="h-3 w-3 text-muted-foreground hover:text-amber-500" />
                  : <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-emerald-500" />
                }
              </button>
              {eje.activo && (
                <button
                  onClick={() => setDeleteId(eje.id)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Desactivar"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom: mention count + keywords preview */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          {eje.keywords && eje.keywords.split(',').slice(0, 3).map((kw, i) => (
            <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
              {kw.trim()}
            </span>
          ))}
        </div>
        <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary h-5">
          {eje.mencionesCount}
        </Badge>
      </div>
    </div>
  );
}

// ─── Inline Form ──────────────────────────────────────────────

function EjeForm({
  form, setForm, isEdit, rootEjes, formError, formLoading, onSubmit, onCancel, onNombreChange,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  isEdit: boolean;
  rootEjes: Array<{ id: string; nombre: string }>;
  formError: string;
  formLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onNombreChange: (val: string) => void;
}) {
  const isChild = form.tipo === 'child';

  return (
    <form
      onSubmit={onSubmit}
      className="p-4 rounded-lg border border-primary/20 bg-muted/30 space-y-3"
    >
      <p className="text-xs font-semibold text-foreground">
        {isEdit ? 'Editar eje' : (isChild ? 'Nuevo sub-clasificador' : 'Nuevo eje temático')}
      </p>
      {formError && <p className="text-xs text-red-500">{formError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Tipo select (only for add) */}
        {!isEdit && (
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as 'root' | 'child' })}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
            >
              <option value="root">Eje Temático</option>
              <option value="child">Sub-clasificador</option>
            </select>
          </div>
        )}

        {/* Parent select (only for child) */}
        {isChild && rootEjes.length > 0 && (
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Eje padre *</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
              required
            >
              <option value="">— Seleccionar —</option>
              {rootEjes.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dimension (only for child) */}
        {isChild && (
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Dimensión</label>
            <select
              value={form.dimension}
              onChange={(e) => setForm({ ...form, dimension: e.target.value })}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
            >
              <option value="">— Sin dimensión —</option>
              <option value="produccion">🟢 Producción</option>
              <option value="precio">💰 Precio</option>
              <option value="conflicto">🔴 Conflicto</option>
              <option value="regulacion">🔵 Regulación</option>
              <option value="infraestructura">⚪ Infraestructura</option>
            </select>
          </div>
        )}

        {/* Nombre */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Nombre *</label>
          <Input
            value={form.nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            placeholder="Ej: Gasolina / Diésel"
            className="h-8 text-xs"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Slug</label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="gasolina-diesel"
            className="h-8 text-xs"
          />
        </div>

        {/* Icono */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Icono</label>
          <Input
            value={form.icono}
            onChange={(e) => setForm({ ...form, icono: e.target.value })}
            placeholder="⛏️"
            className="h-8 text-xs w-24"
          />
        </div>

        {/* Color */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-8 w-10 rounded cursor-pointer border border-border"
            />
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-8 text-xs w-28"
            />
          </div>
        </div>

        {/* Orden */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Orden</label>
          <Input
            type="number"
            value={form.orden}
            onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
            className="h-8 text-xs w-20"
          />
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="text-[11px] text-muted-foreground mb-1 block">Descripción</label>
        <textarea
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          placeholder="Descripción..."
          className="w-full min-h-[50px] px-3 py-2 text-xs rounded-md border border-border bg-background resize-y"
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="text-[11px] text-muted-foreground mb-1 block">Keywords (separadas por coma)</label>
        <Input
          value={form.keywords}
          onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          placeholder="gasolina,diésel,precio"
          className="h-8 text-xs"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={formLoading} className="text-xs">
          {formLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {isEdit ? 'Guardar cambios' : (isChild ? 'Crear sub-clasificador' : 'Crear eje temático')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">Cancelar</Button>
      </div>
    </form>
  );
}
