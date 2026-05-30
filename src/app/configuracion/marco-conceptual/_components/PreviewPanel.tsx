'use client';

import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ─── Preview Panel ──────────────────────────────────────────────

export function PreviewPanel({ tabId, value }: { tabId: string; value: string }) {
  try {
    const data = JSON.parse(value);

    switch (tabId) {
      case 'escala': {
        const cats = (data.categorias || []) as Array<{ codigo: string; nombre: string; definicion: string }>;
        if (cats.length === 0) return <p className="text-xs text-muted-foreground">Sin categorias configuradas</p>;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cats.map((c, i) => (
              <div key={i} className="border rounded-md p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{c.codigo}</span>
                  <span className="text-xs font-semibold">{c.nombre}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{c.definicion}</p>
              </div>
            ))}
          </div>
        );
      }
      case 'relevancia': {
        const es = (data.es_relevante_si || []) as string[];
        const no = (data.no_es_relevante_si || []) as string[];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-emerald-600 mb-1.5">Es relevante si</h4>
              <ul className="space-y-1">{es.map((item, i) => <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />{item}</li>)}</ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-red-600 mb-1.5">No es relevante si</h4>
              <ul className="space-y-1">{no.map((item, i) => <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />{item}</li>)}</ul>
            </div>
          </div>
        );
      }
      case 'terminologia': {
        const oblig = data.obligatoria as Record<string, string> | undefined;
        const terms = (data.terminos || []) as string[];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-emerald-600 mb-1.5">Usar siempre</h4>
              {oblig ? Object.entries(oblig).map(([k, v]) => (
                <div key={k} className="text-[11px] flex gap-2 items-baseline mb-1">
                  <span className="text-red-400 line-through">{k}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-emerald-600 font-medium">{v}</span>
                </div>
              )) : <p className="text-[11px] text-muted-foreground">Vacio</p>}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-red-600 mb-1.5">Nunca usar</h4>
              <div className="flex flex-wrap gap-1">
                {terms.map((t, i) => <Badge key={i} variant="outline" className="text-[10px] border-red-200 text-red-600">{t}</Badge>)}
              </div>
            </div>
          </div>
        );
      }
      case 'parametros': {
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="border rounded-md p-2">
                <p className="text-[10px] text-muted-foreground font-mono">{k}</p>
                <p className="text-sm font-semibold">{typeof v === 'boolean' ? (v ? 'Si' : 'No') : String(v)}</p>
              </div>
            ))}
          </div>
        );
      }
      case 'etica': {
        const sensibles = (data.datos_sensibles || []) as string[];
        const fuentes = (data.fuentes_no_permitidas || []) as string[];
        const noMon = (data.no_monitoreables || []) as string[];
        return (
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold mb-1">Datos sensibles</h4>
              <div className="flex flex-wrap gap-1">{sensibles.map((s, i) => <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
            </div>
            <div>
              <h4 className="text-xs font-semibold mb-1">Fuentes no permitidas</h4>
              <div className="flex flex-wrap gap-1">{fuentes.map((s, i) => <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
            </div>
            <div>
              <h4 className="text-xs font-semibold mb-1">No monitoreables</h4>
              <div className="flex flex-wrap gap-1">{noMon.map((s, i) => <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
            </div>
          </div>
        );
      }
      default:
        return (
          <pre className="text-[11px] font-mono text-muted-foreground bg-muted/50 rounded-md p-3 overflow-auto max-h-60">
            {JSON.stringify(data, null, 2)}
          </pre>
        );
    }
  } catch {
    return <p className="text-xs text-red-500">JSON invalido — corrija la sintaxis</p>;
  }
}
