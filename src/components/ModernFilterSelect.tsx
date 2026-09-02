import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Filter } from 'lucide-react';

export interface ModernFilterOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface ModernFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ModernFilterOption[];
  icon?: React.ReactNode;
  glowColor?: 'purple' | 'indigo' | 'blue' | 'emerald' | 'amber' | 'slate';
  placeholder?: string;
  id?: string;
  className?: string;
}

export const ModernFilterSelect: React.FC<ModernFilterSelectProps> = ({
  value,
  onChange,
  options,
  icon,
  glowColor = 'purple',
  placeholder = 'Pilih Filter',
  id,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Glow / Backlight styles matching modern UI with soft ambient luminescence
  const glowClasses = {
    purple:
      'border-purple-300/80 bg-white shadow-[0_0_16px_rgba(168,85,247,0.2)] hover:shadow-[0_0_22px_rgba(168,85,247,0.32)] hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-400/20',
    indigo:
      'border-indigo-200/90 bg-white shadow-[0_0_16px_rgba(99,102,241,0.18)] hover:shadow-[0_0_22px_rgba(99,102,241,0.3)] hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
    blue:
      'border-blue-200/90 bg-white shadow-[0_0_16px_rgba(59,130,246,0.18)] hover:shadow-[0_0_22px_rgba(59,130,246,0.3)] hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20',
    emerald:
      'border-emerald-200/90 bg-white shadow-[0_0_16px_rgba(16,185,129,0.18)] hover:shadow-[0_0_22px_rgba(16,185,129,0.3)] hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20',
    amber:
      'border-amber-200/90 bg-white shadow-[0_0_16px_rgba(245,158,11,0.18)] hover:shadow-[0_0_22px_rgba(245,158,11,0.3)] hover:border-amber-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20',
    slate:
      'border-slate-200/90 bg-white shadow-[0_0_14px_rgba(100,116,139,0.14)] hover:shadow-[0_0_20px_rgba(100,116,139,0.22)] hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20',
  }[glowColor];

  const defaultIconColor = {
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    slate: 'text-slate-600',
  }[glowColor];

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef} id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`group flex items-center justify-between gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full border transition-all duration-200 cursor-pointer select-none text-xs sm:text-sm font-semibold text-slate-800 ${glowClasses}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 shrink-0">
          {icon ? (
            <span className="shrink-0 flex items-center justify-center">{icon}</span>
          ) : (
            <Filter className={`w-4 h-4 shrink-0 ${defaultIconColor}`} />
          )}
          <span className="truncate max-w-[140px] sm:max-w-[190px] font-semibold text-slate-800 font-sans">
            {displayLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-slate-800' : 'group-hover:text-slate-700'
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 min-w-[200px] sm:min-w-[220px] max-w-[280px] max-h-[320px] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 z-[100] animate-in fade-in zoom-in-95 duration-150 scrollbar-thin">
          <div className="py-1" role="listbox">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-purple-50 text-purple-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon && (
                      <span className="shrink-0 text-slate-500">{option.icon}</span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {option.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {option.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
