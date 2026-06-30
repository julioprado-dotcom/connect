'use client';

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TipoBoletin } from '@/types/bulletin';
import { ALL_PRODUCTS } from '@/constants/nav';
import { Copy, Check } from 'lucide-react';

// ─── Props ──────────────────────────────────────────────────────────

interface ProductoRichContentProps {
  contenido: string;
  tipo?: TipoBoletin | string;
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getProductStyle(tipo?: string) {
  const prod = tipo ? ALL_PRODUCTS.find(p => p.tipo === tipo) : null;
  return {
    color: prod?.color || '#1284BA',
    nombre: prod?.nombre || 'Reporte',
  };
}

// ─── Component ──────────────────────────────────────────────────────

export function ProductoRichContent({ contenido, tipo, className = '' }: ProductoRichContentProps) {
  const style = getProductStyle(tipo);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      // Strip markdown formatting for clean copy
      const plainText = contenido
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/^\s*---\s*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const ta = document.createElement('textarea');
      ta.value = contenido;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [contenido]);

  return (
    <div className={`producto-rich-content ${className}`}>
      {/* Copy button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all duration-200 cursor-pointer"
          style={{
            color: copied ? '#10b981' : style.color,
            backgroundColor: copied ? 'rgba(16,185,129,0.08)' : 'rgba(148,163,184,0.06)',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.12)'}`,
          }}
          title="Copiar contenido"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="producto-h1" style={{ borderBottomColor: style.color }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="producto-h2" style={{ borderLeftColor: style.color }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="producto-h3" style={{ color: style.color }}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="producto-p">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="producto-strong">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="producto-em">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="producto-ul">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="producto-ol">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="producto-li">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="producto-blockquote" style={{ borderLeftColor: style.color }}>
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="producto-hr" style={{ borderColor: style.color + '30' }} />
          ),
          table: ({ children }) => (
            <div className="producto-table-wrap">
              <table className="producto-table">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ backgroundColor: style.color }}>{children}</thead>
          ),
          th: ({ children }) => (
            <th className="producto-th">{children}</th>
          ),
          td: ({ children }) => (
            <td className="producto-td">{children}</td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="producto-link"
              style={{ color: style.color }}
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="producto-code-block">
                  <code>{children}</code>
                </pre>
              );
            }
            return <code className="producto-code-inline">{children}</code>;
          },
        }}
      >
        {contenido}
      </ReactMarkdown>
    </div>
  );
}