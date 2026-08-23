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
  ChevronUp,
  Download,
  Terminal,
  Sparkles,
  Layers,
  TableProperties
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapsReview, ShopeeOrder, Order } from '../types';
import { 
  getSpreadsheetConfig, 
  saveSpreadsheetConfig, 
  syncFromGoogleSheetsUrl,
  generateDirectDataAppsScript,
  generateSpreadsheetMenuScript
} from '../utils/spreadsheetIntegration';
import { 
  getSheetsSyncConfig, 
  saveSheetsSyncConfig, 
  triggerBatchMapsReviewsSync, 
  getGoogleAppsScriptTemplate,
  DEFAULT_SHEETS_WEBHOOK_URL
} from '../utils/sheetsSyncHelper';
import { updateLocalStorageMapsReview } from '../lib/supabase';
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

  // Tabs: 'no-webhook' | 'pull' | 'webhook'
  const [activeTab, setActiveTab] = useState<'no-webhook' | 'pull' | 'webhook'>('no-webhook');
  const [noWebhookSubTab, setNoWebhookSubTab] = useState<'direct-data' | 'custom-menu' | 'formula'>('direct-data');

  const [sheetConfig, setSheetConfig] = useState(() => getSpreadsheetConfig());
  const [webhookConfig, setWebhookConfig] = useState(() => getSheetsSyncConfig());
  
  const [sheetUrlInput, setSheetUrlInput] = useState(sheetConfig.sheetUrl);
  const [webhookUrlInput, setWebhookUrlInput] = useState(webhookConfig.webhookUrl || DEFAULT_SHEETS_WEBHOOK_URL);

  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  
  const [copiedType, setCopiedType] = useState<string | null>(null);
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
        }
        handleDataRefresh();
      }

      setSyncResult({
        success: true,
        message: result.message || `Berhasil menyinkronkan ${result.count || 0} data dari Google Spreadsheet!`,
        count: result.count
      });
    } catch (err: any) {
      console.error('Pull from sheets error:', err);
      setSyncResult({
        success: false,
        message: err.message || 'Gagal menarik data dari Google Spreadsheet. Pastikan link disetel ke Publik (Viewer).'
      });
    } finally {
      setIsPulling(false);
    }
  };

  // 2. PUSH / KIRIM DATA KE GOOGLE SPREADSHEET VIA WEBHOOK
  const handlePushAllToSheets = async () => {
    if (!mapsReviews || mapsReviews.length === 0) {
      setSyncResult({
        success: false,
        message: 'Tidak ada data Maps Review yang dapat dikirim.'
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
      console.error('Push all error:', err);
      setSyncResult({
        success: false,
        message: 'Terjadi kesalahan: ' + err.message
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

  // Copy helpers
  const handleCopy = (text: string, typeName: string, successMsg: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(typeName);
    toast.success(successMsg);
    setTimeout(() => setCopiedType(null), 3000);
  };

  // Download .gs file helper
  const handleDownloadGsFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/javascript;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`File ${filename} berhasil diunduh!`);
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const exportCsvUrl = `${originUrl}/api/sheets/export-csv?type=maps_reviews`;
  const importFormula = `=IMPORTDATA("${exportCsvUrl}")`;

  const directScriptCode = generateDirectDataAppsScript(mapsReviews);
  const menuScriptCode = generateSpreadsheetMenuScript(originUrl);
  const webhookScriptCode = getGoogleAppsScriptTemplate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        id="spreadsheet-sync-modal"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20 shadow-sm">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Integrasi & Sinkronisasi Spreadsheet
                </h2>
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {mapsReviews.length} Data Maps
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Pilih metode sinkronisasi instan tanpa webhook atau gunakan webhook 2 arah.
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

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-6 pt-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('no-webhook')}
            className={`pb-3 px-3 text-xs font-black tracking-wide flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'no-webhook'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate Kode .GS (Tanpa Webhook)</span>
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-md">
              Rekomendasi
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pull')}
            className={`pb-3 px-3 text-xs font-black tracking-wide flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pull'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Tarik Data dari Sheet (Pull)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`pb-3 px-3 text-xs font-black tracking-wide flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'webhook'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>Webhook 2-Way Realtime</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* ================= TAB 1: GENERATE KODE GS TANPA WEBHOOK ================= */}
          {activeTab === 'no-webhook' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-4 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                    Alternatif Terbaik Tanpa Webhook / Tanpa Deploy Web App
                  </h4>
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300/90 leading-relaxed text-[11px]">
                    Metode ini 100% bebas dari error deploy atau URL webhook. Anda cukup menyalin script Google Apps Script (.gs) di bawah, lalu jalankan langsung di dalam Google Spreadsheet Anda.
                  </p>
                </div>
              </div>

              {/* Sub-tabs for No Webhook Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setNoWebhookSubTab('direct-data')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    noWebhookSubTab === 'direct-data'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <TableProperties className="h-4 w-4" />
                  <span>1. Script Isi Data Instan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNoWebhookSubTab('custom-menu')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    noWebhookSubTab === 'custom-menu'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>2. Menu Otomatis Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNoWebhookSubTab('formula')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    noWebhookSubTab === 'formula'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Terminal className="h-4 w-4" />
                  <span>3. Rumus =IMPORTDATA</span>
                </button>
              </div>

              {/* OPSI 1: SCRIPT ISI DATA INSTAN */}
              {noWebhookSubTab === 'direct-data' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Kode Google Script (.gs) Pengisi Data ({mapsReviews.length} Baris)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Kode ini sudah ditanam data Maps Review lengkap. Cukup Paste di Apps Script &amp; klik <strong>"Jalankan" (Run)</strong>.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadGsFile('GM_Agency_IsiData.gs', directScriptCode)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh .gs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(directScriptCode, 'direct-script', 'Kode .GS Pengisi Data berhasil disalin!')}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                      >
                        {copiedType === 'direct-script' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedType === 'direct-script' ? 'Tersalin!' : 'Salin Kode .GS'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Box */}
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 font-mono text-[11px] text-slate-200 shadow-inner">
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                        GM_Agency_IsiData.gs (Fungsi: isiDataSpreadsheetOtomatis)
                      </span>
                      <span>{mapsReviews.length} Data Records</span>
                    </div>
                    <pre className="p-4 overflow-x-auto max-h-48 text-emerald-300/90 whitespace-pre leading-relaxed select-all">
                      {directScriptCode.slice(0, 1200)}...
                      {'\n\n// ... dan ' + mapsReviews.length + ' data baris lainnya'}
                    </pre>
                  </div>

                  {/* Petunjuk Langkah */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Cara Menjalankan Script di Spreadsheet:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px] pl-1">
                      <li>Buka Google Spreadsheet Anda, klik menu <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.</li>
                      <li>Hapus semua teks yang ada di editor, lalu <strong>Tempel (Paste)</strong> kode yang baru Anda salin.</li>
                      <li>Klik ikon <strong>Simpan (Save / Ctrl+S)</strong>.</li>
                      <li>Di bagian atas editor, pastikan fungsi <strong>isiDataSpreadsheetOtomatis</strong> terpilih, lalu klik <strong>Jalankan (Run)</strong>.</li>
                      <li>Selesai! Seluruh {mapsReviews.length} data Maps Review dan dropdown status otomatis terisi di Google Sheet.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* OPSI 2: MENU SINKRONISASI DI DALAM GOOGLE SPREADSHEET */}
              {noWebhookSubTab === 'custom-menu' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Kode Google Script: Tambah Tombol Menu di Google Sheet
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Menambahkan Menu <strong>"🚀 GM Agency"</strong> di toolbar Spreadsheet untuk tarik data kapan saja.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadGsFile('GM_Agency_CustomMenu.gs', menuScriptCode)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh .gs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(menuScriptCode, 'menu-script', 'Kode Menu Google Apps Script berhasil disalin!')}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                      >
                        {copiedType === 'menu-script' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedType === 'menu-script' ? 'Tersalin!' : 'Salin Kode Menu .GS'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Box */}
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 font-mono text-[11px] text-slate-200 shadow-inner">
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                        GM_Agency_CustomMenu.gs (Fungsi: onOpen &amp; tarikDataDariWebAdmin)
                      </span>
                    </div>
                    <pre className="p-4 overflow-x-auto max-h-48 text-indigo-300/90 whitespace-pre leading-relaxed select-all">
                      {menuScriptCode}
                    </pre>
                  </div>

                  {/* Petunjuk Langkah */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                      Cara Mengaktifkan Menu di Spreadsheet:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px] pl-1">
                      <li>Buka Google Spreadsheet Anda, klik menu <strong>Ekstensi</strong> &gt; <strong>Apps Script</strong>.</li>
                      <li>Tempelkan kode di atas, lalu klik <strong>Simpan (Ctrl+S)</strong>.</li>
                      <li>Kembali ke Google Spreadsheet Anda lalu <strong>Muat Ulang (Refresh / F5)</strong> halaman.</li>
                      <li>Menu baru <strong>"🚀 GM Agency"</strong> akan muncul di toolbar atas. Cukup klik menu tersebut &gt; <strong>"🔄 Tarik Data Terbaru dari Web"</strong>.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* OPSI 3: FORMULA =IMPORTDATA */}
              {noWebhookSubTab === 'formula' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Rumus Google Spreadsheet Otomatis (=IMPORTDATA)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Tanpa script sama sekali! Cukup tempelkan formula ini di <strong>Sel A1</strong> di Google Sheet Anda.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={importFormula}
                      className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(importFormula, 'formula', 'Formula =IMPORTDATA berhasil disalin!')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all whitespace-nowrap"
                    >
                      {copiedType === 'formula' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedType === 'formula' ? 'Tersalin!' : 'Salin Formula'}</span>
                    </button>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-bold">Tips Penggunaan Formula:</p>
                    <p>Pastikan Sheet dalam keadaan kosong sebelum menempel formula di <strong>Sel A1</strong>. Google Spreadsheet akan otomatis mengisi seluruh tabel dan memperbarui datanya secara berkala.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: TARIK DARI LINK SHEET (PULL) ================= */}
          {activeTab === 'pull' && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Tautan Google Spreadsheet
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePullFromSheets}
                  disabled={isPulling}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isPulling ? 'animate-spin' : ''}`} />
                  <span>{isPulling ? 'Menarik Data dari Sheet...' : 'Tarik Data dari Spreadsheet Sekarang'}</span>
                </button>
              </div>

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
            </div>
          )}

          {/* ================= TAB 3: WEBHOOK 2-WAY REALTIME ================= */}
          {activeTab === 'webhook' && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Webhook Google Apps Script (Web App /exec)
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handlePushAllToSheets}
                  disabled={isPushing}
                  className="px-5 py-3.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className={`h-4 w-4 ${isPushing ? 'animate-bounce' : ''}`} />
                  <span>{isPushing ? 'Mengirim Data...' : `Kirim Semua ke Sheet (${mapsReviews.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(webhookScriptCode, 'webhook-script', 'Kode Apps Script Webhook berhasil disalin!')}
                  className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
                >
                  {copiedType === 'webhook-script' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedType === 'webhook-script' ? 'Tersalin!' : 'Salin Kode Webhook .GS'}</span>
                </button>
              </div>

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
                  </div>
                </div>
              )}
            </div>
          )}

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
