'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  code: string;
  name: string;
  icon?: string;
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
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--bg-2)] transition-all duration-150 flex flex-wrap gap-1.5 items-center text-sm ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-[var(--line-2)]'
        } ${isOpen ? 'ring-2 ring-[var(--accent-dim)] border-[var(--accent)] bg-[var(--bg-1)]' : ''}`}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-xs text-[var(--text-3)]">{placeholder}</span>
        ) : (
          selectedOptions.map(opt => {
            const codeMatchesName = opt.code.toLowerCase() === opt.name.toLowerCase();
            return (
              <span
                key={opt.code}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent-dim)] text-[var(--accent)] rounded-lg text-xs font-mono font-medium border border-[var(--accent)]/20 shadow-2xs"
              >
                {opt.icon ? (
                  <>
                    <span className="text-sm leading-none">{opt.icon}</span>
                    <span>{opt.name}</span>
                  </>
                ) : codeMatchesName ? (
                  <span>{opt.name}</span>
                ) : (
                  <>
                    <span>{opt.code}</span>
                    <span className="opacity-40">·</span>
                    <span>{opt.name}</span>
                  </>
                )}
                {!disabled && (
                  <button
                    onClick={(e) => removeOption(opt.code, e)}
                    className="ml-1 text-[var(--accent)] hover:opacity-80 active:scale-90 transition-transform font-bold leading-none cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>

      {isOpen && !disabled && (
        <div
          className="absolute top-[calc(100%+6px)] left-0 right-0 max-h-[300px] rounded-xl border border-[var(--line)] bg-[var(--surface-elevated,var(--bg-1))] text-[var(--text)] shadow-[0_12px_36px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl z-[1000] flex flex-col overflow-hidden"
        >
          <div className="p-2 border-b border-[var(--line)] bg-[var(--bg-1)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] text-[var(--text)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="overflow-y-auto max-h-[240px] divide-y divide-[var(--line)]/50">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-3)]">
                No options found
              </div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.code}
                  onClick={() => toggleOption(option.code)}
                  className={`px-3 py-2.5 cursor-pointer flex items-center gap-2.5 text-xs transition-colors ${
                    value.includes(option.code) ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'hover:bg-[var(--bg-2)] text-[var(--text)]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      value.includes(option.code)
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : 'border-[var(--line-2)] bg-[var(--bg-1)]'
                    }`}
                  >
                    {value.includes(option.code) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    {option.icon ? (
                      <span className="text-sm leading-none">{option.icon}</span>
                    ) : option.code.toLowerCase() !== option.name.toLowerCase() && (
                      <span className="font-mono text-[11px] font-semibold text-[var(--accent)]">
                        {option.code}
                      </span>
                    )}
                    <span className="font-normal">
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
