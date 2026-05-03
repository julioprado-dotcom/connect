'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';
import { PRODUCTOS } from '@/constants/products';
import type { TipoBoletin } from '@/types/bulletin';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

/* ─── Segmento options ────────────────────────────────────── */
const SEGMENTOS = [
  { value: 'partido_politico', label: 'Partido Pol&iacute;tico' },
  { value: 'movimiento_social', label: 'Movimiento Social' },
  { value: 'ong', label: 'ONG' },
  { value: 'embajada', label: 'Embajada / Org. Internacional' },
  { value: 'legislador', label: 'Legislador' },
  { value: 'medio', label: 'Medio de Comunicaci&oacute;n' },
  { value: 'academico', label: 'Acad&eacute;mico' },
  { value: 'otro', label: 'Otro' },
];

/* ─── Types ───────────────────────────────────────────────── */
interface ClienteData {
  nombre: string;
  organizacion: string;
  nombreContacto: string;
  email: string;
  telefono: string;
  whatsapp: string;
  segmento: string;
  notas: string;
}

interface ProductConfig {
  tipo: TipoBoletin;
  canal: string;
  frecuencia: string;
  precio: number;
  fechaInicio: string;
}

/* ─── Helper: get today as YYYY-MM-DD ─────────────────────── */
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/* ─── Price map from combos / defaults ────────────────────── */
function getDefaultPrice(tipo: TipoBoletin): number {
  const cat = ALL_PRODUCTS.find((p) => p.tipo === tipo)?.categoria;
  if (cat === 'premium_alta') return 2000;
  if (cat === 'premium_mid') return 1500;
  if (cat === 'premium') return 500;
  return 0;
}

/* ─── Step indicator ──────────────────────────────────────── */
function StepIndicator({ step }: { step: number }) {
  const steps = ['Cliente', 'Productos', 'Confirmar'];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = step === stepNum;
        const isDone = step > stepNum;
        return (
          <div key={stepNum} className="flex items-center gap-2 flex-1">
            <div
              className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : isDone
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── STEP 1: Client Data ─────────────────────────────────── */
function StepClient({
  data,
  onChange,
}: {
  data: ClienteData;
  onChange: (d: ClienteData) => void;
}) {
  const update = (field: keyof ClienteData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Datos del Cliente</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Complete la informaci&oacute;n del nuevo cliente.</p>
      </div>

      {/* nombre */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Nombre / Raz&oacute;n Social <span className="text-red-500">*</span>
        </label>
        <Input
          placeholder="Ej: Partido X, Embajada de Y..."
          value={data.nombre}
          onChange={(e) => update('nombre', e.target.value)}
        />
      </div>

      {/* organizacion */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Organizaci&oacute;n</label>
        <Input
          placeholder="Nombre de la organizaci&oacute;n"
          value={data.organizacion}
          onChange={(e) => update('organizacion', e.target.value)}
        />
      </div>

      {/* nombreContacto */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Persona de Contacto</label>
        <Input
          placeholder="Nombre de la persona"
          value={data.nombreContacto}
          onChange={(e) => update('nombreContacto', e.target.value)}
        />
      </div>

      {/* email */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Email <span className="text-red-500">*</span>
        </label>
        <Input
          type="email"
          placeholder="email@ejemplo.com"
          value={data.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </div>

      {/* telefono + whatsapp row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Tel&eacute;fono</label>
          <Input
            placeholder="+591..."
            value={data.telefono}
            onChange={(e) => update('telefono', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">WhatsApp</label>
          <Input
            placeholder="+591..."
            value={data.whatsapp}
            onChange={(e) => update('whatsapp', e.target.value)}
          />
        </div>
      </div>

      {/* segmento */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Segmento</label>
        <select
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={data.segmento}
          onChange={(e) => update('segmento', e.target.value)}
        >
          <option value="otro">Seleccionar segmento...</option>
          {SEGMENTOS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* notas */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Notas</label>
        <textarea
          className="w-full min-h-[72px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          placeholder="Observaciones adicionales..."
          value={data.notas}
          onChange={(e) => update('notas', e.target.value)}
        />
      </div>
    </div>
  );
}

/* ─── STEP 2: Product Selection ───────────────────────────── */
function StepProducts({
  selected,
  onToggle,
}: {
  selected: TipoBoletin[];
  onToggle: (tipo: TipoBoletin) => void;
}) {
  const categories = PRODUCT_CATEGORIES.filter((c) => c.id !== 'gratuito');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Seleccionar Productos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Elija los productos que desea contratar.
        </p>
      </div>

      {categories.map((cat) => {
        const products = ALL_PRODUCTS.filter((p) => p.categoria === cat.id);
        if (products.length === 0) return null;
        const catLabel = cat.label;

        return (
          <div key={cat.id} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {catLabel}
            </p>
            <div className="space-y-2">
              {products.map((prod) => {
                const isSelected = selected.includes(prod.tipo);
                const config = PRODUCTOS[prod.tipo];
                const Icon = prod.icon;
                return (
                  <button
                    key={prod.tipo}
                    type="button"
                    onClick={() => onToggle(prod.tipo)}
                    className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/30'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    {/* checkbox indicator */}
                    <div
                      className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {/* icon */}
                    <div
                      className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: prod.color + '18' }}
                    >
                      <Icon className="h-4.5 w-4.5" style={{ color: prod.color }} />
                    </div>
                    {/* info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {prod.nombre}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {FRECUENCIA_LABELS[config.frecuencia] || config.frecuencia}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {config.descripcion}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary */}
      {selected.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-0">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {selected.length} producto{selected.length > 1 ? 's' : ''} seleccionado{selected.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selected.map((tipo) => {
                const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
                return (
                  <Badge key={tipo} variant="outline" className="text-[10px]">
                    {prod?.nombre || tipo}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── STEP 3: Configuration + Confirm ─────────────────────── */
function StepConfirm({
  cliente,
  products,
  productConfigs,
  onUpdateConfig,
}: {
  cliente: ClienteData;
  products: TipoBoletin[];
  productConfigs: Record<string, ProductConfig>;
  onUpdateConfig: (tipo: TipoBoletin, config: Partial<ProductConfig>) => void;
}) {
  const totalMensual = products.reduce(
    (sum, tipo) => sum + (productConfigs[tipo]?.precio || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Configuraci&oacute;n + Confirmar</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Revise y ajuste la configuraci&oacute;n de cada producto.
        </p>
      </div>

      {/* Product config cards */}
      <div className="space-y-3">
        {products.map((tipo) => {
          const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
          const config = PRODUCTOS[tipo];
          const pc = productConfigs[tipo] || {
            tipo,
            canal: 'whatsapp',
            frecuencia: config.frecuencia,
            precio: getDefaultPrice(tipo),
            fechaInicio: todayStr(),
          };

          return (
            <Card key={tipo} className="space-y-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{prod?.nombre || tipo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {/* Canal */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Canal de entrega
                  </label>
                  <div className="flex gap-2">
                    {['whatsapp', 'email', 'ambos'].map((canal) => (
                      <button
                        key={canal}
                        type="button"
                        onClick={() => onUpdateConfig(tipo, { canal })}
                        className={`flex-1 h-8 rounded-lg text-xs font-medium transition-colors ${
                          pc.canal === canal
                            ? 'bg-emerald-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {canal === 'ambos' ? 'Ambos' : CANAL_LABELS[canal] || canal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frecuencia */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Frecuencia
                  </label>
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={pc.frecuencia}
                    onChange={(e) => onUpdateConfig(tipo, { frecuencia: e.target.value })}
                  >
                    {Object.entries(FRECUENCIA_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Precio + Fecha row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Precio mensual (Bs)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={pc.precio}
                      onChange={(e) =>
                        onUpdateConfig(tipo, { precio: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Fecha inicio
                    </label>
                    <Input
                      type="date"
                      value={pc.fechaInicio}
                      onChange={(e) => onUpdateConfig(tipo, { fechaInicio: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Final summary */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium text-foreground">{cliente.nombre}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{cliente.email}</span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="space-y-1.5">
            {products.map((tipo) => {
              const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
              const pc = productConfigs[tipo];
              return (
                <div key={tipo} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{prod?.nombre}</span>
                  <span className="font-medium text-foreground">
                    Bs {pc?.precio.toLocaleString('es-BO', { minimumFractionDigits: 0 }) || 0}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between text-sm font-bold">
            <span className="text-foreground">Total mensual</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Bs {totalMensual.toLocaleString('es-BO', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Success State ───────────────────────────────────────── */
function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">&iexcl;Registro exitoso!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          El cliente y los contratos han sido creados correctamente.
        </p>
      </div>
      <Button onClick={onReset} variant="outline" size="sm">
        Crear otro cliente
      </Button>
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
export default function NuevoClientePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Client data
  const [cliente, setCliente] = useState<ClienteData>({
    nombre: '',
    organizacion: '',
    nombreContacto: '',
    email: '',
    telefono: '',
    whatsapp: '',
    segmento: 'otro',
    notas: '',
  });

  // Selected products
  const [selectedProducts, setSelectedProducts] = useState<TipoBoletin[]>([]);

  // Product configurations
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductConfig>>({});

  const toggleProduct = (tipo: TipoBoletin) => {
    setSelectedProducts((prev) => {
      const next = prev.includes(tipo)
        ? prev.filter((t) => t !== tipo)
        : [...prev, tipo];

      // Initialize config if newly selected
      if (!prev.includes(tipo)) {
        const config = PRODUCTOS[tipo];
        setProductConfigs((cfg) => ({
          ...cfg,
          [tipo]: {
            tipo,
            canal: 'whatsapp',
            frecuencia: config.frecuencia,
            precio: getDefaultPrice(tipo),
            fechaInicio: todayStr(),
          },
        }));
      }

      return next;
    });
  };

  const updateProductConfig = (tipo: TipoBoletin, updates: Partial<ProductConfig>) => {
    setProductConfigs((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], ...updates },
    }));
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!cliente.nombre.trim()) {
        setError('El nombre es obligatorio');
        return;
      }
      if (!cliente.email.trim() || !validateEmail(cliente.email)) {
        setError('Ingrese un email v&aacute;lido');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedProducts.length === 0) {
        setError('Seleccione al menos un producto');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      // 1. Create client
      const clientRes = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: cliente.nombre,
          organizacion: cliente.organizacion,
          nombreContacto: cliente.nombreContacto,
          email: cliente.email,
          telefono: cliente.telefono,
          whatsapp: cliente.whatsapp,
          segmento: cliente.segmento,
          notas: cliente.notas,
        }),
      });

      if (!clientRes.ok) {
        const data = await clientRes.json();
        throw new Error(data.error || 'Error al crear cliente');
      }

      const { cliente: createdClient } = await clientRes.json();

      // 2. Create contracts for each selected product
      const results = await Promise.allSettled(
        selectedProducts.map((tipo) => {
          const pc = productConfigs[tipo];
          return fetch('/api/contratos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clienteId: createdClient.id,
              tipoProducto: tipo,
              frecuencia: pc.frecuencia,
              formatoEntrega: pc.canal,
              fechaInicio: pc.fechaInicio,
              montoMensual: pc.precio,
            }),
          });
        })
      );

      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      );

      if (failed.length > 0) {
        throw new Error(`${failed.length} contrato(s) no se pudieron crear`);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setCliente({
      nombre: '',
      organizacion: '',
      nombreContacto: '',
      email: '',
      telefono: '',
      whatsapp: '',
      segmento: 'otro',
      notas: '',
    });
    setSelectedProducts([]);
    setProductConfigs({});
    setError('');
    setSuccess(false);
  };

  if (success) {
    return <SuccessState onReset={handleReset} />;
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Back to home */}
      <button
        type="button"
        onClick={() => router.push('/agente')}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver al portal
      </button>

      <StepIndicator step={step} />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Steps */}
      {step === 1 && <StepClient data={cliente} onChange={setCliente} />}
      {step === 2 && (
        <StepProducts selected={selectedProducts} onToggle={toggleProduct} />
      )}
      {step === 3 && (
        <StepConfirm
          cliente={cliente}
          products={selectedProducts}
          productConfigs={productConfigs}
          onUpdateConfig={updateProductConfig}
        />
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={submitting}
            className="flex-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Button>
        )}
        {step < 3 && (
          <Button
            type="button"
            size="sm"
            onClick={handleNext}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Siguiente
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {step === 3 && (
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Confirmar y Crear
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
