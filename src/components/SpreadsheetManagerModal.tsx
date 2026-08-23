import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Link as LinkIcon,
  CloudUpload,
  Code2,
  Copy,
  Check,
  Zap,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapsReview, ShopeeOrder, Order } from '../types';
import { 
  getSpreadsheetConfig, 
  saveSpreadsheetConfig, 
  syncFromGoogleSheetsUrl
} from '../utils/spreadsheetIntegration';
import { 
  getSheetsSyncConfig, 
  saveSheetsSyncConfig, 
  triggerBatchMapsReviewsSync, 
  getGoogleAppsScriptTemplate,
  DEFAULT_SHEETS_WEBHOOK_URL
} from '../utils/sheetsSyncHelper';
import { dbCreateMapsReview, dbUpdateMapsReview, updateLocalStorageMapsReview } from '../lib/supabase';
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
  mapsReviews,
  onDataUpdated,
  onRefreshData,
}: SpreadsheetManagerModalProps) {
  const handleDataRefresh = () => {
    if (onRefreshData) onRefreshData();
    if (onDataUpdated) onDataUpdated();
  };

  const [sheetConfig, setSheetConfig] = useState(() => getSpreadsheetConfig());
  const [webhookConfig, setWebhookConfig] = useState(() => getSheetsSyncConfig());
  
  const [sheetUrlInput, setSheetUrlInput] = useState(sheetConfig.sheetUrl);
  const [webhookUrlInput, setWebhookUrlInput] = useState(webhookConfig.webhookUrl || DEFAULT_SHEETS_WEBHOOK_URL);

  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  
  const [showScriptGuide, setShowScriptGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  if (!isOpen) return null;

  // 1. PULL DATA DARI GOOGLE SPREADSHEET
  const handlePullFromSheets = async () => {
    const rawUrl = (sheetUrlInput || '').trim();
    if (!rawUrl) {
      setSyncResult({
        success: false,
        message: 'Mohon masukkan link Google Spreadsheet terlebih dahulu.'
      });
      return;
    }

    setIsPulling(true);
    setSyncResult(null);

    try {
      const updated = saveSpreadsheetConfig({ sheetUrl: rawUrl, lastSyncedAt: new Date().toISOString() });
      setSheetConfig(updated);

      const result = await syncFromGoogleSheetsUrl(rawUrl, (msg) => {
        setSyncResult({ success: true, message: msg });
      });

      if (result.items && result.items.length > 0) {
        for (const item of result.items) {
          updateLocalStorageMapsReview(item);
          try {
            await dbUpdateMapsReview(item.id, item);
          } catch (e) {
            try {
              await dbCreateMapsReview(item);
            } catch (err) {
              console.warn('DB save notice during pull:', err);
            }
          }
        }
      }

      setSyncResult({
        success: true,
        message: result.message || `Berhasil menyinkronkan ${result.count} data dari Google Spreadsheet!`,
        count: result.count
      });

      handleDataRefresh();
    } catch (err: any) {
      console.error('Pull sync error:', err);
      setSyncResult({
        success: false,
        message: err.message || 'Gagal menarik data dari Spreadsheet. Pastikan akses disetel ke Publik (Viewer).'
      });
    } finally {
      setIsPulling(false);
    }
  };

  // 2. PUSH / KIRIM SEMUA DATA WEB KE SPREADSHEET
  const handlePushAllToSheets = async () => {
    if (mapsReviews.length === 0) {
      setSyncResult({
        success: false,
        message: 'Tidak ada data Maps Review di website untuk dikirim.'
      });
      return;
    }

    const cleanWebhook = (webhookUrlInput || '').trim();
    if (!cleanWebhook.startsWith('http')) {
      setSyncResult({
        success: false,
        message: 'Mohon masukkan URL Webhook Google Apps Script yang valid terlebih dahulu.'
      });
      return;
    }

    // Save webhook config
    saveSheetsSyncConfig({ enabled: true, webhookUrl: cleanWebhook });
    setWebhookConfig({ enabled: true, webhookUrl: cleanWebhook });

    setIsPushing(true);
    setSyncResult(null);

    try {
      const res = await triggerBatchMapsReviewsSync(mapsReviews);
      if (res.success) {
        const updated = saveSpreadsheetConfig({ lastSyncedAt: new Date().toISOString() });
        setSheetConfig(updated);
        setSyncResult({
          success: true,
          message: res.message || `Berhasil mengirim ${mapsReviews.length} data ke Google Spreadsheet!`,
          count: mapsReviews.length
        });
      } else {
        setSyncResult({
          success: false,
          message: res.message || 'Gagal mengirim data ke Spreadsheet. Pastikan URL Webhook Apps Script aktif dan fungsi doPost sudah dideploy.'
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Terjadi kesalahan saat mengirim data ke Spreadsheet.'
      });
    } finally {
      setIsPushing(false);
    }
  };

  // 3. TEST KONEKSI WEBHOOK APPS SCRIPT
  const handleTestWebhook = async () => {
    const cleanWebhook = (webhookUrlInput || '').trim();
    if (!cleanWebhook.startsWith('http')) {
      toast.error('Masukkan URL Webhook Google Apps Script terlebih dahulu!');
      return;
    }

    setIsTestingWebhook(true);
    try {
      const res = await fetch('/api/sheets/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: cleanWebhook })
      });
      const data = await res.json();
      if (data.hasDoPost) {
        toast.success(data.message || 'Webhook Google Apps Script aktif dan siap!');
      } else {
        toast.error(data.message || 'Fungsi doPost belum terpasang di Google Apps Script!');
      }
    } catch (e: any) {
      toast.error('Gagal menguji webhook: ' + e.message);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyScript = () => {
    const script = getGoogleAppsScriptTemplate();
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    toast.success('Kode Google Apps Script berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        id="spreadsheet-sync-modal"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Sinkronisasi Google Spreadsheet
                </h2>
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Realtime Dual-Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Tarik data dari Spreadsheet (Pull) atau kirim data pesanan website ke Spreadsheet (Push).
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
          {/* Link Spreadsheet Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>1. Tautan Google Spreadsheet</span>
              </label>
              {sheetUrlInput && (
                <a
                  href={sheetUrlInput}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="relative">
              <LinkIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full pl-10 pr-4 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="bg-slate-100/80 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <Info className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Akses Publik Spreadsheet:</strong> Di Google Sheets, klik <strong>Bagikan (Share)</strong> di pojok kanan atas, lalu ubah Akses Umum menjadi <strong>"Siapa saja yang memiliki link"</strong> sebagai <strong>Pelihat (Viewer)</strong>.
              </span>
            </div>
          </div>

          {/* Webhook Apps Script Input */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>2. Webhook Google Apps Script (Untuk Kirim / Push Data)</span>
              </label>
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={isTestingWebhook}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Zap className={`h-3 w-3 ${isTestingWebhook ? 'animate-spin' : ''}`} />
                <span>{isTestingWebhook ? 'Menguji...' : 'Uji Koneksi Webhook'}</span>
              </button>
            </div>

            <div className="relative">
              <LinkIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full pl-10 pr-4 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Action Buttons: Tarik (Pull) & Kirim (Push) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handlePullFromSheets}
              disabled={isPulling || isPushing}
              className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isPulling ? 'animate-spin' : ''}`} />
              <span>{isPulling ? 'Menarik Data...' : 'Tarik Data dari Sheet (Pull)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePushAllToSheets}
              disabled={isPulling || isPushing}
              className="px-5 py-3.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 transition-all cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className={`h-4 w-4 ${isPushing ? 'animate-bounce' : ''}`} />
              <span>{isPushing ? 'Mengirim Data...' : `Kirim Semua ke Sheet (${mapsReviews.length})`}</span>
            </button>
          </div>

          {/* Sync Result Alert */}
          {syncResult && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-fade-in ${
              syncResult.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}>
              {syncResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-xs font-bold leading-relaxed">{syncResult.message}</p>
                {sheetConfig.lastSyncedAt && (
                  <p className="text-[10px] opacity-75 mt-1 font-mono">
                    Waktu: {new Date(sheetConfig.lastSyncedAt).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Apps Script Code & Deployment Guide */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={() => setShowScriptGuide(!showScriptGuide)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Code2 className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Panduan & Kode Google Apps Script (Agar Push Berfungsi)
                </span>
              </div>
              {showScriptGuide ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            <AnimatePresence>
              {showScriptGuide && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 pt-0 space-y-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300"
                >
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-300">
                    <strong>Penting:</strong> Jika saat kirim data muncul error <em>"Script function not found: doPost"</em>, artinya kode di Google Apps Script Anda perlu diganti dengan kode di bawah ini lalu dideploy ulang.
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Langkah Pemasangan 3 Menit:</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
                      <li>Buka Google Spreadsheet Anda, klik menu <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.</li>
                      <li>Hapus semua isi file kode yang ada, lalu <strong>Tempel (Paste)</strong> kode yang Anda salin dari tombol di bawah.</li>
                      <li>Klik ikon <strong>Simpan (Save)</strong>.</li>
                      <li>Klik tombol biru <strong>Terapkan (Deploy)</strong> di kanan atas &gt; <strong>Penerapan baru (New deployment)</strong>.</li>
                      <li>Pilih jenis <strong>Aplikasi Web (Web App)</strong>:
                        <ul className="list-disc list-inside ml-4 mt-0.5">
                          <li>Jalankan sebagai: <strong>Saya (Me)</strong></li>
                          <li>Siapa yang memiliki akses: <strong>Siapa saja (Anyone)</strong></li>
                        </ul>
                      </li>
                      <li>Klik <strong>Terapkan (Deploy)</strong> dan salin URL Web App yang berakhiran <code>/exec</code> ke kolom Webhook di atas.</li>
                    </ol>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      {copiedScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Kode Google Apps Script'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Total Data Maps Review: <strong>{mapsReviews.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}
