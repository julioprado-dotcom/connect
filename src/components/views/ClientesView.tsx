'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserCircle, Plus, Pencil, Trash2, Search, X, Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/KPICard';
import type { PersonaListItem } from '@/types/dashboard';

/* ──────────────────── Label maps ──────────────────── */

const SEGMENTO_LABELS: Record<string, string> = {
  partido_politico: 'Partido Político',
  movimiento_social: 'Movimiento Social',
  ong: 'ONG',
  embajada: 'Embajada',
  legislador: 'Legislador',
  medio: 'Medio',
  academico: 'Académico',
  otro: 'Otro',
};

const PLAN_LABELS: Record<string, string> = {
  basico: 'Básico',
  avanzado: 'Avanzado',
  institucional: 'Institucional',
};

const ESTADO_COLORS: Record<string, string> = {
  activo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  suspendido: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

/* ──────────────────── Types ──────────────────── */

interface Cliente {
  id: string;
  nombre: string;
  nombreContacto: string;
  email: string;
  telefono: string;
  whatsapp: string;
  organizacion: string;
  segmento: string;
  plan: string;
  estado: string;
  parlamentariosCount: number;
  contratosActivos: number;
  notas: string;
  ci: string;
  razonSocial: string;
  nit: string;
}

type FormData = {
  nombre: string;
  nombreContacto: string;
  email: string;
  telefono: string;
  whatsapp: string;
  organizacion: string;
  segmento: string;
  plan: string;
  notas: string;
  ci: string;
  razonSocial: string;
  nit: string;
};

const EMPTY_FORM: FormData = {
  nombre: '',
  nombreContacto: '',
  email: '',
  telefono: '',
  whatsapp: '',
  organizacion: '',
  segmento: 'otro',
  plan: 'basico',
  notas: '',
  ci: '',
  razonSocial: '',
  nit: '',
};

/* ──────────────────── Component ──────────────────── */

export function ClientesView() {
  /* ── State ── */
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<FormData>({ ...EMPTY_FORM });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormData>({ ...EMPTY_FORM });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [personaList, setPersonaList] = useState<PersonaListItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  /* ── Debounced search ── */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Fetch clientes ── */
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const signal = ac.signal;

    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: '1', limit: '50' });
        if (debouncedSearch) params.set('search', debouncedSearch);
        const res = await fetch(`/api/clientes?${params}`, { signal });
        if (!res.ok) return;
        const json = await res.json();
        setClientes(json.clientes || []);
        setTotal(json.total || 0);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // silent
      } finally {
        setLoading(false);
      }
    })();

    return () => { ac.abort(); };
  }, [debouncedSearch]);

  /* ── Fetch parlamentarios ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/personas?page=1&limit=30');
        const json = await res.json();
        if (!cancelled) setPersonaList(json.personas || []);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Helpers ── */
  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/clientes?${params}`, { signal: ac.signal });
      if (!res.ok) return;
      const json = await res.json();
      setClientes(json.clientes || []);
      setTotal(json.total || 0);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // silent
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  const validate = (form: FormData): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!form.email.trim()) errors.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Email inválido';
    return errors;
  };

  /* ── Create ── */
  const handleCreate = async () => {
    const errors = validate(createForm);
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreating(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateErrors({ general: data.error || 'Error al crear cliente' });
        return;
      }
      setCreateForm({ ...EMPTY_FORM });
      setCreateErrors({});
      setShowCreateForm(false);
      refresh();
    } catch {
      setCreateErrors({ general: 'Error de conexión' });
    } finally {
      setCreating(false);
    }
  };

  /* ── Edit ── */
  const startEdit = (c: Cliente) => {
    setEditingId(c.id);
    setEditForm({
      nombre: c.nombre,
      nombreContacto: c.nombreContacto || '',
      email: c.email,
      telefono: c.telefono || '',
      whatsapp: c.whatsapp || '',
      organizacion: c.organizacion || '',
      segmento: c.segmento || 'otro',
      plan: c.plan || 'basico',
      notas: c.notas || '',
      ci: c.ci || '',
      razonSocial: c.razonSocial || '',
      nit: c.nit || '',
    });
    setEditErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ ...EMPTY_FORM });
    setEditErrors({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const errors = validate(editForm);
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditErrors({ general: data.error || 'Error al actualizar' });
        return;
      }
      setEditingId(null);
      setEditForm({ ...EMPTY_FORM });
      setEditErrors({});
      refresh();
    } catch {
      setEditErrors({ general: 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clientes/${deleteConfirmId}`, { method: 'DELETE' });
      if (!res.ok) return;
      setDeleteConfirmId(null);
      refresh();
    } catch { /* silent */ } finally {
      setDeleting(false);
    }
  };

  /* ──────────────────── Render ──────────────────── */

  return (
    <div className="space-y-4">
      {/* ── Header Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                Clientes
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] font-semibold tabular-nums">
                {total}
              </Badge>
            </div>
            <Button
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                setShowCreateForm((v) => !v);
                if (showCreateForm) { setCreateForm({ ...EMPTY_FORM }); setCreateErrors({}); }
              }}
            >
              {showCreateForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showCreateForm ? 'Cancelar' : 'Añadir cliente'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nombre, email u organización…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs sm:max-w-md"
            />
          </div>

          {/* ── Create form ── */}
          {showCreateForm && (
            <div className="rounded-lg border border-dashed border-primary/30 bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs font-semibold text-foreground">Nuevo cliente</p>
              {createErrors.general && (
                <p className="text-xs text-red-600">{createErrors.general}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Nombre *"
                  value={createForm.nombre}
                  error={createErrors.nombre}
                  onChange={(v) => setCreateForm((f) => ({ ...f, nombre: v }))}
                  placeholder="Nombre del cliente"
                />
                <Field
                  label="Contacto"
                  value={createForm.nombreContacto}
                  onChange={(v) => setCreateForm((f) => ({ ...f, nombreContacto: v }))}
                  placeholder="Persona de contacto"
                />
                <Field
                  label="Email *"
                  value={createForm.email}
                  error={createErrors.email}
                  onChange={(v) => setCreateForm((f) => ({ ...f, email: v }))}
                  placeholder="correo@ejemplo.com"
                  type="email"
                />
                <Field
                  label="Teléfono"
                  value={createForm.telefono}
                  onChange={(v) => setCreateForm((f) => ({ ...f, telefono: v }))}
                  placeholder="+591 70000000"
                />
                <Field
                  label="WhatsApp"
                  value={createForm.whatsapp}
                  onChange={(v) => setCreateForm((f) => ({ ...f, whatsapp: v }))}
                  placeholder="+591 70000000"
                />
                <Field
                  label="Organización"
                  value={createForm.organizacion}
                  onChange={(v) => setCreateForm((f) => ({ ...f, organizacion: v }))}
                  placeholder="Nombre de organización"
                />
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Segmento</label>
                  <select
                    value={createForm.segmento}
                    onChange={(e) => setCreateForm((f) => ({ ...f, segmento: e.target.value }))}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {Object.entries(SEGMENTO_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Plan</label>
                  <select
                    value={createForm.plan}
                    onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {Object.entries(PLAN_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datos de facturacion */}
              <div className="border-t border-border pt-3 mt-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Datos de facturación
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field
                    label="CI (Cédula de Identidad)"
                    value={createForm.ci}
                    onChange={(v) => setCreateForm((f) => ({ ...f, ci: v }))}
                    placeholder="Ej: 8901234"
                  />
                  <Field
                    label="Razón Social (factura)"
                    value={createForm.razonSocial}
                    onChange={(v) => setCreateForm((f) => ({ ...f, razonSocial: v }))}
                    placeholder="Nombre para la factura"
                  />
                  <Field
                    label="NIT"
                    value={createForm.nit}
                    onChange={(v) => setCreateForm((f) => ({ ...f, nit: v }))}
                    placeholder="Número de NIT"
                  />
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground">Notas</label>
                <textarea
                  value={createForm.notas}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notas: e.target.value }))}
                  placeholder="Notas adicionales…"
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" className="text-xs gap-1.5" onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="h-3 w-3 animate-spin" />}
                  Crear cliente
                </Button>
              </div>
            </div>
          )}

          {/* ── Client list ── */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clientes.length > 0 ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
              {clientes.map((c) =>
                editingId === c.id ? (
                  /* ── Inline edit row ── */
                  <div key={c.id} className="rounded-lg border border-primary/40 bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <Pencil className="h-3 w-3" /> Editando: {c.nombre}
                    </p>
                    {editErrors.general && (
                      <p className="text-xs text-red-600">{editErrors.general}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Nombre *"
                        value={editForm.nombre}
                        error={editErrors.nombre}
                        onChange={(v) => setEditForm((f) => ({ ...f, nombre: v }))}
                      />
                      <Field
                        label="Contacto"
                        value={editForm.nombreContacto}
                        onChange={(v) => setEditForm((f) => ({ ...f, nombreContacto: v }))}
                      />
                      <Field
                        label="Email *"
                        value={editForm.email}
                        error={editErrors.email}
                        onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
                        type="email"
                      />
                      <Field
                        label="Teléfono"
                        value={editForm.telefono}
                        onChange={(v) => setEditForm((f) => ({ ...f, telefono: v }))}
                      />
                      <Field
                        label="WhatsApp"
                        value={editForm.whatsapp}
                        onChange={(v) => setEditForm((f) => ({ ...f, whatsapp: v }))}
                      />
                      <Field
                        label="Organización"
                        value={editForm.organizacion}
                        onChange={(v) => setEditForm((f) => ({ ...f, organizacion: v }))}
                      />
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Segmento</label>
                        <select
                          value={editForm.segmento}
                          onChange={(e) => setEditForm((f) => ({ ...f, segmento: e.target.value }))}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {Object.entries(SEGMENTO_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Plan</label>
                        <select
                          value={editForm.plan}
                          onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {Object.entries(PLAN_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Datos de facturacion */}
                    <div className="border-t border-border pt-3">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Datos de facturación
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field
                          label="CI (Cédula de Identidad)"
                          value={editForm.ci}
                          onChange={(v) => setEditForm((f) => ({ ...f, ci: v }))}
                          placeholder="Ej: 8901234"
                        />
                        <Field
                          label="Razón Social (factura)"
                          value={editForm.razonSocial}
                          onChange={(v) => setEditForm((f) => ({ ...f, razonSocial: v }))}
                          placeholder="Nombre para la factura"
                        />
                        <Field
                          label="NIT"
                          value={editForm.nit}
                          onChange={(v) => setEditForm((f) => ({ ...f, nit: v }))}
                          placeholder="Número de NIT"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Notas</label>
                      <textarea
                        value={editForm.notas}
                        onChange={(e) => setEditForm((f) => ({ ...f, notas: e.target.value }))}
                        rows={2}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="text-xs" onClick={cancelEdit} disabled={saving}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="text-xs gap-1.5" onClick={handleSaveEdit} disabled={saving}>
                        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                        Guardar cambios
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Display row ── */
                  <div
                    key={c.id}
                    className="rounded-lg border border-border bg-card p-4 hover:border-primary/20 transition-colors group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate max-w-[220px]">
                            {c.nombre}
                          </p>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {PLAN_LABELS[c.plan] || c.plan}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {SEGMENTO_LABELS[c.segmento] || c.segmento}
                          </Badge>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${
                              ESTADO_COLORS[c.estado] || ESTADO_COLORS.activo
                            }`}
                          >
                            {c.estado}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.email}
                        </p>
                        {c.organizacion && (
                          <p className="text-[11px] text-muted-foreground">{c.organizacion}</p>
                        )}
                        {(c.ci || c.nit) && (
                          <p className="text-[11px] text-muted-foreground">
                            {c.ci && <span>CI: {c.ci}</span>}
                            {c.ci && c.nit && <span className="mx-1.5 text-border">|</span>}
                            {c.nit && <span>NIT: {c.nit}</span>}
                          </p>
                        )}
                        {c.razonSocial && (
                          <p className="text-[11px] text-muted-foreground">
                            Factura: {c.razonSocial}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                          <span>Contratos activos: <strong className="text-foreground">{c.contratosActivos}</strong></span>
                          <span>Parlamentarios: <strong className="text-foreground">{c.parlamentariosCount}</strong></span>
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {deleteConfirmId === c.id ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                            <span className="text-[11px] text-muted-foreground mr-1">¿Eliminar?</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-[11px] h-7 px-2.5"
                              onClick={handleDelete}
                              disabled={deleting}
                            >
                              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sí'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] h-7 px-2.5"
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={deleting}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(c)}
                              title="Editar cliente"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                              onClick={() => setDeleteConfirmId(c.id)}
                              title="Eliminar cliente"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyState
              icon={<UserCircle className="h-10 w-10" />}
              text={search ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              subtext={search ? 'Intenta con otro término de búsqueda' : 'Añade tu primer cliente con el botón de arriba'}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Parlamentarios disponibles (read-only) ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Parlamentarios disponibles para asignar
          </CardTitle>
          <CardDescription className="text-xs">
            Lista de legisladores que se pueden asignar a clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
            {personaList.length > 0 ? (
              personaList.slice(0, 30).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{p.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.camara} · {p.partidoSigla} · {p.departamento}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-4">
                <p className="text-xs text-muted-foreground">
                  No hay legisladores registrados
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ──────────────────── Sub-components ──────────────────── */

function Field({
  label,
  value,
  error,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
