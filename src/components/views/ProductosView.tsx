'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Package, CheckCircle2, FileBarChart, Mail, FileText, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { PRODUCTOS, COMBOS } from '@/constants/products';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';

// Tipos para el formulario de creacion
interface NuevoProducto {
  nombre: string;
  tipo: string;
  categoria: 'premium' | 'premium_mid' | 'premium_alta' | 'gratuito';
  frecuencia: string;
  canales: string[];
  longitudPaginas: number;
  longitudMinLectura: number;
  horarioEnvio: string;
  descripcion: string;
  ejesTematicos: string[];
  indicadores: string[];
  ventana: string;
  activo: boolean;
}

const FORM_DEFAULTS: NuevoProducto = {
  nombre: '',
  tipo: '',
  categoria: 'premium',
  frecuencia: 'diario',
  canales: ['whatsapp'],
  longitudPaginas: 5,
  longitudMinLectura: 8,
  horarioEnvio: '08:00 AM',
  descripcion: '',
  ejesTematicos: [],
  indicadores: [],
  ventana: 'dia_completo',
  activo: true,
};

const EJES_DISPONIBLES = [
  'hidrocarburos-energia', 'mineria', 'economia', 'movimientos-sociales',
  'gobierno-oposicion', 'corrupcion-impunidad', 'justicia-derechos',
  'educacion-cultura', 'salud-servicios', 'medio-ambiente',
  'relaciones-internacionales', 'procesos-electorales',
];

const INDICADORES_DISPONIBLES = [
  'tc-oficial-bcb', 'rin-bcb', 'lme-estano', 'lme-plata',
  'reservas-internacionales', 'ipc',
];

const VENTANAS = [
  { value: 'nocturna', label: 'Nocturna (19:00 - 07:00)' },
  { value: 'diurna', label: 'Diurna (07:00 - 19:00)' },
  { value: 'dia_completo', label: 'Dia completo (00:00 - 23:59)' },
  { value: 'semanal', label: 'Semanal (Lun - Dom)' },
  { value: 'quincenal', label: 'Quincenal (15 dias)' },
  { value: 'mensual', label: 'Mensual (30 dias)' },
];

export function ProductosView() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NuevoProducto>(FORM_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateForm = (field: keyof NuevoProducto, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleItem = (field: 'canales' | 'ejesTematicos' | 'indicadores', item: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setShowForm(false);
          setForm(FORM_DEFAULTS);
          setSaved(false);
        }, 1500);
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Package className="h-5 w-5" />} value={ALL_PRODUCTS.length} label="Productos totales" colorClass="text-primary" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} value={ALL_PRODUCTS.filter(p => p.estado === 'operativo').length} label="Operativos" colorClass="text-emerald-600 dark:text-emerald-400" />
        <KPICard icon={<FileBarChart className="h-5 w-5" />} value={COMBOS.length} label="Combos" colorClass="text-purple-600 dark:text-purple-400" />
        <KPICard icon={<Mail className="h-5 w-5" />} value={4} label="Canales" subtext="WhatsApp, Email, Web, PDF" colorClass="text-sky-600 dark:text-sky-400" />
      </div>

      {/* Crear Producto */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full flex items-center justify-between"
          >
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Crear nuevo producto
            </CardTitle>
            {showForm ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {showForm && (
          <CardContent className="p-4 pt-0 space-y-4">
            {saved ? (
              <div className="text-center py-6 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                Producto guardado correctamente
              </div>
            ) : (
              <>
                {/* Fila 1: Nombre + Tipo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del producto</label>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => updateForm('nombre', e.target.value)}
                      placeholder="Ej: El Informe Nocturno"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo / Slug</label>
                    <input
                      type="text"
                      value={form.tipo}
                      onChange={(e) => updateForm('tipo', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                      placeholder="Ej: EL_NOCTURNO"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Fila 2: Categoria + Frecuencia + Ventana */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
                    <select
                      value={form.categoria}
                      onChange={(e) => updateForm('categoria', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="premium">Premium</option>
                      <option value="premium_mid">Premium Mid</option>
                      <option value="premium_alta">Premium Alta</option>
                      <option value="gratuito">Gratuito</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Frecuencia</label>
                    <select
                      value={form.frecuencia}
                      onChange={(e) => updateForm('frecuencia', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      {Object.entries(FRECUENCIA_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Ventana de tiempo</label>
                    <select
                      value={form.ventana}
                      onChange={(e) => updateForm('ventana', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      {VENTANAS.map(v => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fila 3: Horario + Paginas + Lectura */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Horario de envio</label>
                    <input
                      type="text"
                      value={form.horarioEnvio}
                      onChange={(e) => updateForm('horarioEnvio', e.target.value)}
                      placeholder="Ej: 08:00 AM"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Paginas estimadas</label>
                    <input
                      type="number"
                      value={form.longitudPaginas}
                      onChange={(e) => updateForm('longitudPaginas', parseInt(e.target.value) || 0)}
                      min={1} max={50}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Min lectura</label>
                    <input
                      type="number"
                      value={form.longitudMinLectura}
                      onChange={(e) => updateForm('longitudMinLectura', parseInt(e.target.value) || 0)}
                      min={1} max={60}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Descripcion */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripcion</label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => updateForm('descripcion', e.target.value)}
                    placeholder="Descripcion del producto..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {/* Canales */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Canales de entrega</label>
                  <div className="flex flex-wrap gap-2">
                    {['whatsapp', 'email', 'web', 'pdf'].map(canal => (
                      <button
                        key={canal}
                        onClick={() => toggleItem('canales', canal)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          form.canales.includes(canal)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {CANAL_LABELS[canal] || canal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ejes Tematicos */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Ejes tematicos incluidos</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EJES_DISPONIBLES.map(eje => (
                      <button
                        key={eje}
                        onClick={() => toggleItem('ejesTematicos', eje)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                          form.ejesTematicos.includes(eje)
                            ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700'
                            : 'bg-background text-muted-foreground border-border hover:border-purple-300'
                        }`}
                      >
                        {eje.replace(/-/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Indicadores */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Indicadores a incluir</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INDICADORES_DISPONIBLES.map(ind => (
                      <button
                        key={ind}
                        onClick={() => toggleItem('indicadores', ind)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                          form.indicadores.includes(ind)
                            ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                            : 'bg-background text-muted-foreground border-border hover:border-blue-300'
                        }`}
                      >
                        {ind.replace(/-/g, ' ').replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving || !form.nombre || !form.tipo} className="text-xs gap-1">
                    {saving ? 'Guardando...' : 'Guardar producto'}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowForm(false); setForm(FORM_DEFAULTS); }} className="text-xs">
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Products by category */}
      {PRODUCT_CATEGORIES.map((cat) => {
        const catProducts = ALL_PRODUCTS.filter(p => p.categoria === cat.id);
        if (catProducts.length === 0) return null;
        return (
          <Card key={cat.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                <CardTitle className="text-sm font-semibold">{catProducts.length} producto{catProducts.length > 1 ? 's' : ''}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catProducts.map((prod) => {
                  const ProdIcon = prod.icon;
                  const prodConfig = PRODUCTOS[prod.tipo];
                  return (
                    <div key={prod.tipo} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-all hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: prod.color + '20' }}>
                          <ProdIcon className="h-5 w-5" style={{ color: prod.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{prod.nombre}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              prod.estado === 'operativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : prod.estado === 'definido' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-stone-100 text-stone-500'
                            }`}>
                              {prod.estado === 'operativo' ? 'Operativo' : prod.estado === 'definido' ? 'Definido' : 'Pendiente'}
                            </span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${cat.color}`}>{cat.label}</span>
                        </div>
                      </div>
                      {prodConfig && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground leading-relaxed">{prodConfig.descripcion}</p>
                          <div className="flex items-center flex-wrap gap-3 text-[10px] text-muted-foreground">
                            <span>{prodConfig.horarioEnvio}</span>
                            <span>{prodConfig.longitudPaginas} pag.</span>
                            <span>{prodConfig.longitudMinLectura} min</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {prodConfig.canales.map((canal) => (
                              <Badge key={canal} variant="secondary" className="text-[9px] px-1.5 py-0">{CANAL_LABELS[canal] || canal}</Badge>
                            ))}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{FRECUENCIA_LABELS[prodConfig.frecuencia] || prodConfig.frecuencia}</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Combos section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
            Combos de Productos
          </CardTitle>
          <CardDescription className="text-xs">
            {COMBOS.length} combos disponibles
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMBOS.map((combo) => (
              <div key={combo.id} className="p-4 rounded-xl border-2 border-primary/20 hover:border-primary/40 transition-all bg-gradient-to-br from-primary/[0.02] to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-foreground">{combo.nombre}</h4>
                  <Badge className="text-[10px] bg-primary text-primary-foreground font-bold">
                    Bs {combo.precioMensual.toLocaleString()}/mes
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{combo.descripcion}</p>
                <Separator className="my-3" />
                <div className="flex flex-wrap gap-1.5">
                  {combo.productos.map((tipo) => {
                    const prodInfo = ALL_PRODUCTS.find(p => p.tipo === tipo);
                    const ProdIcon = prodInfo?.icon || FileText;
                    return (
                      <span key={tipo} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted font-medium text-muted-foreground">
                        <ProdIcon className="h-3 w-3" style={{ color: prodInfo?.color }} />
                        {PRODUCTOS[tipo]?.nombreCorto || tipo.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
