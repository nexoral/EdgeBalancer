'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  code: string;
  name: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect({ options, value, onChange, placeholder = 'Select...', disabled = false }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(search.toLowerCase()) ||
    option.code.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter(v => v !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const removeOption = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== code));
  };

  const selectedOptions = options.filter(opt => value.includes(opt.code));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          minHeight: 44,
          padding: '8px 12px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          background: disabled ? 'var(--bg-3)' : 'var(--bg-1)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          fontSize: 13,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {selectedOptions.length === 0 ? (
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{placeholder}</span>
        ) : (
          selectedOptions.map(opt => (
            <span
              key={opt.code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--mono)',
              }}
            >
              <span>{opt.code}</span>
              <span style={{ color: 'var(--text-2)' }}>·</span>
              <span style={{ fontFamily: 'inherit' }}>{opt.name}</span>
              {!disabled && (
                <button
                  onClick={(e) => removeOption(opt.code, e)}
                  style={{
                    marginLeft: 2,
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 280,
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid var(--line)',
                borderRadius: 4,
                background: 'var(--bg-2)',
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 220 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                No options found
              </div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.code}
                  onClick={() => toggleOption(option.code)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderBottom: '1px solid var(--line)',
                    background: value.includes(option.code) ? 'var(--accent-dim)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!value.includes(option.code)) {
                      e.currentTarget.style.background = 'var(--bg-2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!value.includes(option.code)) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: `2px solid ${value.includes(option.code) ? 'var(--accent)' : 'var(--line)'}`,
                      borderRadius: 3,
                      background: value.includes(option.code) ? 'var(--accent)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {value.includes(option.code) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>
                      {option.code}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>
                      {option.name}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
