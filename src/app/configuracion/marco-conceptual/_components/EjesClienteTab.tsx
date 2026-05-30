'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Edit3, Loader2, Plus, Trash2, Users, X, Tag, MessageSquare, Power, Save,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────

export function EjesClienteTab() {
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
