'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, AlertTriangle } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
}

interface Sugerencia {
  id: string;
  tipo: string;
  instruccionOriginal: string;
  resultado: string | null;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function AIAssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [unreadSuggestions, setUnreadSuggestions] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/ai/sugerencias');
      if (res.ok) {
        const data = await res.json();
        const sugs = data.sugerencias || [];
        setSugerencias(sugs);
        setUnreadSuggestions(sugs.length);
      }
    } catch {
      // Silent
    }
  }, []);

  // Fetch suggestions on mount and after sending messages
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/ai/sugerencias');
        if (res.ok && !cancelled) {
          const data = await res.json();
          const sugs = data.sugerencias || [];
          setSugerencias(sugs);
          setUnreadSuggestions(sugs.length);
        }
      } catch {
        // Silent
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/dashboard/ai/instruccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruccion: trimmed }),
      });

      const data = await res.json();

      if (res.ok) {
        const aiMsg: ChatMessage = {
          id: `msg_${Date.now()}_ai`,
          role: 'ai',
          content: data.mensaje || 'Instrucción procesada.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);

        // If there's a suggestion, add it as system message
        if (data.sugerencia) {
          const sysMsg: ChatMessage = {
            id: `msg_${Date.now()}_sys`,
            role: 'system',
            content: data.sugerencia,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, sysMsg]);
          setUnreadSuggestions(prev => prev + 1);
        }

        // Refresh suggestions
        fetchSuggestions();
      } else {
        const errMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          role: 'system',
          content: `Error: ${data.error || 'No se pudo procesar la instrucción'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } catch {
      const errMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'system',
        content: 'Error de conexión. Verifica que el servidor esté disponible.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, fetchSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const dismissSuggestions = () => {
    setUnreadSuggestions(0);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* ─── Floating Button (collapsed) ─── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => {
              setIsOpen(true);
              dismissSuggestions();
            }}
            className="fixed bottom-6 right-6 z-50 group"
            aria-label="Abrir Asistente DECODEX"
          >
            {/* Pulse ring when there are unread suggestions */}
            {unreadSuggestions > 0 && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: '#00ff88' }} />
            )}

            {/* Badge */}
            {unreadSuggestions > 0 && (
              <span
                className="absolute -top-1 -right-1 z-10 flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-black"
                style={{ backgroundColor: '#ffaa00' }}
              >
                {unreadSuggestions}
              </span>
            )}

            {/* Main button */}
            <div
              className="relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 group-hover:scale-105"
              style={{
                backgroundColor: '#12121a',
                border: '2px solid #00ff88',
                boxShadow: '0 0 20px rgba(0,255,136,0.15)',
              }}
            >
              <Bot className="w-5 h-5" style={{ color: '#00ff88' }} />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Panel (expanded) ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex flex-col"
            style={{
              width: '380px',
              maxWidth: 'calc(100vw - 24px)',
              backgroundColor: '#12121a',
              borderLeft: '2px solid #00ff88',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid #1a1a2e' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ backgroundColor: 'rgba(0,255,136,0.1)' }}
                >
                  <Bot className="w-4 h-4" style={{ color: '#00ff88' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Asistente DECODEX</h3>
                  <p className="text-[10px]" style={{ color: '#888' }}>
                    Inteligencia de Medios · Bolivia
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                aria-label="Cerrar panel"
              >
                <X className="w-4 h-4" style={{ color: '#888' }} />
              </button>
            </div>

            {/* Active suggestions banner */}
            {unreadSuggestions > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden"
                style={{ borderBottom: '1px solid #1a1a2e' }}
              >
                <div
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{ backgroundColor: 'rgba(255,170,0,0.08)' }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#ffaa00' }} />
                  <p className="text-[11px] flex-1" style={{ color: '#ffaa00' }}>
                    {unreadSuggestions} sugerencia{unreadSuggestions > 1 ? 's' : ''} pendiente{unreadSuggestions > 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={dismissSuggestions}
                    className="text-[10px] underline hover:no-underline shrink-0"
                    style={{ color: '#ffaa00' }}
                  >
                    Descartar
                  </button>
                </div>
              </motion.div>
            )}

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'rgba(0,255,136,0.08)' }}
                  >
                    <Bot className="w-6 h-6" style={{ color: '#00ff88' }} />
                  </div>
                  <p className="text-sm font-semibold text-white mb-2">
                    ¿En qué puedo ayudarte?
                  </p>
                  <p className="text-[11px] mb-4" style={{ color: '#666' }}>
                    Puedes darme instrucciones para operar el sistema:
                  </p>
                  <div className="space-y-1.5 text-left w-full">
                    {[
                      'Regenerar un producto (Termómetro, Foco, etc.)',
                      'Corregir clasificación de menciones',
                      'Añadir o desactivar keywords',
                      'Resumir un período de actividad',
                    ].map((hint, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px]"
                        style={{
                          backgroundColor: '#1a1a2e',
                          color: '#aaa',
                        }}
                      >
                        <span style={{ color: '#00ff88' }}>›</span>
                        {hint}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  {msg.role === 'user' ? (
                    /* User message — right aligned */
                    <div className="flex justify-end">
                      <div
                        className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] text-white leading-relaxed"
                        style={{ backgroundColor: '#1a1a2e' }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ) : msg.role === 'ai' ? (
                    /* AI message — left aligned */
                    <div className="flex justify-start">
                      <div
                        className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] leading-relaxed"
                        style={{
                          backgroundColor: '#0a0a0f',
                          border: '1px solid #1a1a2e',
                          color: '#ddd',
                        }}
                      >
                        {msg.content.split('\n').map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < msg.content.split('\n').length - 1 && <br />}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* System message — centered */
                    <div className="flex justify-center">
                      <div
                        className="max-w-[90%] rounded-lg px-3 py-2 text-[11px] italic text-center"
                        style={{
                          backgroundColor: sugerencias.some(s => s.instruccionOriginal.includes(msg.content))
                            ? 'rgba(255,170,0,0.08)'
                            : 'rgba(255,51,85,0.08)',
                          color: msg.content.includes('⚠') ? '#ffaa00' :
                                 msg.content.includes('Error') ? '#ff3355' : '#888',
                        }}
                      >
                        {msg.content.split('\n').map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < msg.content.split('\n').length - 1 && <br />}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <span className="text-[9px] mt-1 px-1" style={{ color: '#444' }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div
                    className="flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3"
                    style={{
                      backgroundColor: '#0a0a0f',
                      border: '1px solid #1a1a2e',
                    }}
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#00ff88' }} />
                    <span className="text-[11px]" style={{ color: '#666' }}>
                      Analizando instrucción...
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div
              className="shrink-0 px-4 py-3"
              style={{
                borderTop: '1px solid #1a1a2e',
                backgroundColor: '#0a0a0f',
              }}
            >
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                style={{
                  backgroundColor: '#12121a',
                  border: '1px solid #1a1a2e',
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Instruir al sistema..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-[13px] text-white placeholder-gray-600 outline-none py-1.5"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="p-1.5 rounded-lg transition-all duration-150 disabled:opacity-30 hover:opacity-100"
                  style={{ color: '#00ff88' }}
                  aria-label="Enviar instrucción"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[9px] mt-1.5 text-center" style={{ color: '#333' }}>
                Enter para enviar · Powered by DECODEX ONION200
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Backdrop (mobile) ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
