'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileCheck, Plus, Pencil, Trash2, X, DollarSign } from 'lucide-react';
import { EmptyState } from '@/components/shared/KPICard';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ─── Types ──────────────────────────────────────────────────────

interface ContratoItem {
  id: string;
  clienteId: string;
  tipoProducto: string;
  frecuencia: string;
  formatoEntrega: string;
  fechaInicio: string;
  fechaFin: string | null;
  montoMensual: number;
  moneda: string;
  estado: string;
  notas: string;
  fechaCreacion: string;
  cliente: { id: string; nombre: string; email: string; plan: string } | null;
}

interface ClienteOption {
  id: string;
  nombre: string;
  email: string;
  organizacion: string;
}

interface FormData {
  clienteId: string;
  productos: string[];
  montoMensual: string;
  frecuencia: string;
  formatoEntrega: string;
  fechaInicio: string;
  fechaFin: string;
  moneda: string;
  estado: string;
  notas: string;
}

// ─── Constants ──────────────────────────────────────────────────

const BASE_PRICES: Record<string, number> = {
  EL_TERMOMETRO: 400,
  SALDO_DEL_DIA: 400,
  EL_FOCO: 500,
  EL_INFORME_CERRADO: 500,
  EL_ESPECIALIZADO: 800,
  ALERTA_TEMPRANA: 1500,
  FICHA_LEGISLADOR: 200,
  EL_RADAR: 0,
  VOZ_Y_VOTO: 0,
  EL_HILO: 0,
  FOCO_DE_LA_SEMANA: 0,
};

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'activo', label: 'Activo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
];

const ESTADO_STYLES: Record<string, string> = {
  activo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pausado: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  vencido: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const CANAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'ambos', label: 'Ambos (WhatsApp + Email)' },
  { value: 'pdf', label: 'PDF' },
];

const FRECUENCIA_OPTIONS = Object.entries(FRECUENCIA_LABELS).map(([value, label]) => ({ value, label }));

const MONEDA_OPTIONS = [
  { value: 'Bs', label: 'Bolivianos (Bs)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

const ESTADO_FORM_OPTIONS = [
  { value: 'activo', label: 'Activo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
];

const EMPTY_FORM: FormData = {
  clienteId: '',
  productos: [],
  montoMensual: '',
  frecuencia: 'diario',
  formatoEntrega: 'whatsapp',
  fechaInicio: '',
  fechaFin: '',
  moneda: 'Bs',
  estado: 'activo',
  notas: '',
};

// Build grouped products map for the select
const PRODUCTS_BY_CATEGORY = PRODUCT_CATEGORIES.map((cat) => ({
  ...cat,
  productos: ALL_PRODUCTS.filter((p) => p.categoria === cat.id),
})).filter((g) => g.productos.length > 0);

// ─── Component ──────────────────────────────────────────────────

export function ContratosView() {
  // Data state
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientesLoading, setClientesLoading] = useState(false);

  // Filter state
  const [filterEstado, setFilterEstado] = useState('');
  const [filterCliente, setFilterCliente] = useState('');

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Refs for abort & debounce
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch clientes (once on mount) ────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setClientesLoading(true);
      try {
        const res = await fetch('/api/clientes?limit=100', { signal: controller.signal });
        const json = await res.json();
        if (!controller.signal.aborted) {
          const list = json.clientes || json || [];
          setClientes(Array.isArray(list) ? list : []);
        }
      } catch {
        // aborted or error — silent
      } finally {
        if (!controller.signal.aborted) setClientesLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // ─── Fetch contratos (debounced on filter changes) ─────────────
  const fetchContratos = useCallback(async (estado: string, clienteId: string, signal: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (estado) params.set('estado', estado);
      if (clienteId) params.set('clienteId', clienteId);
      const res = await fetch(`/api/contratos?${params.toString()}`, { signal });
      const json = await res.json();
      if (!signal.aborted) {
        setContratos(json.contratos || []);
        setTotal(json.total || 0);
      }
    } catch {
      // aborted or error — silent
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetchContratos(filterEstado, filterCliente, controller.signal);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filterEstado, filterCliente, fetchContratos]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────
  const getProductInfo = (tipo: string) => ALL_PRODUCTS.find((p) => p.tipo === tipo);
  const getBasePrice = (tipo: string) => BASE_PRICES[tipo] ?? 0;
  const getCanalLabel = (val: string) => CANAL_LABELS[val] || val;
  const getFrecuenciaLabel = (val: string) => FRECUENCIA_LABELS[val] || val;

  const getCombinedBasePrice = (productos: string[]) =>
    productos.reduce((sum, tipo) => sum + getBasePrice(tipo), 0);

  const isCustomPrice = (productos: string[], monto: number) => {
    const base = getCombinedBasePrice(productos);
    if (base === 0 && monto === 0) return false;
    if (base === 0 && monto > 0) return true;
    return base > 0 && monto !== base;
  };

  // ─── Form handlers ──────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, fechaInicio: new Date().toISOString().split('T')[0] });
    setSelectedProduct('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (c: ContratoItem) => {
    setEditingId(c.id);
    // Parsear productos: puede ser JSON array o string simple (compatibilidad)
    let productosList: string[] = [];
    try {
      const parsed = JSON.parse(c.tipoProducto || '[]');
      productosList = Array.isArray(parsed) ? parsed : (c.tipoProducto ? [c.tipoProducto] : []);
    } catch {
      productosList = c.tipoProducto ? [c.tipoProducto] : [];
    }
    setForm({
      clienteId: c.clienteId,
      productos: productosList,
      montoMensual: c.montoMensual > 0 ? String(c.montoMensual) : '',
      frecuencia: c.frecuencia || 'diario',
      formatoEntrega: c.formatoEntrega || 'whatsapp',
      fechaInicio: c.fechaInicio ? c.fechaInicio.split('T')[0] : '',
      fechaFin: c.fechaFin ? c.fechaFin.split('T')[0] : '',
      moneda: c.moneda || 'Bs',
      estado: c.estado || 'activo',
      notas: c.notas || '',
    });
    setSelectedProduct('');
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  // Multi-product selector state
  const [selectedProduct, setSelectedProduct] = useState('');

  const addProduct = () => {
    if (!selectedProduct || form.productos.includes(selectedProduct)) return;
    const newProductos = [...form.productos, selectedProduct];
    const base = getCombinedBasePrice(newProductos);
    setForm((prev) => ({
      ...prev,
      productos: newProductos,
      montoMensual: base > 0 ? String(base) : prev.montoMensual,
    }));
    setSelectedProduct('');
  };

  const removeProduct = (tipo: string) => {
    const newProductos = form.productos.filter((p) => p !== tipo);
    const base = getCombinedBasePrice(newProductos);
    setForm((prev) => ({
      ...prev,
      productos: newProductos,
      montoMensual: base > 0 ? String(base) : prev.montoMensual,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId || form.productos.length === 0 || !form.fechaInicio) {
      setFormError('Cliente, al menos un producto y fecha de inicio son obligatorios');
      return;
    }

    setSubmitting(true);
    setFormError('');

    const body = {
      clienteId: form.clienteId,
      tipoProducto: form.productos,
      frecuencia: form.frecuencia,
      formatoEntrega: form.formatoEntrega,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin || null,
      montoMensual: parseFloat(form.montoMensual) || 0,
      moneda: form.moneda,
      estado: form.estado,
      notas: form.notas,
    };

    try {
      const url = editingId ? `/api/contratos/${editingId}` : '/api/contratos';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || 'Error al guardar el contrato');
        return;
      }

      closeForm();
      // Refresh list
      const controller = new AbortController();
      abortRef.current = controller;
      await fetchContratos(filterEstado, filterCliente, controller.signal);
    } catch {
      setFormError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contratos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setFormError('Error al eliminar el contrato');
        return;
      }
      setDeleteConfirm(null);
      // Refresh
      const controller = new AbortController();
      abortRef.current = controller;
      await fetchContratos(filterEstado, filterCliente, controller.signal);
    } catch {
      setFormError('Error de conexión al eliminar');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Render ─────────────────────────────────────────────────────
  const formTitle = editingId ? 'Editar contrato' : 'Nuevo contrato';
  const basePriceLabel = getCombinedBasePrice(form.productos);
  const currentPrice = parseFloat(form.montoMensual) || 0;
  const priceIsCustom = form.productos.length > 0 ? isCustomPrice(form.productos, currentPrice) : false;
  // Productos disponibles (no ya seleccionados)
  const availableProducts = PRODUCTS_BY_CATEGORY.map((g) => ({
    ...g,
    productos: g.productos.filter((p) => !form.productos.includes(p.tipo)),
  })).filter((g) => g.productos.length > 0);

  return (
    <div className="space-y-4">
      {/* ─── Header Card ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <FileCheck className="h-4.5 w-4.5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Contratos
                  <Badge variant="secondary" className="text-[10px] font-normal px-1.5">
                    {total}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Gestión de contratos y productos ONION200
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={openCreate}
              size="sm"
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo contrato
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* ─── Filters ────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Estado
              </label>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ESTADO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-[2] min-w-0">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Cliente
              </label>
              <select
                value={filterCliente}
                onChange={(e) => setFilterCliente(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={clientesLoading}
              >
                <option value="">Todos los clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.organizacion ? ` — ${c.organizacion}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {(filterEstado || filterCliente) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFilterEstado(''); setFilterCliente(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Create / Edit Form ─────────────────────────────── */}
      {formOpen && (
        <Card className="border-emerald-200 dark:border-emerald-800/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {editingId ? (
                  <Pencil className="h-4 w-4 text-amber-500" />
                ) : (
                  <Plus className="h-4 w-4 text-emerald-500" />
                )}
                {formTitle}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={closeForm} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">
                  {formError}
                </div>
              )}

              {/* Row: Cliente + Producto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.clienteId}
                    onChange={(e) => updateField('clienteId', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  >
                    <option value="">Seleccionar cliente…</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.email ? `<${c.email}>` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector de productos (multi) */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Productos <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Agregar producto…</option>
                      {availableProducts.map((group) => (
                        <optgroup key={group.id} label={group.label}>
                          {group.productos.map((p) => (
                            <option key={p.tipo} value={p.tipo}>
                              {p.nombre}
                              {p.estado === 'definido' ? ' (próximamente)' : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addProduct}
                      disabled={!selectedProduct}
                      className="h-9 px-3 text-xs shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Añadir
                    </Button>
                  </div>
                  {form.productos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.productos.map((tipo) => {
                        const pInfo = getProductInfo(tipo);
                        return (
                          <Badge
                            key={tipo}
                            variant="secondary"
                            className="text-[10px] font-medium gap-1 pl-2 pr-1 py-1"
                            style={pInfo ? {
                              backgroundColor: `${pInfo.color}18`,
                              color: pInfo.color,
                              borderColor: `${pInfo.color}40`,
                              borderWidth: 1,
                            } : undefined}
                          >
                            {pInfo?.nombre || tipo.replace(/_/g, ' ')}
                            <button
                              type="button"
                              onClick={() => removeProduct(tipo)}
                              className="ml-0.5 h-3.5 w-3.5 rounded-full inline-flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {form.productos.length === 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">Selecciona al menos un producto</p>
                  )}
                </div>
              </div>

              {/* Row: Precio + Moneda */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Precio mensual
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.montoMensual}
                      onChange={(e) => updateField('montoMensual', e.target.value)}
                      placeholder="0.00"
                      className="h-9 pl-8 pr-3 text-xs"
                    />
                    {form.productos.length > 0 && basePriceLabel > 0 && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                        Catálogo: {form.moneda} {basePriceLabel}
                      </span>
                    )}
                  </div>
                  {priceIsCustom && form.montoMensual && (
                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <DollarSign className="h-2.5 w-2.5" />
                      Precio personalizado (catálogo: {form.moneda} {basePriceLabel})
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Moneda
                  </label>
                  <select
                    value={form.moneda}
                    onChange={(e) => updateField('moneda', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {MONEDA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Frecuencia + Canal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Frecuencia
                  </label>
                  <select
                    value={form.frecuencia}
                    onChange={(e) => updateField('frecuencia', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {FRECUENCIA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Canal de entrega
                  </label>
                  <select
                    value={form.formatoEntrega}
                    onChange={(e) => updateField('formatoEntrega', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {CANAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Fecha inicio + Fecha fin + Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Fecha inicio <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => updateField('fechaInicio', e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Fecha fin
                  </label>
                  <Input
                    type="date"
                    value={form.fechaFin}
                    onChange={(e) => updateField('fechaFin', e.target.value)}
                    min={form.fechaInicio}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Estado
                  </label>
                  <select
                    value={form.estado}
                    onChange={(e) => updateField('estado', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ESTADO_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                  Notas
                </label>
                <textarea
                  value={form.notas}
                  onChange={(e) => updateField('notas', e.target.value)}
                  placeholder="Notas internas del contrato…"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={closeForm} className="text-xs">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : editingId ? (
                    <Pencil className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {editingId ? 'Guardar cambios' : 'Crear contrato'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Contract List ───────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-xs mt-2">Cargando contratos…</p>
            </div>
          ) : contratos.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                        Producto
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                        Cliente
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                        Estado
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                        Precio
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground hidden lg:table-cell">
                        Frecuencia
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground hidden lg:table-cell">
                        Canal
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground hidden xl:table-cell">
                        Inicio
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground text-right">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratos.map((c) => {
                      // Parsear productos: JSON array (nuevo) o string simple (compatibilidad)
                      let cProductos: string[] = [];
                      try {
                        const parsed = JSON.parse(c.tipoProducto || '[]');
                        cProductos = Array.isArray(parsed) ? parsed : (c.tipoProducto ? [c.tipoProducto] : []);
                      } catch {
                        cProductos = c.tipoProducto ? [c.tipoProducto] : [];
                      }
                      const custom = isCustomPrice(cProductos, c.montoMensual);
                      const isDeleting = deleteConfirm === c.id;

                      return (
                        <TableRow key={c.id}>
                          {/* Productos */}
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {cProductos.map((tipo) => {
                                const pInfo = getProductInfo(tipo);
                                return pInfo ? (
                                  <Badge
                                    key={tipo}
                                    variant="secondary"
                                    className="text-[10px] font-medium gap-1"
                                    style={{
                                      backgroundColor: `${pInfo.color}18`,
                                      color: pInfo.color,
                                      borderColor: `${pInfo.color}40`,
                                      borderWidth: 1,
                                    }}
                                  >
                                    {pInfo.nombre}
                                  </Badge>
                                ) : (
                                  <Badge key={tipo} variant="secondary" className="text-[10px]">
                                    {tipo.replace(/_/g, ' ')}
                                  </Badge>
                                );
                              })}
                              {custom && (
                                <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 px-1 py-0">
                                  personalizado
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Cliente */}
                          <TableCell className="py-2.5">
                            <p className="text-xs font-medium text-foreground leading-tight">
                              {c.cliente?.nombre || '—'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {c.cliente?.email || ''}
                            </p>
                          </TableCell>

                          {/* Estado */}
                          <TableCell className="py-2.5">
                            <span
                              className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                ESTADO_STYLES[c.estado] || ESTADO_STYLES.activo
                              }`}
                            >
                              {c.estado}
                            </span>
                          </TableCell>

                          {/* Precio */}
                          <TableCell className="py-2.5">
                            <span className="text-xs font-semibold text-foreground">
                              {c.montoMensual > 0
                                ? `${Number(c.montoMensual).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${c.moneda || 'Bs'}`
                                : '—'}
                            </span>
                          </TableCell>

                          {/* Frecuencia */}
                          <TableCell className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                            {getFrecuenciaLabel(c.frecuencia)}
                          </TableCell>

                          {/* Canal */}
                          <TableCell className="py-2.5 hidden lg:table-cell">
                            <Badge variant="outline" className="text-[10px]">
                              {getCanalLabel(c.formatoEntrega)}
                            </Badge>
                          </TableCell>

                          {/* Inicio */}
                          <TableCell className="py-2.5 text-xs text-muted-foreground hidden xl:table-cell">
                            {c.fechaInicio ? new Date(c.fechaInicio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="py-2.5 text-right">
                            {isDeleting ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[10px] text-red-500 mr-1">¿Eliminar?</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(c.id)}
                                  disabled={submitting}
                                  className="h-7 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sí'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirm(null)}
                                  className="h-7 px-2 text-[10px] text-muted-foreground"
                                >
                                  No
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(c)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirm(c.id)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                {contratos.map((c) => {
                  // Parsear productos: JSON array (nuevo) o string simple (compatibilidad)
                  let cProductos: string[] = [];
                  try {
                    const parsed = JSON.parse(c.tipoProducto || '[]');
                    cProductos = Array.isArray(parsed) ? parsed : (c.tipoProducto ? [c.tipoProducto] : []);
                  } catch {
                    cProductos = c.tipoProducto ? [c.tipoProducto] : [];
                  }
                  const custom = isCustomPrice(cProductos, c.montoMensual);
                  const isDeleting = deleteConfirm === c.id;

                  return (
                    <div
                      key={c.id}
                      className="rounded-lg border p-3 space-y-2.5"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {cProductos.map((tipo) => {
                            const pInfo = getProductInfo(tipo);
                            return pInfo ? (
                              <Badge
                                key={tipo}
                                variant="secondary"
                                className="text-[10px] font-medium gap-1"
                                style={{
                                  backgroundColor: `${pInfo.color}18`,
                                  color: pInfo.color,
                                  borderColor: `${pInfo.color}40`,
                                  borderWidth: 1,
                                }}
                              >
                                {pInfo.nombre}
                              </Badge>
                            ) : (
                              <Badge key={tipo} variant="secondary" className="text-[10px]">
                                {tipo.replace(/_/g, ' ')}
                              </Badge>
                            );
                          })}
                          {custom && (
                            <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 px-1 py-0">
                              personalizado
                            </Badge>
                          )}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              ESTADO_STYLES[c.estado] || ESTADO_STYLES.activo
                            }`}
                          >
                            {c.estado}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(c)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(c.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Client */}
                      <div>
                        <p className="text-xs font-medium text-foreground">{c.cliente?.nombre || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">{c.cliente?.email || ''}</p>
                      </div>

                      {/* Details */}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground text-xs">
                          {c.montoMensual > 0
                            ? `${Number(c.montoMensual).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${c.moneda || 'Bs'}`
                            : 'Sin precio'}
                        </span>
                        <span>{getFrecuenciaLabel(c.frecuencia)}</span>
                        <span>{getCanalLabel(c.formatoEntrega)}</span>
                        {c.fechaInicio && (
                          <span>
                            {new Date(c.fechaInicio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {/* Delete confirm (mobile) */}
                      {isDeleting && (
                        <div className="flex items-center gap-2 pt-1 border-t">
                          <span className="text-[10px] text-red-500">¿Eliminar este contrato?</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(c.id)}
                            disabled={submitting}
                            className="h-6 px-2 text-[10px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sí, eliminar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                            className="h-6 px-2 text-[10px] text-muted-foreground"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer info */}
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Mostrando {contratos.length} de {total} contratos
                </p>
                {!formOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openCreate}
                    className="text-[10px] gap-1 h-7"
                  >
                    <Plus className="h-3 w-3" />
                    Nuevo
                  </Button>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<FileCheck className="h-10 w-10" />}
              text="No hay contratos registrados"
              subtext={
                filterEstado || filterCliente
                  ? 'Intenta cambiar los filtros para ver más resultados'
                  : 'Crea el primer contrato para comenzar'
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
