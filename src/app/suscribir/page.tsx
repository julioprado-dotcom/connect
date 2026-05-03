'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield,
  CheckCircle2,
  Mail,
  Radio,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

/* ── Free products description ─────────────────────────────── */
const FREE_PRODUCTS = [
  {
    name: 'El Radar',
    desc: 'Monitoreo diario de señales mediáticas y presencia en prensa.',
  },
  {
    name: 'Voz y Voto',
    desc: 'Análisis semanal de pronunciamientos y posiciones legislativas.',
  },
  {
    name: 'El Hilo',
    desc: 'Conexiones y narrativas que cruzan la agenda política boliviana.',
  },
  {
    name: 'Foco de la Semana',
    desc: 'Profundización temática: un eje, una mirada, cada semana.',
  },
];

export default function SuscribirPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [consentComms, setConsentComms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  /* ── Email validation ────────────────────────────────────── */
  const validateEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  /* ── Submit handler ──────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !validateEmail(email.trim())) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (!consentComms) {
      setError('Debes aceptar recibir comunicaciones periódicas para continuar.');
      return;
    }

    if (!consentPrivacy) {
      setError('Debes confirmar la política de datos para continuar.');
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
          origen: 'landing',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          throw new Error(
            'Este correo electrónico ya está suscrito. Si deseas actualizar tus datos, contáctanos.'
          );
        }
        throw new Error(data.error || 'Error al procesar la suscripción.');
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error desconocido. Intenta nuevamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success state ───────────────────────────────────────── */
  if (success) {
    return (
      <div className="space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#0A1628' }}
          >
            <span className="text-white text-lg font-bold">D</span>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              DECODEX BOLIVIA
            </p>
            <p className="text-[11px] text-muted-foreground">
              Inteligencia de Señales
            </p>
          </div>
        </div>

        {/* Success message */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30">
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">
                ¡Suscripción exitosa!
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {nombre
                  ? `Gracias, ${nombre}.`
                  : '¡Gracias por suscribirte!'}{' '}
                A partir de ahora recibirás{' '}
                <span className="font-semibold text-foreground">
                  El Radar
                </span>
                ,{' '}
                <span className="font-semibold text-foreground">
                  Voz y Voto
                </span>
                ,{' '}
                <span className="font-semibold text-foreground">El Hilo</span>{' '}
                y{' '}
                <span className="font-semibold text-foreground">
                  Foco de la Semana
                </span>{' '}
                directamente en tu correo electrónico.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span>Revisa tu bandeja de entrada (y carpeta de spam).</span>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            ¿Eres cliente? Accede al panel de administración
          </Link>
          <Link
            href="/agente"
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            ¿Eres agente comercial? Accede al portal
          </Link>
        </div>
      </div>
    );
  }

  /* ── Form state ──────────────────────────────────────────── */
  return (
    <div className="space-y-8">
      {/* ── DECODEX Branding ──────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
          style={{ backgroundColor: '#0A1628' }}
        >
          <span className="text-white text-lg font-bold">D</span>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            DECODEX BOLIVIA
          </p>
          <p className="text-[11px] text-muted-foreground">
            Inteligencia de Señales
          </p>
        </div>
      </div>

      {/* ── Title & subtitle ──────────────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Suscripción Gratuita
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Recibe{' '}
          <span className="font-semibold text-foreground">El Radar</span>,{' '}
          <span className="font-semibold text-foreground">Voz y Voto</span>,{' '}
          <span className="font-semibold text-foreground">El Hilo</span> y{' '}
          <span className="font-semibold text-foreground">
            Foco de la Semana
          </span>{' '}
          directamente en tu email.
        </p>
      </div>

      {/* ── Products overview ─────────────────────────────────── */}
      <Card className="border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="grid gap-3">
            {FREE_PRODUCTS.map((p) => (
              <div key={p.name} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Radio className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Subscription form ─────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* nombre */}
        <div className="space-y-1.5">
          <label
            htmlFor="suscribir-nombre"
            className="text-sm font-medium text-foreground"
          >
            Nombre
          </label>
          <Input
            id="suscribir-nombre"
            placeholder="Tu nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
          />
        </div>

        {/* email */}
        <div className="space-y-1.5">
          <label
            htmlFor="suscribir-email"
            className="text-sm font-medium text-foreground"
          >
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <Input
            id="suscribir-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {/* whatsapp */}
        <div className="space-y-1.5">
          <label
            htmlFor="suscribir-whatsapp"
            className="text-sm font-medium text-foreground"
          >
            WhatsApp{' '}
            <span className="text-xs font-normal text-muted-foreground">
              (opcional)
            </span>
          </label>
          <Input
            id="suscribir-whatsapp"
            type="tel"
            placeholder="+591 70000000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            autoComplete="tel"
          />
          <p className="text-[11px] text-muted-foreground">
            Formato boliviano: +591 seguido de tu número (ej. +591 70000000)
          </p>
        </div>

        {/* Hidden origen field */}
        <input type="hidden" name="origen" value="landing" readOnly />

        {/* Checkbox: consent communications */}
        <div className="space-y-4 pt-1">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={consentComms}
              onChange={(e) => setConsentComms(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-muted-foreground/30 text-emerald-600 focus:ring-emerald-500/50 accent-emerald-600 cursor-pointer"
            />
            <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
              Acepto recibir comunicaciones periódicas de DECODEX Bolivia.
              <span className="text-red-500 ml-0.5">*</span>
            </span>
          </label>

          {/* Checkbox: consent privacy */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={consentPrivacy}
              onChange={(e) => setConsentPrivacy(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-muted-foreground/30 text-emerald-600 focus:ring-emerald-500/50 accent-emerald-600 cursor-pointer"
            />
            <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
              Confirmo que mis datos no serán compartidos con terceros y serán
              utilizados exclusivamente para el envío de boletines gratuitos.
              <span className="text-red-500 ml-0.5">*</span>
            </span>
          </label>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 text-sm"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              Suscribirme — Es gratuito
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </>
          )}
        </Button>
      </form>

      {/* ── Privacy section ────────────────────────────────────── */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">
                Política de Datos
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                DECODEX Bolivia / ONION200 no vende, comparte ni comercializa
                los datos personales de sus suscriptores. Tu información es
                utilizada exclusivamente para el envío de los boletines
                gratuitos que has seleccionado. Puedes darte de baja en
                cualquier momento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Footer links ───────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground pt-2">
        <Link
          href="/dashboard"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          ¿Eres cliente? Accede al panel de administración
        </Link>
        <Link
          href="/agente"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          ¿Eres agente comercial? Accede al portal
        </Link>
      </div>

      {/* ── Copyright ──────────────────────────────────────────── */}
      <p className="text-center text-[10px] text-muted-foreground/60 pt-2">
        &copy; {new Date().getFullYear()} DECODEX Bolivia &middot; ONION200
        &middot; Todos los derechos reservados
      </p>
    </div>
  );
}
