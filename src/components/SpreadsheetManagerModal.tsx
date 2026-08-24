import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  X, 
  Code2, 
  Copy, 
  Check, 
  Download, 
  CheckCircle2, 
  ShieldCheck,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { MapsReview, ShopeeOrder, Order } from '../types';
import { generateBuildAllTablesAppsScript } from '../utils/spreadsheetIntegration';
import { toast } from '../utils/toast';

interface SpreadsheetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapsReviews: MapsReview[];
  shopeeOrders: ShopeeOrder[];
  orders: Order[];
  onDataUpdated?: () => void;
  onRefreshData?: () => void;
  currentLang?: string;
  initialTab?: string;
}

export function SpreadsheetManagerModal({
  isOpen,
  onClose,
  mapsReviews = [],
  shopeeOrders = [],
}: SpreadsheetManagerModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const buildAllScriptCode = generateBuildAllTablesAppsScript(mapsReviews, shopeeOrders, originUrl);

  const handleCopy = () => {
    navigator.clipboard.writeText(buildAllScriptCode);
    setCopied(true);
    toast.success('Kode Google Apps Script berhasil disalin!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadGs = () => {
    const blob = new Blob([buildAllScriptCode], { type: 'application/javascript;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'GM_Agency_BuildAllTables.gs';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('File GM_Agency_BuildAllTables.gs berhasil diunduh!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        id="spreadsheet-sync-modal"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20 shadow-sm">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Sinkronisasi Google Spreadsheet
                </h2>
                <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {mapsReviews.length} Data Maps
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Metode 1-Klik Resmi: Mengisi seluruh tabel & format status otomatis dalam 1 detik tanpa timeout.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Highlight Card */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
            <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <span>Data Snapshot Siap Pakai ({mapsReviews.length} Data Maps)</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.2 rounded-full font-bold">
                  Bebas Timeout
                </span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Seluruh ratusan baris ulasan Maps beserta daftar akun worker progresnya sudah terkemas rapi di dalam kode di bawah. Cukup salin dan jalankan di Apps Script.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Kode Google Apps Script (.gs)</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Fungsi eksekusi: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-600 dark:text-emerald-400">buildAllTables</code>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadGs}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh File .gs</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition-all"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Berhasil Disalin!' : 'Salin Kode .GS Lengkap'}</span>
              </button>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 font-mono text-[11px] text-slate-200 shadow-inner">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Code2 className="h-3.5 w-3.5" />
                GM_Agency_BuildAllTables.gs
              </span>
              <span>{mapsReviews.length} Data Maps | {shopeeOrders.length} Data Shopee</span>
            </div>
            <pre className="p-4 overflow-x-auto max-h-48 text-emerald-300/90 whitespace-pre leading-relaxed select-all">
              {buildAllScriptCode.slice(0, 1600)}...
            </pre>
          </div>

          {/* Step by Step Guide */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>3 Langkah Mudah Mengisi Spreadsheet:</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700/80 text-xs space-y-1">
                <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[11px]">1</span>
                  <span>Buka Apps Script</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Di Google Sheet Anda, klik menu <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700/80 text-xs space-y-1">
                <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[11px]">2</span>
                  <span>Paste &amp; Simpan</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Hapus kode lama di editor, <strong>Paste (Ctrl+V)</strong> kode yang Anda salin, lalu klik <strong>Simpan (Ctrl+S)</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700/80 text-xs space-y-1">
                <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[11px]">3</span>
                  <span>Klik Run ▶️</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Pilih fungsi <strong>buildAllTables</strong> di atas lalu klik <strong>Jalankan (Run)</strong>. Selesai instan!
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span>Format tabel rapi, dropdown status, &amp; data akun reviewer otomatis terisi penuh.</span>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-black rounded-xl text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}
