import React from 'react';

const renderInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} style={{ color: 'var(--text)', fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          style={{
            background: 'var(--bg-3)',
            color: 'var(--text)',
            padding: '1px 5px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

export function FormattedMessage({ content }: { content: string }) {
  if (!content) return null;

  const rawBlocks = content.trim().split(/\n\n+/);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rawBlocks.map((block, bIdx) => {
        const trimmed = block.trim();

        if (trimmed.startsWith('```')) {
          const codeLines = trimmed.split('\n');
          const lastLine = codeLines[codeLines.length - 1];
          const codeContent = codeLines.slice(1, lastLine.startsWith('```') ? -1 : undefined).join('\n');
          return (
            <pre
              key={bIdx}
              style={{
                background: 'var(--bg-3)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 6px)',
                overflowX: 'auto',
                fontSize: 12,
                border: '1px solid var(--line)',
                margin: '4px 0',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              <code>{codeContent}</code>
            </pre>
          );
        }

        const lines = trimmed.split('\n');

        return (
          <div key={bIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {lines.map((line, lIdx) => {
              if (/^\s*[-*]\s+/.test(line)) {
                return (
                  <div key={lIdx} style={{ display: 'flex', gap: 8, paddingLeft: 4 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0, lineHeight: 1.5 }}>•</span>
                    <span style={{ minWidth: 0, flex: 1, lineHeight: 1.55 }}>
                      {renderInline(line.replace(/^\s*[-*]\s+/, ''))}
                    </span>
                  </div>
                );
              }

              if (/^\s*(\d+)\.\s+/.test(line)) {
                const num = line.match(/^\s*(\d+)\.\s+/)?.[1] ?? '';
                return (
                  <div key={lIdx} style={{ display: 'flex', gap: 8, paddingLeft: 4 }}>
                    <span style={{ color: 'var(--text-3)', flexShrink: 0, minWidth: 16, lineHeight: 1.5 }}>{num}.</span>
                    <span style={{ minWidth: 0, flex: 1, lineHeight: 1.55 }}>
                      {renderInline(line.replace(/^\s*\d+\.\s+/, ''))}
                    </span>
                  </div>
                );
              }

              if (/^#{1,4}\s+/.test(line)) {
                return (
                  <div key={lIdx} style={{ fontWeight: 600, color: 'var(--text)', margin: '4px 0 2px', lineHeight: 1.4 }}>
                    {renderInline(line.replace(/^#{1,4}\s+/, ''))}
                  </div>
                );
              }

              return (
                <div key={lIdx} style={{ minHeight: line ? undefined : 6, lineHeight: 1.55 }}>
                  {renderInline(line)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
