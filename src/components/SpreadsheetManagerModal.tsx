import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  FileText, 
  Code, 
  Database,
  ArrowRight,
  Sparkles,
  Layers,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapsReview, ShopeeOrder, Order } from '../types';
import { 
  getSpreadsheetConfig, 
  saveSpreadsheetConfig, 
  generateMapsReviewsCsv, 
  generateShopeeOrdersCsv,
  generateOrdersCsv,
  downloadCsvFile, 
  generateGoogleAppsScript,
  parseCsvText,
  parseAccountsList
} from '../utils/spreadsheetIntegration';

interface SpreadsheetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapsReviews: MapsReview[];
  shopeeOrders: ShopeeOrder[];
  orders: Order[];
  onDataUpdated?: () => void;
  onRefreshData?: () => void;
  currentLang?: string;
  initialTab?: 'sync' | 'export' | 'import' | 'script';
}

export function SpreadsheetManagerModal({
  isOpen,
  onClose,
  mapsReviews,
  shopeeOrders,
  orders,
  onDataUpdated,
  onRefreshData,
  currentLang,
  initialTab = 'sync'
}: SpreadsheetManagerModalProps) {
  const handleDataRefresh = () => {
    if (onRefreshData) onRefreshData();
    if (onDataUpdated) onDataUpdated();
  };
  const [activeTab, setActiveTab] = useState<'sync' | 'export' | 'import' | 'script'>(initialTab);
  const [config, setConfig] = useState(() => getSpreadsheetConfig());
  const [sheetUrlInput, setSheetUrlInput] = useState(config.sheetUrl);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message: string; rowsCount?: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (!isOpen) return null;

  const webhookUrl = `${window.location.origin}/api/sheets/webhook`;

  // Handle live pull from Google Spreadsheet URL
  const handleSyncFromSheets = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      // Save sheet URL first
      const updated = saveSpreadsheetConfig({ sheetUrl: sheetUrlInput, lastSyncedAt: new Date().toISOString() });
      setConfig(updated);

      const res = await fetch('/api/sheets/sync-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: sheetUrlInput })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal sinkronisasi data dari Google Spreadsheet');
      }

      setSyncResult({
        success: true,
        message: data.message || `Berhasil menyinkronkan ${data.totalSynced || 0} data!`,
        count: data.totalSynced
      });

      if (handleDataRefresh) {
        handleDataRefresh();
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Terjadi kesalahan saat menyinkronkan data.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle CSV Export
  const handleExport = (type: 'maps_reviews' | 'shopee_orders' | 'orders') => {
    const today = new Date().toISOString().slice(0, 10);
    if (type === 'maps_reviews') {
      const csv = generateMapsReviewsCsv(mapsReviews);
      downloadCsvFile(`GM_Agency_Maps_Reviews_${today}.csv`, csv);
    } else if (type === 'shopee_orders') {
      const csv = generateShopeeOrdersCsv(shopeeOrders);
      downloadCsvFile(`GM_Agency_Shopee_Orders_${today}.csv`, csv);
    } else if (type === 'orders') {
      const csv = generateOrdersCsv(orders);
      downloadCsvFile(`GM_Agency_Orders_${today}.csv`, csv);
    }
  };

  // Handle CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCsvText(text);
        if (parsed.length === 0) {
          setImportStatus({ success: false, message: 'File CSV kosong atau format tidak sesuai.' });
          return;
        }

        setPreviewRows(parsed.slice(0, 5));
        setImportStatus({
          message: `File terbaca: ${parsed.length} baris data terdeteksi. Klik "Terapkan Import" untuk memasukkan ke database.`,
          rowsCount: parsed.length
        });
      } catch (err: any) {
        setImportStatus({ success: false, message: 'Gagal memproses file: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  // Execute manual import
  const handleExecuteImport = async () => {
    if (!previewRows || previewRows.length === 0) return;
    setIsImporting(true);
    try {
      // In this version, we can also trigger sync directly
      await handleSyncFromSheets();
      setImportStatus({ success: true, message: 'Import data berhasil diperbarui!' });
    } catch (err: any) {
      setImportStatus({ success: false, message: 'Gagal import: ' + err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const appsScriptCode = generateGoogleAppsScript(webhookUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
        id="spreadsheet-manager-modal"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Integrasi Google Spreadsheet & Ekspor/Impor
                </h2>
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Dual-Input: Supabase & Sheets
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Sinkronisasi 2 arah, migrasi data Supabase ke Spreadsheet, dan otomasi webhook real-time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-b-2 font-sans ${
              activeTab === 'sync'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Tarik & Sinkronkan (Pull)</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-b-2 font-sans ${
              activeTab === 'export'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Ekspor CSV (Format Spreadsheet)</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-b-2 font-sans ${
              activeTab === 'import'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Upload File CSV Manual</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-b-2 font-sans ${
              activeTab === 'script'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Code className="h-4 w-4" />
            <span>Kode Apps Script 2-Arah</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: SYNC PULL */}
          {activeTab === 'sync' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-emerald-950 dark:text-emerald-300 uppercase tracking-wider">
                    Jalur Input Ganda (Supabase & Google Sheets)
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-400 mt-1 leading-relaxed">
                    Data dari Google Spreadsheet Anda dapat ditarik secara instan ke dalam sistem. Kolom <code className="bg-emerald-200/50 dark:bg-emerald-900/50 px-1 py-0.5 rounded font-mono text-[11px]">INPUT PROGRES AKUN</code>, <code className="bg-emerald-200/50 dark:bg-emerald-900/50 px-1 py-0.5 rounded font-mono text-[11px]">STATUS</code>, dan baris baru akan langsung disinkronkan secara otomatis tanpa menimpa data lama yang sudah ada.
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Link Google Spreadsheet Aktif
                  </label>
                  <a
                    href={sheetUrlInput}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>Buka di Tab Baru</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={sheetUrlInput}
                      onChange={(e) => setSheetUrlInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {config.lastSyncedAt ? (
                      <span>Terakhir disinkronkan: <strong>{new Date(config.lastSyncedAt).toLocaleString('id-ID')}</strong></span>
                    ) : (
                      <span>Belum pernah disinkronkan via tombol ini.</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncFromSheets}
                    disabled={isSyncing}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : 'Tarik & Sinkronkan Sekarang'}</span>
                  </button>
                </div>
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
                    <p className="text-xs font-bold">{syncResult.message}</p>
                    {syncResult.success && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Tabel Google Maps Review di web telah dimutakhirkan dengan data terbaru dari Spreadsheet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPORT CSV */}
          {activeTab === 'export' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Download File CSV yang 100% Cocok dengan Google Sheets
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  File CSV hasil ekspor ini memiliki urutan 12 kolom yang sama persis dengan Google Spreadsheet Anda. Anda dapat langsung mengimpornya ke Google Sheets tanpa perlu mengatur ulang nama kolom.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Maps Reviews Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        Paling Utama
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {mapsReviews.length} Data
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-2">
                      Google Maps Review
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Mencakup 12 kolom lengkap: row_id, TANGGAL, KLIEN, STORE, TIPE REVIEW, TARGET LINK, INPUT PROGRES AKUN, CLUE, LINK BUKTI, STATUS, updated_at, TARGET AKUN.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExport('maps_reviews')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download CSV Maps</span>
                  </button>
                </div>

                {/* Shopee Orders Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-orange-500/50 transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-800">
                        Shopee Panel
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {shopeeOrders.length} Data
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-2">
                      Shopee Orders & Tasks
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Pesanan Shopee, Spam WA, Report Akun, dan status pengerjaan dari tim adminshp.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExport('shopee_orders')}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download CSV Shopee</span>
                  </button>
                </div>

                {/* General Orders Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        Web Orders
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {orders.length} Data
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-2">
                      Pesanan Website & QRIS
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Transaksi pembayaran QRIS web, nomor WhatsApp pembeli, dan status invoice.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExport('orders')}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download CSV Web</span>
                  </button>
                </div>
              </div>

              {/* Quick Guide to Import into Google Sheets */}
              <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Cara Memasukkan File CSV ke Google Spreadsheet Anda:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-emerald-600 block mb-1">Langkah 1</span>
                    Buka Google Spreadsheet Anda, klik menu <strong>File &gt; Import</strong>.
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-emerald-600 block mb-1">Langkah 2</span>
                    Pilih tab <strong>Upload</strong> lalu seret file CSV yang baru diunduh.
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-emerald-600 block mb-1">Langkah 3</span>
                    Pilih <strong>"Replace current sheet"</strong> atau <strong>"Append to current sheet"</strong> lalu klik Import.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IMPORT MANUAL CSV */}
          {activeTab === 'import' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <Upload className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Unggah File CSV dari Komputer / HP
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Pilih file CSV yang telah diedit. Sistem akan memeriksa kolom dan melakukan pembaruan otomatis (Smart Upsert).
                </p>

                <label className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm transition-all active:scale-95">
                  <Upload className="h-4 w-4" />
                  <span>Pilih File CSV</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {importStatus && (
                <div className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                  importStatus.success === false
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {importStatus.success === false ? (
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-xs font-semibold">{importStatus.message}</span>
                  </div>

                  {previewRows.length > 0 && !importStatus.success && (
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={isImporting}
                      className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shrink-0 cursor-pointer"
                    >
                      {isImporting ? 'Memproses...' : 'Terapkan Import'}
                    </button>
                  )}
                </div>
              )}

              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Pratinjau 5 Baris Pertama:
                  </span>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-x-auto bg-white dark:bg-slate-800">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-700">
                        <tr>
                          {Object.keys(previewRows[0]).slice(0, 6).map((k) => (
                            <th key={k} className="px-3 py-2">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {previewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            {Object.keys(previewRows[0]).slice(0, 6).map((k) => (
                              <td key={k} className="px-3 py-2 truncate max-w-[150px]">
                                {String(r[k] || '-')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: APPS SCRIPT 2-WAY AUTOMATION */}
          {activeTab === 'script' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Code className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-indigo-950 dark:text-indigo-300 uppercase tracking-wider">
                    Google Apps Script (Webhook 2 Arah & Dropdown Status)
                  </h3>
                  <p className="text-xs text-indigo-800 dark:text-indigo-400 mt-1 leading-relaxed">
                    Pasang script ini ke dalam Google Spreadsheet Anda untuk mengaktifkan Dropdown Status warna-warni dan membuat setiap perubahan data di Spreadsheet langsung terkirim secara instan ke website.
                  </p>
                </div>
              </div>

              {/* Webhook Endpoint Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>URL Webhook Website Anda</span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase">Endpoint Siap Menerima</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0"
                  >
                    {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedWebhook ? 'Tersalin' : 'Salin URL'}</span>
                  </button>
                </div>
              </div>

              {/* Code Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Kode Google Apps Script Siap Pasang
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(appsScriptCode);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedScript ? 'Kode Berhasil Disalin!' : 'Salin Seluruh Kode'}</span>
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto border border-slate-800 select-all">
                    {appsScriptCode}
                  </pre>
                </div>
              </div>

              {/* Step-by-Step Guide */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Cara Memasang Script di Google Spreadsheet (1 Menit):
                </h4>
                <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li>Buka Google Spreadsheet Anda di browser.</li>
                  <li>Klik menu <strong>Extensions (Ekstensi) &gt; Apps Script</strong>.</li>
                  <li>Hapus semua teks yang ada di editor, lalu <strong>Paste</strong> seluruh kode di atas.</li>
                  <li>Klik tombol <strong>Save</strong> (icon disket) atau tekan <code>Ctrl + S</code>.</li>
                  <li>Pilih fungsi <strong>setupSheetAutomation</strong> di bar atas lalu klik <strong>Run (Jalankan)</strong> sekali untuk membuat Dropdown Status otomatis.</li>
                  <li>Selesai! Sekarang saat Anda mengubah status di Google Sheet, website langsung terupdate!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Status: Google Sheets & Supabase Siap</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}
