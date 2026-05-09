'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ALL_PRODUCTS } from '@/constants/nav';
import type { TipoBoletin } from '@/types/bulletin';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Check,
  Mail,
  MessageCircle,
} from 'lucide-react';

/* ─── Boletines gratuitos disponibles ───────────────────────── */
const GRATUITOS = ALL_PRODUCTS.filter((p) => p.categoria === 'gratuito');

export default function SuscriptorPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [canal, setCanal] = useState<'email' | 'whatsapp' | 'ambos'>('email');
  const [selectedBoletines, setSelectedBoletines] = useState<TipoBoletin[]>(['EL_RADAR']);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const toggleBoletin = (tipo: TipoBoletin) => {
    setSelectedBoletines((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !validateEmail(email)) {
      setError('Ingrese un email v&aacute;lido');
      return;
    }

    if (selectedBoletines.length === 0) {
      setError('Seleccione al menos un bolet&iacute;n');
      return;
    }

    if (!privacyAccepted) {
      setError('Debe aceptar la pol&iacute;tica de privacidad');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/suscriptores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim() || null,
          origen: 'admin',
          boletines: selectedBoletines,
          canal,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al registrar suscriptor');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 pb-4">
        <button
          type="button"
          onClick={() => router.push('/agente')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver al portal
        </button>

        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">&iexcl;Suscriptor registrado!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {nombre || email} recibir&aacute; {selectedBoletines.length} bolet&iacute;n(es) por {canal === 'ambos' ? 'email y WhatsApp' : canal}.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
              {selectedBoletines.map((tipo) => {
                const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
                return (
                  <Badge key={tipo} variant="outline" className="text-[10px]">
                    {prod?.nombre || tipo}
                  </Badge>
                );
              })}
            </div>
          </div>
          <Button onClick={() => router.push('/agente/suscriptor')} variant="outline" size="sm">
            Registrar otro suscriptor
          </Button>
        </div>
      </div>
    );
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

      <div>
        <h1 className="text-base font-bold text-foreground">Suscriptor Gratuito</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Registre un suscriptor y asigne los boletines gratuitos que desea recibir.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* nombre */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Nombre</label>
          <Input
            placeholder="Nombre del suscriptor"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* whatsapp */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">WhatsApp</label>
          <Input
            placeholder="+591..."
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>

        {/* Canal de entrega */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Canal de entrega</label>
          <div className="flex gap-2">
            {([
              { value: 'email' as const, label: 'Email', icon: Mail },
              { value: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
              { value: 'ambos' as const, label: 'Ambos', icon: Mail },
            ]).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCanal(opt.value)}
                  className={`flex-1 h-9 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    canal === opt.value
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Boletines gratuitos */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Boletines gratuitos
            <span className="text-red-500 ml-1">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            Seleccione los boletines que el suscriptor desea recibir.
          </p>
          <div className="space-y-2 mt-2">
            {GRATUITOS.map((prod) => {
              const isSelected = selectedBoletines.includes(prod.tipo);
              const Icon = prod.icon;
              return (
                <button
                  key={prod.tipo}
                  type="button"
                  onClick={() => toggleBoletin(prod.tipo)}
                  className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/30'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  {/* checkbox */}
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
                    <span className="text-sm font-semibold text-foreground">
                      {prod.nombre}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {prod.estado === 'operativo' ? 'Operativo' : 'Pr&oacute;ximamente'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected summary */}
          {selectedBoletines.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedBoletines.map((tipo) => {
                const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
                return (
                  <Badge key={tipo} variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                    {prod?.nombre || tipo}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Origen (pre-selected) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Origen</label>
          <div className="h-8 w-full rounded-lg border border-input bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground flex items-center">
            Registro por agente (admin)
          </div>
        </div>

        {/* Privacy notice */}
        <Card className="border-dashed">
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                No compartiremos sus datos con terceros. Sus datos ser&aacute;n utilizados
                exclusivamente para el env&iacute;o de los boletines gratuitos seleccionados de
                DECODEX Bolivia.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="h-4 w-4 rounded border-muted-foreground/30 text-emerald-600 focus:ring-emerald-500/50 accent-emerald-600"
              />
              <span className="text-xs font-medium text-foreground">
                Acepto la pol&iacute;tica de privacidad
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registrando...
            </>
          ) : (
            'Registrar Suscriptor'
          )}
        </Button>
      </form>
    </div>
  );
}
