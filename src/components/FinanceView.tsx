/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Order, Language, PaymentStatus } from '../types';
import { formatRupiah } from './ProductCard';
import { MonthlyDateRangePicker, TimeFilterConfig, isWithinCustomTimeframe } from './MonthlyDateRangePicker';
import { 
  Wallet, DollarSign, TrendingUp, CheckCircle2, Clock, 
  Search, ArrowLeft, Download, Filter, RefreshCw, Phone, 
  ExternalLink, FileSpreadsheet, Layers, PieChart, BarChart3, AlertCircle, Lock, Key 
} from 'lucide-react';
import { toast } from '../utils/toast';

interface FinanceViewProps {
  orders: Order[];
  currentLang: Language;
  onUpdateOrderStatus: (orderId: string, status: PaymentStatus) => Promise<void>;
  onBackToDashboard: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  orders,
  currentLang,
  onUpdateOrderStatus,
  onBackToDashboard,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [timeFilter, setTimeFilter] = useState<TimeFilterConfig>({ mode: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'PENDING'>('all');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '0000') {
      setIsUnlocked(true);
      setPinError(false);
      toast.success('PIN Benar! Akses Halaman Keuangan Dibuka.');
    } else {
      setPinError(true);
      toast.error('PIN Keuangan Salah! Akses ditolak.');
    }
  };

  // Filter orders by time range
  const timeFilteredOrders = useMemo(() => {
    return orders.filter(o => isWithinCustomTimeframe(o.created_at, timeFilter));
  }, [orders, timeFilter]);

  // Compute financial metrics
  const paidOrders = useMemo(() => {
    return timeFilteredOrders.filter(o => o.payment_status === 'PAID');
  }, [timeFilteredOrders]);

  const unpaidOrders = useMemo(() => {
    return timeFilteredOrders.filter(o => o.payment_status === 'PENDING' || o.payment_status === 'FAILED');
  }, [timeFilteredOrders]);

  const totalRevenue = useMemo(() => {
    return paidOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  }, [paidOrders]);

  const totalUnpaidNominal = useMemo(() => {
    return unpaidOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  }, [unpaidOrders]);

  const avgTransactionValue = useMemo(() => {
    if (paidOrders.length === 0) return 0;
    return Math.round(totalRevenue / paidOrders.length);
  }, [totalRevenue, paidOrders]);

  // Revenue breakdown by product
  const productRevenueBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    paidOrders.forEach(o => {
      const name = o.product_name || 'Layanan Lainnya';
      if (!map[name]) {
        map[name] = { count: 0, total: 0 };
      }
      map[name].count += 1;
      map[name].total += (o.total_price || 0);
    });

    const list = Object.entries(map).map(([name, data]) => ({
      name,
      count: data.count,
      total: data.total,
      percentage: totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0,
    }));

    return list.sort((a, b) => b.total - a.total);
  }, [paidOrders, totalRevenue]);

  // Final table filter by search query & status filter
  const displayOrders = useMemo(() => {
    return timeFilteredOrders.filter(o => {
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'PAID' ? o.payment_status === 'PAID' :
        (o.payment_status === 'PENDING' || o.payment_status === 'FAILED');

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        o.id.toLowerCase().includes(q) ||
        o.buyer_name.toLowerCase().includes(q) ||
        o.phone_number.includes(q) ||
        o.product_name.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [timeFilteredOrders, statusFilter, searchQuery]);

  // Handle payment status toggle
  const handleToggleStatus = async (orderId: string, currentStatus: PaymentStatus) => {
    const newStatus: PaymentStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    setIsUpdatingStatus(orderId);
    try {
      await onUpdateOrderStatus(orderId, newStatus);
      toast.success(`Status pembayaran berhasil diperbarui menjadi ${newStatus === 'PAID' ? 'LUNAS' : 'PENDING'}!`);
    } catch (err) {
      toast.error('Gagal memperbarui status pembayaran');
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Export financial CSV report
  const handleExportCSV = () => {
    if (displayOrders.length === 0) {
      toast.error('Tidak ada data transaksi untuk diexport');
      return;
    }

    const headers = ['ID Invoice', 'Tanggal', 'Nama Pembeli', 'No WA', 'Layanan', 'Jumlah', 'Total Harga (Rp)', 'Status Pembayaran'];
    const rows = displayOrders.map(o => [
      o.id,
      new Date(o.created_at).toLocaleString('id-ID'),
      `"${(o.buyer_name || '').replace(/"/g, '""')}"`,
      `"${o.phone_number}"`,
      `"${(o.product_name || '').replace(/"/g, '""')}"`,
      o.quantity,
      o.total_price,
      o.payment_status === 'PAID' ? 'LUNAS' : 'PENDING'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Keuangan_GM_Agency_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan CSV keuangan berhasil di-download!');
  };

  if (!isUnlocked) {
    return (
      <div className="space-y-6" id="finance-pin-lock-screen">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all border border-slate-200 dark:border-slate-800 cursor-pointer shadow-xs active:scale-95"
            id="btn-back-to-admin-dashboard-lock-top"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Kembali ke Dashboard Utama Admin</span>
          </button>
        </div>

        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Lock className="w-48 h-48 text-emerald-400" />
            </div>

            <div className="text-center space-y-2 relative z-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
                <Lock className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-white pt-2">
                Akses Terproteksi Keuangan
              </h2>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Masukkan PIN keamanan untuk mengakses laporan keuangan & pendapatan bisnis.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4 relative z-10">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 text-center">
                  PIN Keuangan (4 Digit)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="••••"
                  autoFocus
                  className={`w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 rounded-2xl bg-slate-850 border ${
                    pinError ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  } text-white placeholder-slate-600 focus:outline-none transition-all`}
                />
                {pinError && (
                  <p className="text-xs text-red-400 font-bold text-center mt-2 flex items-center justify-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>PIN Salah! Akses ditolak.</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Key className="h-4 w-4" />
                <span>Buka Halaman Keuangan</span>
              </button>

              <button
                type="button"
                onClick={onBackToDashboard}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali ke Dashboard Utama</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" id="finance-view-page">
      {/* 1. PAGE HEADER CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-12 translate-y-12">
          <Wallet className="w-96 h-96 text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <button
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 text-xs font-bold transition-all border border-slate-700/80 cursor-pointer shadow-xs active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-emerald-400" />
              <span>Kembali ke Dashboard Utama</span>
            </button>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3 pt-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Wallet className="h-6 w-6" />
              </div>
              <span>Halaman Khusus Keuangan</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Ikhtisar pendapatan resmi, status transaksi lunas QRIS, dan analisis performa finansial bisnis.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-3">
            <MonthlyDateRangePicker
              value={timeFilter}
              onChange={setTimeFilter}
              currentLang={currentLang}
            />

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              title="Export Laporan CSV Keuangan"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. STATS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Pendapatan Lunas */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total Pendapatan</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black font-sans tracking-tight text-emerald-400 select-all">
              {formatRupiah(totalRevenue)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/90 flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Total Akumulasi Lunas</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">PAID</span>
          </div>
        </div>

        {/* Total Transaksi Lunas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Transaksi Lunas</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
              {paidOrders.length} <span className="text-xs font-medium text-slate-400">transaksi</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Pembayaran terverifikasi</span>
            <span className="font-bold text-emerald-600">100% Valid</span>
          </div>
        </div>

        {/* Rata-Rata Nilai Transaksi */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rata-Rata Transaksi</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {formatRupiah(avgTransactionValue)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Rata-rata order lunas</span>
            <span className="font-bold text-blue-600">Avg Value</span>
          </div>
        </div>

        {/* Total Belum Lunas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Payment</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {formatRupiah(totalUnpaidNominal)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>{unpaidOrders.length} transaksi pending</span>
            <span className="font-bold text-amber-600">Belum Lunas</span>
          </div>
        </div>
      </div>

      {/* 3. REVENUE BREAKDOWN BY SERVICE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Distribusi Pendapatan per Layanan / Produk</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Persentase kontribusi omset dari setiap kategori jasa digital
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {productRevenueBreakdown.length} Jenis Layanan
          </span>
        </div>

        {productRevenueBreakdown.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            Belum ada transaksi lunas pada periode ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {productRevenueBreakdown.map((item, idx) => (
              <div key={idx} className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                    {item.name}
                  </span>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatRupiah(item.total)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 block">
                      {item.count} order ({item.percentage}%)
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. TRANSACTIONS TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span>Daftar Transaksi Pembayaran</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kelola status pembayaran invoice pesanan web secara langsung
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pembeli, WA, layanan..."
                className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter('PAID')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'PAID'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Lunas
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {displayOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs font-medium bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            Tidak ada transaksi ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-extrabold text-[10px]">
                  <th className="py-3 px-4">Invoice / Tanggal</th>
                  <th className="py-3 px-4">Pembeli</th>
                  <th className="py-3 px-4">Layanan</th>
                  <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                  <th className="py-3 px-4 text-center">Status Bayar</th>
                  <th className="py-3 px-4 text-center">Aksi Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayOrders.map((o) => {
                  const isPaid = o.payment_status === 'PAID';
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          #{o.id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block">
                          {new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {o.buyer_name}
                        </span>
                        <a
                          href={`https://wa.me/${o.phone_number.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-mono"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{o.phone_number}</span>
                        </a>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[180px]">
                          {o.product_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Jumlah: {o.quantity} pcs
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                        {formatRupiah(o.total_price)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                          isPaid
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          {isPaid ? 'LUNAS' : 'PENDING'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          disabled={isUpdatingStatus === o.id}
                          onClick={() => handleToggleStatus(o.id, o.payment_status)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs active:scale-95 inline-flex items-center gap-1.5 ${
                            isPaid
                              ? 'bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 hover:text-amber-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-sm'
                          }`}
                        >
                          {isUpdatingStatus === o.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : isPaid ? (
                            <span>Set Pending</span>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Set Lunas</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
