import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Table, 
  Calendar, 
  FileText,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getShopeeOrderFormattedText } from '../utils/formatHelpers';
import { toast } from '../utils/toast';
import { ShopeeOrder } from '../types';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingOrders?: ShopeeOrder[];
}

interface ParsedOrderRow {
  store_name: string;
  buyer_name: string;
  target_link: string;
  service_type: string;
  quantity: number;
  worker_id: string;
  created_by: string;
  work_order?: string;
}

export function CsvImportModal({
  isOpen,
  onClose,
  onSuccess,
  existingOrders = []
}: CsvImportModalProps) {
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [rawText, setRawText] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-07-01');
  const [orderType, setOrderType] = useState<'REPORT_ALL_SOSMED' | 'SPAM_WA'>('REPORT_ALL_SOSMED');
  const [parsedRows, setParsedRows] = useState<ParsedOrderRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fileName, setFileName] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseCsvText = (csvString: string) => {
    const lines = csvString.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    let headerLineIdx = 0;
    // Check if line 0 is a header
    const firstLineLower = lines[0].toLowerCase();
    let colMap = {
      tanggal: -1,
      noOrder: -1,
      storeName: 2,
      buyerName: 3,
      targetLink: 4,
      serviceType: 5,
      quantity: 6,
      worker: 7,
      admin: 8
    };

    if (firstLineLower.includes('nama toko') || firstLineLower.includes('toko') || firstLineLower.includes('store')) {
      headerLineIdx = 1;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      headers.forEach((h, idx) => {
        if (h.includes('toko') || h.includes('store') || h.includes('st')) colMap.storeName = idx;
        else if (h.includes('klien') || h.includes('cust') || h.includes('buyer') || h.includes('pembeli')) colMap.buyerName = idx;
        else if (h.includes('link') || h.includes('target') || h.includes('nomer')) colMap.targetLink = idx;
        else if (h.includes('spam') || h.includes('jasa') || h.includes('service') || h.includes('jenis')) colMap.serviceType = idx;
        else if (h.includes('order') || h.includes('slot') || h.includes('qty') || h.includes('jumlah')) colMap.quantity = idx;
        else if (h.includes('worker') || h.includes('pekerja')) colMap.worker = idx;
        else if (h.includes('admin') || h.includes('inputer') || h.includes('creator')) colMap.admin = idx;
      });
    }

    const rows: ParsedOrderRow[] = [];
    for (let i = headerLineIdx; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // Simple CSV split (handling commas)
      const parts = line.split(',').map(p => p.trim());
      
      const storeName = parts[colMap.storeName] || '';
      const buyerName = parts[colMap.buyerName] || '';
      const targetLink = parts[colMap.targetLink] || '';
      const serviceType = parts[colMap.serviceType] || 'Vote';
      const quantityStr = parts[colMap.quantity] || '0';
      const quantity = parseInt(quantityStr.replace(/[^\d]/g, ''), 10) || 0;
      const worker = parts[colMap.worker] || '';
      const admin = parts[colMap.admin] || '';

      if (!storeName && !buyerName && !targetLink) continue;

      rows.push({
        store_name: storeName,
        buyer_name: buyerName,
        target_link: targetLink,
        service_type: serviceType,
        quantity: quantity,
        worker_id: worker,
        created_by: admin,
        work_order: storeName ? `${storeName}${i}` : undefined
      });
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      parseCsvText(content);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (text: string) => {
    setRawText(text);
    parseCsvText(text);
  };

  const handleImportToDatabase = async () => {
    if (parsedRows.length === 0) {
      toast.error('Tidak ada data pesanan yang valid untuk diimport.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      toast.error('Koneksi Supabase belum terkonfigurasi.');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: parsedRows.length });

    try {
      const baseDate = new Date(`${selectedDate}T08:00:00.000Z`).getTime();
      let importedCount = 0;
      let skippedCount = 0;

      const preparedOrders: any[] = [];

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];

        // Check duplicate if enabled
        if (skipDuplicates && existingOrders.length > 0) {
          const isDup = existingOrders.some(existing => {
            const sameDate = existing.created_at?.startsWith(selectedDate);
            const sameStore = (existing.store_name || '').toLowerCase() === row.store_name.toLowerCase();
            const sameBuyer = (existing.buyer_name || '').toLowerCase() === row.buyer_name.toLowerCase();
            const sameLink = (existing.target_link || '').toLowerCase() === row.target_link.toLowerCase();
            const sameQty = Number(existing.quantity) === Number(row.quantity);
            const sameWorker = (existing.worker_id || '').toLowerCase() === (row.worker_id || '').toLowerCase();
            return sameDate && sameStore && sameBuyer && sameLink && sameQty && sameWorker;
          });

          if (isDup) {
            skippedCount++;
            continue;
          }
        }

        const orderCreatedAt = new Date(baseDate + (i * 60000)).toISOString();
        const randId = `shp-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}-${i + 1}`;
        
        const tempOrder: Partial<ShopeeOrder> = {
          order_type: orderType,
          store_name: row.store_name,
          buyer_name: row.buyer_name,
          service_type: row.service_type,
          quantity: row.quantity,
          target_link: row.target_link,
          notes: '-',
          worker_id: row.worker_id || null,
          work_order: row.work_order || `${row.store_name}${i + 1}`,
          status: 'DONE',
          created_by: row.created_by || 'Admin',
          created_at: orderCreatedAt
        };

        const formatted = getShopeeOrderFormattedText(tempOrder);

        preparedOrders.push({
          id: randId,
          ...tempOrder,
          formatted_text: formatted
        });
      }

      if (preparedOrders.length === 0) {
        toast.info(`Semua ${parsedRows.length} data sudah ada di database (dilewati karena duplikat).`);
        setIsProcessing(false);
        return;
      }

      // Insert in batches of 50
      const batchSize = 50;
      for (let b = 0; b < preparedOrders.length; b += batchSize) {
        const batch = preparedOrders.slice(b, b + batchSize);
        const { error } = await supabase.from('shopee_orders').insert(batch);
        
        if (error) {
          console.error('Batch insert error:', error);
          throw new Error(error.message || 'Gagal menyimpan batch ke database');
        }

        importedCount += batch.length;
        setProgress({ current: importedCount, total: preparedOrders.length });
      }

      toast.success(`Berhasil mengimport ${importedCount} pesanan ke database untuk tanggal ${selectedDate}!${skippedCount > 0 ? ` (${skippedCount} duplikat dilewati)` : ''}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Terjadi kesalahan: ${err.message || 'Gagal menyimpan ke database'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50 via-white to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                Import CSV Pesanan Sosmed
              </h2>
              <p className="text-xs text-slate-500">
                Impor data pesanan Report Sosmed atau Spam WA langsung ke Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            {/* Target Date */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                Tanggal Pesanan
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              <span className="text-[10px] text-slate-400">Contoh: 2026-07-01 (1 Juli 2026)</span>
            </div>

            {/* Target Table / Order Type */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Table className="w-3.5 h-3.5 text-purple-500" />
                Tipe Pesanan
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="REPORT_ALL_SOSMED">Report All Sosmed</option>
                <option value="SPAM_WA">Spam WhatsApp</option>
              </select>
              <span className="text-[10px] text-slate-400">Disimpan di tabel shopee_orders</span>
            </div>

            {/* Duplicate Filter */}
            <div className="space-y-1.5 flex flex-col justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Filter Duplikat
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4"
                />
                <span className="text-xs font-medium text-slate-600">Lewati baris yang sudah ada</span>
              </label>
              <span className="text-[10px] text-slate-400">Cegah data ganda tersimpan</span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex border-b border-slate-200 gap-6">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                inputMode === 'file'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload File CSV / Spreadsheet
            </button>
            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                inputMode === 'paste'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4" />
              Paste Teks CSV Langsung
            </button>
          </div>

          {/* Input Controls */}
          {inputMode === 'file' ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-orange-400 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-orange-50/20 transition-all cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 mx-auto flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                {fileName ? `File terpilih: ${fileName}` : 'Klik untuk memilih file CSV (misal: juli_reportgm - Sheet1.csv)'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Format yang didukung: CSV dengan pemisah koma
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder="Paste baris CSV di sini, contoh:&#10;Tanggal,No Order,Nama Toko,Nama Klien,LINK Target,SPAM,Order,Worker,Admin&#10;,,WAWA,sukron,https://bankbsi.id/...,Vote,500,Rembo|| GM,Admin C"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Kolom terdeteksi otomatis sesuai format standar</span>
                {rawText && (
                  <button 
                    onClick={() => { setRawText(''); setParsedRows([]); }}
                    className="text-red-500 hover:underline cursor-pointer"
                  >
                    Kosongkan teks
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Parsed Data Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-black text-slate-800">
                    Preview Data: {parsedRows.length} Pesanan Terdeteksi
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Target tanggal: <strong>{selectedDate}</strong>
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">No</th>
                      <th className="p-2.5">Nama Toko</th>
                      <th className="p-2.5">Nama Klien</th>
                      <th className="p-2.5">Jasa</th>
                      <th className="p-2.5">Order/Qty</th>
                      <th className="p-2.5">Link Target</th>
                      <th className="p-2.5">Worker</th>
                      <th className="p-2.5">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {parsedRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-800">{row.store_name || '-'}</td>
                        <td className="p-2.5">{row.buyer_name || '-'}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold text-[10px]">
                            {row.service_type || '-'}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">{row.quantity}</td>
                        <td className="p-2.5 truncate max-w-[150px] text-blue-600 font-mono text-[10px]">
                          {row.target_link || '-'}
                        </td>
                        <td className="p-2.5 text-slate-600">{row.worker_id || '-'}</td>
                        <td className="p-2.5 text-slate-600">{row.created_by || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 15 && (
                <p className="text-[10px] text-slate-400 italic text-center">
                  Menampilkan 15 dari total {parsedRows.length} baris pesanan
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleImportToDatabase}
            disabled={isProcessing || parsedRows.length === 0}
            className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan ({progress.current}/{progress.total})...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Simpan {parsedRows.length} Pesanan ke Database</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
