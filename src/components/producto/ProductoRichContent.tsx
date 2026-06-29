'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TipoBoletin } from '@/types/bulletin';
import { ALL_PRODUCTS } from '@/constants/nav';

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

  return (
    <div className={`producto-rich-content ${className}`}>
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