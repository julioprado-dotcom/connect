'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, KPICard } from '@/components/shared/KPICard';
import {
  Users, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Search, Download, Mail, Shield, Loader2, UserPlus,
  CheckCircle2, XCircle,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface Suscriptor {
  id: string;
  nombre: string;
  email: string;
  whatsapp: string | null;
  origen: string;
  activo: boolean;
  fechaSuscripcion: string;
}

const ORIGEN_LABELS: Record<string, string> = {
  admin: 'Admin',
  landing: 'Landing',
  redes: 'Redes',
  referido: 'Referido',
  evento: 'Evento',
};

const ORIGEN_COLORS: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  landing: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  redes: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  referido: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  evento: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

/* ─── Component ────────────────────────────────────────── */

export function SuscriptoresView() {
  /* State */
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  /* Form state */
  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formOrigen, setFormOrigen] = useState('admin');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  /* Edit state */
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editOrigen, setEditOrigen] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Fetch suscriptores (for event handlers) ────── */
  const loadSuscriptores = useCallback(async (searchTerm: string) => {
    const controller = new AbortController();
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '200' });
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/suscriptores?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error('Fetch error');
      const json = await res.json();
      if (!controller.signal.aborted) {
        setSuscriptores(json.suscriptores || []);
        setTotal(json.total || 0);
      }
    } catch {
      // silent — abort or network error
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  /* Initial load + debounced search (single effect) */
  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;

    const doFetch = async (term: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: '1', limit: '200' });
        if (term) params.set('search', term);
        const res = await fetch(`/api/suscriptores?${params.toString()}`, { signal: ac.signal });
        if (!res.ok) throw new Error('Fetch error');
        const json = await res.json();
        if (!ac.signal.aborted) {
          setSuscriptores(json.suscriptores || []);
          setTotal(json.total || 0);
        }
      } catch {
        // silent
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    };

    doFetch(debouncedSearch);
    return () => { ac.abort(); };
  }, [debouncedSearch]);

  /* Debounced search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  /* ─── Computed stats ─────────────────────────────── */
  const activos = suscriptores.filter(s => s.activo).length;
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const captadosHoy = suscriptores.filter(s => new Date(s.fechaSuscripcion) >= todayStart).length;
  const captadosSemana = suscriptores.filter(s => new Date(s.fechaSuscripcion) >= startOfWeek).length;

  /* ─── Create suscriptor ──────────────────────────── */
  const handleCreate = async () => {
    if (!formEmail.trim()) {
      setFormError('El email es obligatorio');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      setFormError('Ingresa un email válido');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/suscriptores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre.trim(),
          email: formEmail.trim(),
          whatsapp: formWhatsapp.trim() || undefined,
          origen: formOrigen,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || 'Error al crear suscriptor');
        return;
      }
      // Reset form
      setFormNombre('');
      setFormEmail('');
      setFormWhatsapp('');
      setFormOrigen('admin');
      setShowForm(false);
      loadSuscriptores(debouncedSearch);
    } catch {
      setFormError('Error de conexión');
    } finally {
      setFormSubmitting(false);
    }
  };

  /* ─── Edit suscriptor ────────────────────────────── */
  const startEdit = (s: Suscriptor) => {
    setEditingId(s.id);
    setEditNombre(s.nombre);
    setEditEmail(s.email);
    setEditWhatsapp(s.whatsapp || '');
    setEditOrigen(s.origen);
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/suscriptores?id=${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editNombre.trim(),
          email: editEmail.trim(),
          whatsapp: editWhatsapp.trim() || null,
          origen: editOrigen,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Error al actualizar');
        return;
      }
      setEditingId(null);
      loadSuscriptores(debouncedSearch);
    } catch {
      alert('Error de conexión');
    } finally {
      setEditSubmitting(false);
    }
  };

  const toggleActivo = async (s: Suscriptor) => {
    try {
      const res = await fetch(`/api/suscriptores?id=${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !s.activo }),
      });
      if (res.ok) {
        loadSuscriptores(debouncedSearch);
      }
    } catch {
      // silent
    }
  };

  /* ─── Delete suscriptor ──────────────────────────── */
  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    try {
      const res = await fetch(`/api/suscriptores?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadSuscriptores(debouncedSearch);
      }
    } catch {
      // silent
    }
  };

  /* ─── CSV Export ─────────────────────────────────── */
  const exportCSV = () => {
    const active = suscriptores.filter(s => s.activo);
    if (active.length === 0) {
      alert('No hay suscriptores activos para exportar');
      return;
    }

    const headers = ['Nombre', 'Email', 'WhatsApp', 'Origen', 'Fecha Suscripción', 'Estado'];
    const rows = active.map(s => [
      s.nombre,
      s.email,
      s.whatsapp || '',
      ORIGEN_LABELS[s.origen] || s.origen,
      new Date(s.fechaSuscripcion).toLocaleDateString('es-BO'),
      s.activo ? 'Activo' : 'Inactivo',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suscriptores_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ─── Helpers ────────────────────────────────────── */
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  /* ─── Render ─────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Suscriptores Gratuitos
                <Badge variant="secondary" className="text-[10px]">{total}</Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Gestión de suscriptores de productos gratuitos
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs gap-1">
                <Download className="h-3 w-3" /> Exportar CSV
              </Button>
              <Button
                size="sm"
                onClick={() => setShowForm(f => !f)}
                className="text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Añadir suscriptor
                {showForm ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Create form (collapsible) */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Nuevo suscriptor</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                <Input
                  placeholder="Nombre completo"
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formEmail}
                  onChange={e => { setFormEmail(e.target.value); setFormError(''); }}
                  className={`h-9 text-xs ${formError ? 'border-destructive' : ''}`}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">WhatsApp</label>
                <Input
                  placeholder="+591 70000000"
                  value={formWhatsapp}
                  onChange={e => setFormWhatsapp(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Origen</label>
                <select
                  value={formOrigen}
                  onChange={e => setFormOrigen(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 dark:bg-input/30"
                >
                  {Object.entries(ORIGEN_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>No compartiremos sus datos con terceros. Sus datos están protegidos.</span>
            </div>

            {formError && (
              <p className="text-xs text-destructive mt-2">{formError}</p>
            )}

            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={handleCreate} disabled={formSubmitting} className="text-xs gap-1">
                {formSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Crear suscriptor
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          icon={<Users className="h-4 w-4" />}
          value={total}
          label="Total suscriptores"
          colorClass="text-slate-600 dark:text-slate-400"
        />
        <KPICard
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={activos}
          label="Activos"
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          icon={<Mail className="h-4 w-4" />}
          value={captadosHoy}
          label="Captados hoy"
          colorClass="text-amber-600 dark:text-amber-400"
        />
        <KPICard
          icon={<Users className="h-4 w-4" />}
          value={captadosSemana}
          label="Esta semana"
          colorClass="text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 text-xs pl-8"
              />
            </div>
            {debouncedSearch && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSearch('')}
                className="text-xs"
              >
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : suscriptores.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">WhatsApp</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Origen</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Fecha</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suscriptores.map(s => (
                    <TableRow key={s.id}>
                      {editingId === s.id ? (
                        /* ── Edit mode ── */
                        <>
                          <TableCell className="py-2">
                            <Input
                              value={editNombre}
                              onChange={e => setEditNombre(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Nombre"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input
                              type="email"
                              value={editEmail}
                              onChange={e => setEditEmail(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Email"
                            />
                          </TableCell>
                          <TableCell className="py-2 hidden md:table-cell">
                            <Input
                              value={editWhatsapp}
                              onChange={e => setEditWhatsapp(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="+591"
                            />
                          </TableCell>
                          <TableCell className="py-2 hidden sm:table-cell">
                            <select
                              value={editOrigen}
                              onChange={e => setEditOrigen(e.target.value)}
                              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs dark:bg-input/30"
                            >
                              {Object.entries(ORIGEN_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="py-2 hidden lg:table-cell" />
                          <TableCell className="py-2" />
                          <TableCell className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon-xs"
                                onClick={saveEdit}
                                disabled={editSubmitting}
                                title="Guardar"
                              >
                                {editSubmitting ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={cancelEdit}
                                title="Cancelar"
                              >
                                <XCircle className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        /* ── View mode ── */
                        <>
                          <TableCell className="py-2.5">
                            <span className="text-xs font-medium text-foreground">
                              {s.nombre || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-xs text-muted-foreground">{s.email}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                            {s.whatsapp || '—'}
                          </TableCell>
                          <TableCell className="py-2.5 hidden sm:table-cell">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ORIGEN_COLORS[s.origen] || 'bg-muted text-muted-foreground'}`}>
                              {ORIGEN_LABELS[s.origen] || s.origen}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                            {formatDate(s.fechaSuscripcion)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <button
                              onClick={() => toggleActivo(s)}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                                s.activo
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                                  : 'bg-stone-100 text-stone-500 dark:bg-stone-800/40 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800/60'
                              }`}
                              title={s.activo ? 'Desactivar' : 'Activar'}
                            >
                              {s.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            {deleteConfirmId === s.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[10px] text-destructive mr-1">¿Eliminar?</span>
                                <Button
                                  variant="destructive"
                                  size="icon-xs"
                                  onClick={() => handleDelete(s.id)}
                                  title="Confirmar"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setDeleteConfirmId(null)}
                                  title="Cancelar"
                                >
                                  <XCircle className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => startEdit(s)}
                                  title="Editar"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setDeleteConfirmId(s.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              text={debouncedSearch ? 'No se encontraron suscriptores' : 'No hay suscriptores registrados'}
              subtext={debouncedSearch ? 'Intenta con otro término de búsqueda' : 'Añade el primer suscriptor con el botón de arriba'}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
