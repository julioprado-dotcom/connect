'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PRODUCTOS } from '@/constants/products';
import type { TipoBoletin } from '@/types/bulletin';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  XCircle,
  Loader2,
} from 'lucide-react';

import {
  type ClienteData,
  type ProductConfig,
  getDefaultPrice,
  todayStr,
} from './_components/shared';
import { StepClient } from './_components/StepClient';
import { StepProducts } from './_components/StepProducts';
import { StepIndicator, StepConfirm, SuccessState } from './_components/StepConfirm';

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
    ci: '',
    razonSocial: '',
    nit: '',
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
          ci: cliente.ci,
          razonSocial: cliente.razonSocial,
          nit: cliente.nit,
        }),
      });

      if (!clientRes.ok) {
        const data = await clientRes.json();
        throw new Error(data.error || 'Error al crear cliente');
      }

      const { cliente: createdClient } = await clientRes.json();

      // 2. Create one contract with all selected products
      const contractRes = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: createdClient.id,
          tipoProducto: selectedProducts,
          frecuencia: selectedProducts.length === 1
            ? productConfigs[selectedProducts[0]]?.frecuencia || 'diario'
            : 'diario',
          formatoEntrega: selectedProducts.length === 1
            ? productConfigs[selectedProducts[0]]?.canal || 'whatsapp'
            : 'whatsapp',
          fechaInicio: selectedProducts.length === 1
            ? productConfigs[selectedProducts[0]]?.fechaInicio || todayStr()
            : todayStr(),
          montoMensual: selectedProducts.reduce(
            (sum, tipo) => sum + (productConfigs[tipo]?.precio || 0),
            0
          ),
        }),
      });

      if (!contractRes.ok) {
        const errData = await contractRes.json();
        throw new Error(errData.error || 'Error al crear contrato');
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
      ci: '',
      razonSocial: '',
      nit: '',
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
