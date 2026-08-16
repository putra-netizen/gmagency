import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Check, RotateCcw } from 'lucide-react';

export interface TimeFilterConfig {
  mode: 'all' | 'today' | 'week' | 'month' | 'custom';
  startDate?: Date | null;
  endDate?: Date | null;
}

export function getDefaultMonthRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

export function isWithinCustomTimeframe(
  createdAtStr: string | undefined,
  config: TimeFilterConfig | string
): boolean {
  if (!createdAtStr) return false;
  const dateObj = new Date(createdAtStr);
  if (isNaN(dateObj.getTime())) return false;
  const now = new Date();

  if (typeof config === 'string') {
    if (config === 'all') return true;
    if (config === 'today') {
      return (
        dateObj.getDate() === now.getDate() &&
        dateObj.getMonth() === now.getMonth() &&
        dateObj.getFullYear() === now.getFullYear()
      );
    }
    const diffTime = Math.abs(now.getTime() - dateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (config === 'week') return diffDays <= 7;
    if (config === 'month') {
      const { startDate, endDate } = getDefaultMonthRange();
      return dateObj >= startDate && dateObj <= endDate;
    }
    return true;
  }

  const { mode, startDate, endDate } = config;
  if (mode === 'all') return true;

  if (mode === 'today') {
    return (
      dateObj.getDate() === now.getDate() &&
      dateObj.getMonth() === now.getMonth() &&
      dateObj.getFullYear() === now.getFullYear()
    );
  }

  if (mode === 'week') {
    const diffTime = Math.abs(now.getTime() - dateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }

  if (mode === 'month' || mode === 'custom') {
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return dateObj >= start && dateObj <= end;
    }
    const defaultRange = getDefaultMonthRange();
    return dateObj >= defaultRange.startDate && dateObj <= defaultRange.endDate;
  }

  return true;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthlyDateRangePickerProps {
  value: TimeFilterConfig;
  onChange: (newValue: TimeFilterConfig) => void;
  currentLang?: 'id' | 'en';
}

export const MonthlyDateRangePicker: React.FC<MonthlyDateRangePickerProps> = ({
  value,
  onChange,
  currentLang = 'id'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default left month to current month, right month to next month
  const now = new Date();
  const [leftYear, setLeftYear] = useState(now.getFullYear());
  const [leftMonth, setLeftMonth] = useState(now.getMonth());

  // Calculating right month (left month + 1)
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;

  // Temporary selection inside modal
  const [tempStartDate, setTempStartDate] = useState<Date | null>(() => {
    if (value.startDate) return new Date(value.startDate);
    return getDefaultMonthRange().startDate;
  });
  const [tempEndDate, setTempEndDate] = useState<Date | null>(() => {
    if (value.endDate) return new Date(value.endDate);
    return getDefaultMonthRange().endDate;
  });

  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Sync state when props or modal opens
  useEffect(() => {
    if (isOpen) {
      if (value.startDate) {
        setTempStartDate(new Date(value.startDate));
        setLeftYear(new Date(value.startDate).getFullYear());
        setLeftMonth(new Date(value.startDate).getMonth());
      } else {
        const def = getDefaultMonthRange();
        setTempStartDate(def.startDate);
        setLeftYear(def.startDate.getFullYear());
        setLeftMonth(def.startDate.getMonth());
      }

      if (value.endDate) {
        setTempEndDate(new Date(value.endDate));
      } else {
        setTempEndDate(getDefaultMonthRange().endDate);
      }
    }
  }, [isOpen, value]);

  // Close when clicking outside
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

  // Navigation handlers
  const handlePrevYear = () => setLeftYear(prev => prev - 1);
  const handleNextYear = () => setLeftYear(prev => prev + 1);
  const handlePrevMonth = () => {
    if (leftMonth === 0) {
      setLeftMonth(11);
      setLeftYear(prev => prev - 1);
    } else {
      setLeftMonth(prev => prev - 1);
    }
  };
  const handleNextMonth = () => {
    if (leftMonth === 11) {
      setLeftMonth(0);
      setLeftYear(prev => prev + 1);
    } else {
      setLeftMonth(prev => prev + 1);
    }
  };

  // Quick preset selectors
  const applyPresetMonth = (monthOffset: number = 0) => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - monthOffset);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    
    setTempStartDate(start);
    setTempEndDate(end);
    setLeftYear(y);
    setLeftMonth(m);
  };

  const applyPresetThisYear = () => {
    const y = new Date().getFullYear();
    const start = new Date(y, 0, 1, 0, 0, 0, 0);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    setTempStartDate(start);
    setTempEndDate(end);
    setLeftYear(y);
    setLeftMonth(0);
  };

  // Calendar Day Click Logic
  const handleDayClick = (dayDate: Date) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      // Start fresh selection
      setTempStartDate(dayDate);
      setTempEndDate(null);
    } else {
      // We have start, setting end
      if (dayDate < tempStartDate) {
        setTempEndDate(tempStartDate);
        setTempStartDate(dayDate);
      } else {
        setTempEndDate(dayDate);
      }
    }
  };

  const handleApply = () => {
    let finalStart = tempStartDate;
    let finalEnd = tempEndDate;

    if (!finalStart && !finalEnd) {
      const def = getDefaultMonthRange();
      finalStart = def.startDate;
      finalEnd = def.endDate;
    } else if (finalStart && !finalEnd) {
      finalEnd = new Date(finalStart.getFullYear(), finalStart.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    onChange({
      mode: 'month',
      startDate: finalStart,
      endDate: finalEnd
    });
    setIsOpen(false);
  };

  const handleModeSelect = (mode: 'all' | 'today' | 'week' | 'month') => {
    if (mode === 'month') {
      const def = getDefaultMonthRange();
      onChange({
        mode: 'month',
        startDate: value.startDate || def.startDate,
        endDate: value.endDate || def.endDate
      });
      setIsOpen(true);
    } else {
      onChange({
        mode,
        startDate: null,
        endDate: null
      });
      setIsOpen(false);
    }
  };

  // Date Formatting helper
  const formatDateShort = (d?: Date | null) => {
    if (!d) return '-';
    const day = d.getDate();
    const months = currentLang === 'id' ? MONTH_NAMES_ID : MONTH_NAMES_EN;
    const month = months[d.getMonth()].substring(0, 3);
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Helper to render a month grid
  const renderCalendarMonth = (year: number, month: number, isRightMonth: boolean = false) => {
    const months = currentLang === 'id' ? MONTH_NAMES_ID : MONTH_NAMES_EN;
    const monthName = months[month];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

    const dayCells = [];

    // Empty padding for previous month days
    for (let i = 0; i < firstDayOfWeek; i++) {
      dayCells.push(
        <div key={`empty-${i}`} className="h-8 w-8 text-center text-slate-300 text-xs flex items-center justify-center select-none opacity-20">
          •
        </div>
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);

      const isStart = tempStartDate && 
        currentDate.getFullYear() === tempStartDate.getFullYear() &&
        currentDate.getMonth() === tempStartDate.getMonth() &&
        currentDate.getDate() === tempStartDate.getDate();

      const isEnd = tempEndDate && 
        currentDate.getFullYear() === tempEndDate.getFullYear() &&
        currentDate.getMonth() === tempEndDate.getMonth() &&
        currentDate.getDate() === tempEndDate.getDate();

      // Is within selected range
      let isInRange = false;
      if (tempStartDate && tempEndDate) {
        const start = new Date(tempStartDate);
        start.setHours(0,0,0,0);
        const end = new Date(tempEndDate);
        end.setHours(23,59,59,999);
        isInRange = currentDate >= start && currentDate <= end;
      } else if (tempStartDate && hoverDate && !tempEndDate) {
        const start = tempStartDate < hoverDate ? tempStartDate : hoverDate;
        const end = tempStartDate < hoverDate ? hoverDate : tempStartDate;
        isInRange = currentDate >= start && currentDate <= end;
      }

      const isToday = 
        currentDate.getDate() === now.getDate() &&
        currentDate.getMonth() === now.getMonth() &&
        currentDate.getFullYear() === now.getFullYear();

      let dayClasses = "h-8 w-8 text-xs rounded-lg flex items-center justify-center font-medium cursor-pointer transition-all duration-150 relative ";

      if (isStart || isEnd) {
        dayClasses += "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 scale-105 z-10 ";
      } else if (isInRange) {
        dayClasses += "bg-blue-100/80 text-blue-800 font-semibold rounded-none first:rounded-l-lg last:rounded-r-lg ";
      } else if (isToday) {
        dayClasses += "bg-blue-50 text-blue-600 font-bold border border-blue-300 ";
      } else {
        dayClasses += "text-slate-700 hover:bg-blue-50 hover:text-blue-600 ";
      }

      dayCells.push(
        <button
          key={`day-${day}`}
          type="button"
          onClick={() => handleDayClick(currentDate)}
          onMouseEnter={() => setHoverDate(currentDate)}
          onMouseLeave={() => setHoverDate(null)}
          className={dayClasses}
        >
          {day}
        </button>
      );
    }

    const weekHeaders = currentLang === 'id' 
      ? ['M', 'S', 'S', 'R', 'K', 'J', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
      <div className="flex-1 min-w-[240px]">
        {/* Header navigation */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1">
            {!isRightMonth && (
              <>
                <button
                  type="button"
                  onClick={handlePrevYear}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  title="Tahun Lalu"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  title="Bulan Lalu"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          <span className="font-bold text-slate-800 text-sm tracking-tight">
            {monthName} {year}
          </span>

          <div className="flex items-center gap-1">
            {isRightMonth && (
              <>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  title="Bulan Depan"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextYear}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  title="Tahun Depan"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 mb-1 text-center">
          {weekHeaders.map((h, i) => (
            <span key={i} className="text-[11px] font-bold text-slate-400 h-6 flex items-center justify-center uppercase">
              {h}
            </span>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {dayCells}
        </div>
      </div>
    );
  };

  // Compute text for main button
  const getButtonText = () => {
    if (value.mode === 'all') return currentLang === 'id' ? 'SEMUA' : 'ALL';
    if (value.mode === 'today') return currentLang === 'id' ? 'HARI INI' : 'TODAY';
    if (value.mode === 'week') return currentLang === 'id' ? 'MINGGU INI' : 'WEEK';
    
    // Month / Custom mode
    const start = value.startDate || getDefaultMonthRange().startDate;
    const end = value.endDate || getDefaultMonthRange().endDate;
    return `${formatDateShort(start)} - ${formatDateShort(end)}`;
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-slate-200/90 shadow-sm text-xs w-full sm:w-auto hover:border-blue-300 transition-all">
        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Waktu:</span>
        
        {/* Mode selector */}
        <select
          value={value.mode === 'custom' ? 'month' : value.mode}
          onChange={(e) => handleModeSelect(e.target.value as any)}
          className="bg-transparent text-slate-800 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
        >
          <option value="all">{currentLang === 'id' ? 'SEMUA' : 'ALL'}</option>
          <option value="today">{currentLang === 'id' ? 'HARI INI' : 'TODAY'}</option>
          <option value="week">{currentLang === 'id' ? 'MINGGU INI' : 'WEEK'}</option>
          <option value="month">{currentLang === 'id' ? 'RENTANG BULAN / CUSTOM' : 'MONTHLY RANGE'}</option>
        </select>

        {/* Active Range Pill Button (Opens Modal/Popover) */}
        {(value.mode === 'month' || value.mode === 'custom') && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-200 transition-all text-[11px] shadow-xs active:scale-95 cursor-pointer ml-1"
            title="Klik untuk memilih rentang tanggal/bulan"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{getButtonText()}</span>
          </button>
        )}
      </div>

      {/* Popover / Calendar Modal */}
      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-[340px] md:w-[620px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-4 md:p-5 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 leading-tight">
                  {currentLang === 'id' ? 'Pilih Rentang Bulan / Waktu' : 'Select Month / Date Range'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Default: Tanggal 1 s/d Akhir Bulan
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Month Presets Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-slate-100 scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Pintasan:</span>
            <button
              type="button"
              onClick={() => applyPresetMonth(0)}
              className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shadow-xs"
            >
              Bulan Ini (Default)
            </button>
            <button
              type="button"
              onClick={() => applyPresetMonth(1)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => applyPresetMonth(2)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              2 Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => applyPresetMonth(3)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              3 Bulan Lalu
            </button>
            <button
              type="button"
              onClick={applyPresetThisYear}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Tahun Ini
            </button>
          </div>

          {/* Dual Calendar Grid */}
          <div className="flex flex-col md:flex-row gap-6 mb-4">
            {renderCalendarMonth(leftYear, leftMonth, false)}
            <div className="hidden md:block w-px bg-slate-100" />
            <div className="hidden md:block flex-1">
              {renderCalendarMonth(rightYear, rightMonth, true)}
            </div>
          </div>

          {/* Active Range Preview & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl">
            <div className="text-xs text-slate-700 font-medium flex items-center gap-2 w-full sm:w-auto">
              <span className="font-bold text-slate-400 text-[10px] uppercase">Rentang:</span>
              <span className="font-bold text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-md border border-blue-200/60 font-mono text-[11px]">
                {formatDateShort(tempStartDate)} — {formatDateShort(tempEndDate)}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  const def = getDefaultMonthRange();
                  setTempStartDate(def.startDate);
                  setTempEndDate(def.endDate);
                  setLeftYear(def.startDate.getFullYear());
                  setLeftMonth(def.startDate.getMonth());
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/80 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {currentLang === 'id' ? 'Terapkan Filter' : 'Apply Filter'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
