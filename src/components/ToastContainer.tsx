import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastEventDetail, ToastType } from '../utils/toast';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEventDetail>;
      if (!customEvent.detail) return;

      const { message, type, duration = 3000 } = customEvent.detail;
      const id = Math.random().toString(36).substring(2, 9);

      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto remove
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };

    window.addEventListener('gm-toast', handleToastEvent);
    return () => {
      window.removeEventListener('gm-toast', handleToastEvent);
    };
  }, []);

  return (
    <div 
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      id="global-toast-container"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200';
          let icon = <Info className="h-4 w-4 text-blue-500" />;
          let accentBarColor = 'bg-blue-500';

          if (toast.type === 'success') {
            bgColor = 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-100 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100';
            icon = <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
            accentBarColor = 'bg-emerald-500';
          } else if (toast.type === 'error') {
            bgColor = 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-100 dark:border-rose-900/50 text-rose-900 dark:text-rose-100';
            icon = <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />;
            accentBarColor = 'bg-rose-500';
          } else if (toast.type === 'info') {
            bgColor = 'bg-blue-50/95 dark:bg-blue-950/90 border-blue-100 dark:border-blue-900/50 text-blue-900 dark:text-blue-100';
            icon = <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />;
            accentBarColor = 'bg-blue-500';
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.15 } }}
              layout
              className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md pointer-events-auto relative overflow-hidden select-none ${bgColor}`}
            >
              {icon}
              <div className="flex-1 text-xs font-semibold leading-relaxed pr-2">
                {toast.message}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              
              {/* Modern progress indicator line */}
              <motion.div 
                className={`absolute bottom-0 left-0 h-0.5 ${accentBarColor}`}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3, ease: 'linear' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
