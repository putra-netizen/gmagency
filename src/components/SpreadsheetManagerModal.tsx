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
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Zap,
  Globe
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
  onRefreshData,
}: SpreadsheetManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'pull' | 'script' | 'push'>('pull');
  const [copied, setCopied] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1OQ38cPjGPNcc6G2lQuQLwDlXTQMIqoUvNN0jaWCZwHI/edit');
  const [isPulling, setIsPulling] = useState(false);
  const [pullSummary, setPullSummary] = useState<string | null>(null);

  const [appsScriptUrl, setAppsScriptUrl] = useState(() => {
    return localStorage.getItem('gm_sheets_apps_script_url') || '';
  });
  const [isPushing, setIsPushing] = useState(false);

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

  const handlePullFromSheet = async () => {
    if (!sheetUrl.trim()) {
      toast.error('Masukkan link Google Spreadsheet atau Web App URL terlebih dahulu.');
      return;
    }

    setIsPulling(true);
    setPullSummary(null);
    try {
      const res = await fetch('/api/sheets/sync-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menarik data dari Google Spreadsheet');
      }

      toast.success(data.message || `Berhasil menyinkronkan ${data.totalSynced} baris data!`);
      setPullSummary(`✅ Berhasil menarik ${data.totalSynced || 0} total pesanan (${data.totalMaps || 0} Ulasan Maps & ${data.totalShopee || 0} Pesanan Shopee) dari tab maps_orders dan shopee_orders.`);
      
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal menarik data dari Spreadsheet');
    } finally {
      setIsPulling(false);
    }
  };

  const handlePushToSheet = async () => {
    if (!appsScriptUrl.trim()) {
      toast.error('Masukkan URL Web App Apps Script terlebih dahulu untuk mengirim data.');
      return;
    }

    localStorage.setItem('gm_sheets_apps_script_url', appsScriptUrl.trim());
    setIsPushing(true);
    try {
      const res = await fetch('/api/sheets/push-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: appsScriptUrl.trim(),
          mapsReviews,
          shopeeOrders
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengirim data ke Google Sheets');
      }

      toast.success('Seluruh data ulasan & pesanan berhasil dikirim ke Spreadsheet!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal push ke Spreadsheet');
    } finally {
      setIsPushing(false);
    }
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
                  {mapsReviews.length} Maps | {shopeeOrders.length} Shopee
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Integrasi 2 arah real-time antara Web Admin dan Sheet <code>maps_orders</code> &amp; <code>shopee_orders</code>
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/40 dark:bg-slate-900/40 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pull')}
            className={`pb-3 px-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'pull'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>Tarik Data (Sheet ➔ Web)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('script')}
            className={`pb-3 px-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'script'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>Script Realtime 2 Arah</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('push')}
            className={`pb-3 px-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'push'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            <span>Kirim Data (Web ➔ Sheet)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* TAB 1: PULL DATA (SHEET TO WEB) */}
          {activeTab === 'pull' && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Tarik Data Ribuan Baris Ulasan &amp; Pesanan
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sistem akan langsung membaca sheet <strong>maps_orders</strong> dan <strong>shopee_orders</strong> di Google Spreadsheet Anda tanpa membuat sheet atau tabel baru.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  URL Google Spreadsheet / Web App URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                    <Globe className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                  <button
                    type="button"
                    disabled={isPulling}
                    onClick={handlePullFromSheet}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isPulling ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Menarik Ribuan Data...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="h-4 w-4" />
                        <span>Tarik Semua Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {pullSummary && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {pullSummary}
                </div>
              )}

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-2">
                <span className="font-black text-slate-800 dark:text-slate-200">💡 Tips Sinkronisasi Cepat:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                  <li>Pastikan hak akses Google Sheet Anda adalah <strong>"Siapa saja yang memiliki link (Pelihat / Viewer)"</strong> agar dapat dibaca langsung oleh server web.</li>
                  <li>Data di Web Admin akan langsung diisi dan diperbarui tanpa menghapus riwayat ID yang ada.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: REALTIME 2-WAY SCRIPT */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Google Apps Script Real-Time (Bi-Directional)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Mendukung <code>onEdit</code> otomatis saat cell sheet diedit &amp; <code>doPost</code> dari web.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleDownloadGs}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh .gs</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition-all"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? 'Tersalin!' : 'Salin Kode Script'}</span>
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
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>3 Langkah Pasang di Apps Script Spreadsheet:</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700/80 text-xs space-y-1">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[11px]">1</span>
                      <span>Buka Apps Script</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Di Google Sheet Anda, klik menu <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700/80 text-xs space-y-1">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[11px]">2</span>
                      <span>Paste &amp; Simpan</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Hapus kode lama, <strong>Paste (Ctrl+V)</strong> kode baru, lalu klik <strong>Simpan (Ctrl+S)</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700/80 text-xs space-y-1">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[11px]">3</span>
                      <span>Deploy Web App</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Klik <strong>Deploy &gt; New deployment &gt; Web app</strong> (Access: <em>Anyone</em>), lalu salin URL Web App-nya.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PUSH DATA (WEB TO SHEET) */}
          {activeTab === 'push' && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowUpFromLine className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Kirim Seluruh Data Web ke Spreadsheet (Batch Push)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Kirim {mapsReviews.length} ulasan Maps dan {shopeeOrders.length} pesanan Shopee yang ada di Web Admin langsung ke sheet target.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  URL Web App Google Apps Script
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={appsScriptUrl}
                      onChange={(e) => setAppsScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    <Globe className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                  <button
                    type="button"
                    disabled={isPushing}
                    onClick={handlePushToSheet}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    {isPushing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Mengirim ke Sheet...</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpFromLine className="h-4 w-4" />
                        <span>Kirim Semua Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span>Format tabel rapi &amp; sinkronisasi ke <code>maps_orders</code> dan <code>shopee_orders</code>.</span>
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
