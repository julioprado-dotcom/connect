'use client';

import { Input } from '@/components/ui/input';
import { SEGMENTOS, type ClienteData } from './shared';

/* ─── STEP 1: Client Data ─────────────────────────────────── */
export function StepClient({
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

      {/* Datos de facturacion */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Datos de facturaci&oacute;n
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">CI (C&eacute;dula de Identidad)</label>
            <Input
              placeholder="Ej: 8901234"
              value={data.ci}
              onChange={(e) => update('ci', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Raz&oacute;n Social (para factura)</label>
            <Input
              placeholder="Nombre o raz&oacute;n social que aparece en la factura"
              value={data.razonSocial}
              onChange={(e) => update('razonSocial', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">NIT</label>
            <Input
              placeholder="N&uacute;mero de Identificaci&oacute;n Tributaria"
              value={data.nit}
              onChange={(e) => update('nit', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
