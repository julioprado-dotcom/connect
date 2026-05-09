'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield, Lock, Settings, BookOpen, Scale, Search, Edit3, GitBranch,
  AlertTriangle, CheckCircle2, Save, ChevronDown, ChevronUp, Eye,
  Loader2, Plus, Trash2, ArrowLeft, Users, X, Tag, MessageSquare, Power,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────

interface Principio {
  numero: number;
  nombre: string;
  definicion: string;
  que_es: string[];
  que_no_es: string[];
  errores_llm: string[];
  reglas_operativas: string[];
}

interface MarcoData {
  id: number;
  version: number;
  principios: { principios: Principio[] };
  contextoInstitucional: Record<string, unknown>;
  lineasEditoriales: Record<string, unknown>;
  ejesInstitucionales: Record<string, unknown>;
  escalaTratamiento: Record<string, unknown>;
  reglasDesambiguacion: Record<string, unknown>;
  criteriosRelevancia: Record<string, unknown>;
  exclusionesEtica: Record<string, unknown>;
  terminologiaPermitida: Record<string, unknown>;
  terminologiaProhibida: Record<string, unknown>;
  preguntasFundamentales: Record<string, unknown>;
  parametros: Record<string, unknown>;
  creadoEn: string;
  editadoEn: string | null;
}

interface CambioRecord {
  id: number;
  campo: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
  razon: string | null;
  creadoPor: string | null;
  creadoEn: string;
}

// ─── TABS ───────────────────────────────────────────────────────

const TABS = [
  { id: 'principios', label: 'Principios Fundantes', icon: Lock, editable: false },
  { id: 'contexto', label: 'Contexto Institucional', icon: BookOpen, editable: true },
  { id: 'escala', label: 'Escala de Tratamiento', icon: Scale, editable: true },
  { id: 'relevancia', label: 'Criterios de Relevancia', icon: Search, editable: true },
  { id: 'editoriales', label: 'Lineas Editoriales', icon: Edit3, editable: true },
  { id: 'terminologia', label: 'Terminologia', icon: Settings, editable: true },
  { id: 'etica', label: 'Exclusiones Eticas', icon: Shield, editable: true },
  { id: 'preguntas', label: 'Preguntas Fundamentales', icon: BookOpen, editable: true },
  { id: 'parametros', label: 'Parametros Tecnicos', icon: Settings, editable: true },
  { id: 'ejes-cliente', label: 'Ejes por Cliente', icon: Users, editable: false },
  { id: 'historial', label: 'Historial de Cambios', icon: GitBranch, editable: false },
] as const;

const CAMPO_MAP: Record<string, string> = {
  contexto: 'contextoInstitucional',
  escala: 'escalaTratamiento',
  relevancia: 'criteriosRelevancia',
  editoriales: 'lineasEditoriales',
  terminologia: 'terminologiaPermitida',
  etica: 'exclusionesEtica',
  preguntas: 'preguntasFundamentales',
  parametros: 'parametros',
};

// ─── Component ──────────────────────────────────────────────────

export default function MarcoConceptualPage() {
  const [marco, setMarco] = useState<MarcoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('principios');
  const [expandedPrincipio, setExpandedPrincipio] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [historial, setHistorial] = useState<CambioRecord[]>([]);

  // Edit states for each tab
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [razonChange, setRazonChange] = useState('');

  const fetchMarco = useCallback(async () => {
    try {
      const res = await fetch('/api/marco-conceptual');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMarco(data);
      // Initialize edit values as JSON strings
      const edits: Record<string, string> = {};
      for (const [key, campo] of Object.entries(CAMPO_MAP)) {
        edits[key] = JSON.stringify(data[campo as keyof MarcoData] || {}, null, 2);
      }
      setEditValues(edits);
    } catch {
      setMarco(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistorial = useCallback(async () => {
    try {
      const res = await fetch('/api/marco-conceptual/historial');
      if (res.ok) {
        const data = await res.json();
        setHistorial(data.cambios || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMarco(); fetchHistorial(); }, [fetchMarco, fetchHistorial]);

  const handleSave = async (tabId: string) => {
    const campo = CAMPO_MAP[tabId];
    if (!campo || !marco) return;

    let valor: unknown;
    try {
      valor = JSON.parse(editValues[tabId]);
    } catch {
      setSaveMessage({ type: 'error', text: 'JSON invalido' });
      return;
    }

    if (!razonChange.trim()) {
      setSaveMessage({ type: 'error', text: 'La razon del cambio es obligatoria' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/marco-conceptual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campo, valor, razon: razonChange.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage({ type: 'ok', text: 'Guardado correctamente' });
        setRazonChange('');
        fetchMarco();
        fetchHistorial();
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Error al guardar' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Error de conexion' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!marco) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-lg font-semibold">Marco conceptual no inicializado</p>
        <p className="text-sm text-muted-foreground">Ejecute el seed para crear la version inicial.</p>
      </div>
    );
  }

  const principios = (marco.principios?.principios || []) as Principio[];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/"><Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button></Link>
              <div>
                <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Marco Conceptual
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Version {marco.version} · Creado {new Date(marco.creadoEn).toLocaleDateString('es-BO')}
                  {marco.editadoEn && ` · Editado ${new Date(marco.editadoEn).toLocaleDateString('es-BO')}`}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">v{marco.version}</Badge>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap
                    transition-colors border-b-2 -mb-[1px]
                    ${isActive
                      ? tab.editable
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-muted-foreground text-muted-foreground bg-muted/50'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }
                  `}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                  {!tab.editable && <Lock className="h-2.5 w-2.5 opacity-50" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* TAB 1: Principios Fundantes (READ-ONLY) */}
        {activeTab === 'principios' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                <Lock className="h-3 w-3 mr-1" /> INMUTABLE — No editable
              </Badge>
            </div>
            {principios.map(p => (
              <Card key={p.numero}>
                <CardContent className="p-4">
                  <button
                    className="w-full flex items-start gap-3 text-left"
                    onClick={() => setExpandedPrincipio(expandedPrincipio === p.numero ? null : p.numero)}
                  >
                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                      {p.numero}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{p.nombre}</h3>
                        {expandedPrincipio === p.numero
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-1 leading-relaxed">{p.definicion}</p>
                    </div>
                  </button>
                  {expandedPrincipio === p.numero && (
                    <div className="mt-4 ml-11 space-y-4 text-xs">
                      {/* Que es */}
                      <div>
                        <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Que es</h4>
                        <ul className="space-y-1">
                          {p.que_es.map((item, i) => (
                            <li key={i} className="text-muted-foreground flex gap-1.5">
                              <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Que no es */}
                      <div>
                        <h4 className="font-semibold text-red-700 dark:text-red-400 mb-1.5">Que NO es</h4>
                        <ul className="space-y-1">
                          {p.que_no_es.map((item, i) => (
                            <li key={i} className="text-muted-foreground flex gap-1.5">
                              <AlertTriangle className="h-3 w-3 mt-0.5 text-red-400 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Errores LLM */}
                      <div>
                        <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-1.5">Errores comunes del LLM</h4>
                        <ul className="space-y-1">
                          {p.errores_llm.map((item, i) => (
                            <li key={i} className="text-muted-foreground flex gap-1.5">
                              <span className="text-amber-500 shrink-0">&#9888;</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Reglas operativas */}
                      <div>
                        <h4 className="font-semibold text-primary mb-1.5">Reglas operativas</h4>
                        <div className="space-y-1.5">
                          {p.reglas_operativas.map((item, i) => (
                            <div key={i} className="bg-muted/60 rounded-md p-2.5 font-mono text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 2-9: Editable tabs */}
        {activeTab !== 'principios' && activeTab !== 'historial' && activeTab !== 'ejes-cliente' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 dark:text-blue-400">
                    <Edit3 className="h-3 w-3 mr-1" /> EDITABLE
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Campo: {CAMPO_MAP[activeTab]}
                  </span>
                </div>
                <textarea
                  className="w-full h-80 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  value={editValues[activeTab] || '{}'}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [activeTab]: e.target.value }))}
                />
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground shrink-0">
                      Razon del cambio (obligatorio):
                    </label>
                    <Input
                      className="flex-1 h-8 text-xs"
                      placeholder="Explique por que realiza este cambio..."
                      value={razonChange}
                      onChange={(e) => setRazonChange(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => handleSave(activeTab)}
                      disabled={saving || !razonChange.trim()}
                      className="text-xs gap-1.5"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const campo = CAMPO_MAP[activeTab];
                        setEditValues(prev => ({
                          ...prev,
                          [activeTab]: JSON.stringify(marco[campo as keyof MarcoData] || {}, null, 2),
                        }));
                        setSaveMessage(null);
                      }}
                      className="text-xs"
                    >
                      Restaurar original
                    </Button>
                    {saveMessage && (
                      <span className={`text-xs ${saveMessage.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  Vista previa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <PreviewPanel tabId={activeTab} value={editValues[activeTab] || '{}'} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB: Ejes por Cliente */}
        {activeTab === 'ejes-cliente' && <EjesClienteTab />}

        {/* TAB 10: Historial */}
        {activeTab === 'historial' && (
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground mb-3">
                Registro de cambios de la version {marco.version} ({historial.length} cambios)
              </p>
              {historial.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Campo</TableHead>
                      <TableHead className="text-xs">Razon</TableHead>
                      <TableHead className="text-xs">Editado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {new Date(c.creadoEn).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className="text-[10px]">{c.campo}</Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-foreground max-w-[300px] truncate" title={c.razon || ''}>
                          {c.razon || '—'}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">{c.creadoPor || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Sin cambios registrados</p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// ─── Ejes por Cliente Tab ────────────────────────────────────────

interface ClienteSimple {
  id: string;
  nombre: string;
  organizacion: string;
  estado: string;
}

interface EjeTematico {
  id: number;
  nombre: string;
  descripcion: string | null;
  keywords: string;
  activo: boolean;
  creadoEn: string;
  _count: { menciones: number };
}

function EjesClienteTab() {
  const [clientes, setClientes] = useState<ClienteSimple[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [ejes, setEjes] = useState<EjeTematico[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingEjes, setLoadingEjes] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addNombre, setAddNombre] = useState('');
  const [addDescripcion, setAddDescripcion] = useState('');
  const [addKeywords, setAddKeywords] = useState('');

  // Edit form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editKeywords, setEditKeywords] = useState('');

  // Deactivate dialog
  const [deactivateTarget, setDeactivateTarget] = useState<EjeTematico | null>(null);

  // Message
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await fetch('/api/clientes?limit=100');
        if (res.ok) {
          const data = await res.json();
          setClientes(data.clientes || []);
        }
      } catch { /* silent */ }
      setLoadingClientes(false);
    };
    fetchClientes();
  }, []);

  // Fetch ejes when client is selected
  const fetchEjes = useCallback(async (clienteId: string) => {
    if (!clienteId) { setEjes([]); return; }
    setLoadingEjes(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/ejes`);
      if (res.ok) {
        const data = await res.json();
        setEjes(data.ejes || []);
      }
    } catch { /* silent */ }
    setLoadingEjes(false);
  }, []);

  useEffect(() => { fetchEjes(selectedClientId); }, [selectedClientId, fetchEjes]);

  const showMessage = (type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const resetAddForm = () => {
    setAddNombre('');
    setAddDescripcion('');
    setAddKeywords('');
  setShowAddForm(false);
  };

  const handleCreate = async () => {
    if (!selectedClientId || !addNombre.trim()) return;
    const kw = addKeywords.split(',').map(k => k.trim()).filter(Boolean);
    if (kw.length === 0) {
      showMessage('error', 'Se requiere al menos una keyword');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${selectedClientId}/ejes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: addNombre.trim(), descripcion: addDescripcion.trim(), keywords: kw, activo: true }),
      });
      if (res.ok) {
        showMessage('ok', 'Eje creado correctamente');
        resetAddForm();
        fetchEjes(selectedClientId);
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Error al crear eje');
      }
    } catch { showMessage('error', 'Error de conexion'); }
    setSaving(false);
  };

  const startEdit = (eje: EjeTematico) => {
    setEditingId(eje.id);
    setEditNombre(eje.nombre);
    setEditDescripcion(eje.descripcion || '');
    try { setEditKeywords(JSON.parse(eje.keywords || '[]').join(', ')); } catch { setEditKeywords(''); }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNombre('');
    setEditDescripcion('');
    setEditKeywords('');
  };

  const handleUpdate = async (ejeId: number) => {
    const kw = editKeywords.split(',').map(k => k.trim()).filter(Boolean);
    if (kw.length === 0) {
      showMessage('error', 'Se requiere al menos una keyword');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${selectedClientId}/ejes/${ejeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre.trim(), descripcion: editDescripcion.trim(), keywords: kw }),
      });
      if (res.ok) {
        showMessage('ok', 'Eje actualizado');
        cancelEdit();
        fetchEjes(selectedClientId);
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Error al actualizar');
      }
    } catch { showMessage('error', 'Error de conexion'); }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${selectedClientId}/ejes/${deactivateTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('ok', 'Eje desactivado');
        fetchEjes(selectedClientId);
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Error al desactivar');
      }
    } catch { showMessage('error', 'Error de conexion'); }
    setSaving(false);
    setDeactivateTarget(null);
  };

  const parseKeywords = (kwString: string): string[] => {
    try { return JSON.parse(kwString || '[]'); } catch { return []; }
  };

  const selectedClient = clientes.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-4">
      {/* Status message */}
      {message && (
        <div className={`text-xs px-3 py-2 rounded-md ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Client selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-[10px]">
              <Users className="h-3 w-3 mr-1" /> EJES POR CLIENTE
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {selectedClient ? `${selectedClient.nombre} — ${selectedClient.organizacion || 'Sin organizacion'}` : 'Seleccione un cliente'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs font-medium shrink-0">Cliente:</Label>
            {loadingClientes ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Select value={selectedClientId || undefined} onValueChange={(v) => { if (v) { setSelectedClientId(v); setShowAddForm(false); cancelEdit(); } }}>
                <SelectTrigger className="w-full max-w-xs h-8 text-xs">
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.filter(c => c.estado === 'activo').map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.nombre}{c.organizacion ? ` — ${c.organizacion}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ejes list */}
      {selectedClientId && (
        <>
          {loadingEjes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ejes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-xs text-muted-foreground">Sin ejes configurados para este cliente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {ejes.map(eje => {
                const keywords = parseKeywords(eje.keywords);
                const isEditing = editingId === eje.id;
                return (
                  <Card key={eje.id} className={!eje.activo ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      {isEditing ? (
                        /* ── Edit Mode ── */
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px]">Nombre</Label>
                            <Input className="h-8 text-xs" value={editNombre} onChange={e => setEditNombre(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px]">Descripcion</Label>
                            <Textarea className="text-xs min-h-[60px] resize-y" value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px]">Keywords (separadas por coma)</Label>
                            <Input className="h-8 text-xs" placeholder="keyword1, keyword2, ..." value={editKeywords} onChange={e => setEditKeywords(e.target.value)} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="text-xs gap-1.5" disabled={saving || !editNombre.trim()} onClick={() => handleUpdate(eje.id)}>
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={cancelEdit}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        /* ── View Mode ── */
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-semibold text-foreground truncate">{eje.nombre}</h3>
                                {eje.activo
                                  ? <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-300 dark:text-emerald-400"><Power className="h-2.5 w-2.5 mr-0.5" />Activo</Badge>
                                  : <Badge variant="outline" className="text-[9px] text-red-600 border-red-300 dark:text-red-400"><Power className="h-2.5 w-2.5 mr-0.5" />Inactivo</Badge>
                                }
                              </div>
                              {eje.descripcion && (
                                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{eje.descripcion}</p>
                              )}
                              <div className="flex flex-wrap gap-1 mb-2">
                                {keywords.map((kw, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                                    <Tag className="h-2.5 w-2.5" />{kw}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {eje._count.menciones} menciones
                                </span>
                                <span>Creado {new Date(eje.creadoEn).toLocaleDateString('es-BO')}</span>
                              </div>
                            </div>
                            {eje.activo && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(eje)} title="Editar">
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeactivateTarget(eje)} title="Desactivar">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add button / form */}
          {!showAddForm ? (
            <Button variant="outline" className="text-xs gap-1.5 w-full" onClick={() => setShowAddForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Agregar nuevo eje
            </Button>
          ) : (
            <Card className="border-dashed border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold">Nuevo Eje Tematico</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetAddForm}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Nombre *</Label>
                    <Input className="h-8 text-xs" placeholder="Nombre del eje..." value={addNombre} onChange={e => setAddNombre(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Descripcion</Label>
                    <Textarea className="text-xs min-h-[60px] resize-y" placeholder="Descripcion opcional..." value={addDescripcion} onChange={e => setAddDescripcion(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Keywords * (separadas por coma)</Label>
                    <Input className="h-8 text-xs" placeholder="keyword1, keyword2, ..." value={addKeywords} onChange={e => setAddKeywords(e.target.value)} />
                  </div>
                  <Button size="sm" className="text-xs gap-1.5" disabled={saving || !addNombre.trim()} onClick={handleCreate}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Crear eje
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Deactivate confirmation dialog */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Desactivar eje tematico</DialogTitle>
            <DialogDescription className="text-xs">
              Esta accion desactivara el eje <strong>{deactivateTarget?.nombre}</strong>.
              El eje no se eliminara permanentemente, pero no sera utilizado en el monitoreo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setDeactivateTarget(null)}>Cancelar</Button>
            <Button size="sm" className="text-xs gap-1.5" disabled={saving} onClick={handleDeactivate}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Preview Panel ──────────────────────────────────────────────

function PreviewPanel({ tabId, value }: { tabId: string; value: string }) {
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
