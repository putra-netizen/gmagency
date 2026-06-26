/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order, Language } from '../types';
import { dbGetOrders, dbUpdateOrder } from '../lib/supabase';
import { 
  Database, 
  Lock, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Play, 
  Check, 
  Link, 
  ExternalLink, 
  User, 
  ClipboardList, 
  LogOut, 
  Clock, 
  Image as ImageIcon 
} from 'lucide-react';

interface WorkerPanelProps {
  currentLang: Language;
}

export default function WorkerPanel({ currentLang }: WorkerPanelProps) {
  // Authentication states
  const [currentWorker, setCurrentWorker] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('gm_worker_auth') || null;
    } catch (e) {
      return null;
    }
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Orders and loading states
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Done modal/form states
  const [selectedDoneOrder, setSelectedDoneOrder] = useState<Order | null>(null);
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [proofError, setProofError] = useState('');

  // Auto-refresh countdown indicator
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Function to load orders
  const loadOrdersData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setFetchError('');
    try {
      const data = await dbGetOrders();
      setOrders(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      setFetchError(currentLang === 'id' ? 'Gagal memuat data order.' : 'Failed to load order data.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Initial fetch and setup periodic polling (every 5 seconds)
  useEffect(() => {
    if (currentWorker) {
      loadOrdersData();

      const interval = setInterval(() => {
        loadOrdersData(true); // silent refresh
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [currentWorker]);

  // Handle Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = usernameInput.trim().toLowerCase();
    const password = passwordInput.trim();

    // Validate worker1 - worker8
    const workerMatch = user.match(/^worker([1-8])$/);
    if (workerMatch) {
      const workerNum = workerMatch[1];
      const expectedPassword = `gmworker${workerNum}`;

      if (password === expectedPassword) {
        setCurrentWorker(user);
        try {
          sessionStorage.setItem('gm_worker_auth', user);
        } catch (err) {
          console.warn('Session storage restricted', err);
        }
        setLoginError('');
        setUsernameInput('');
        setPasswordInput('');
      } else {
        setLoginError(currentLang === 'id' ? 'Password untuk worker tersebut salah!' : 'Incorrect password for this worker!');
      }
    } else {
      setLoginError(currentLang === 'id' ? 'Username tidak dikenali (Gunakan worker1 s/d worker8)!' : 'Username not recognized (Use worker1 to worker8)!');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentWorker(null);
    try {
      sessionStorage.removeItem('gm_worker_auth');
    } catch (err) {
      console.warn('Session storage restricted', err);
    }
  };

  // Handle Take Task (FIFO or manual)
  const handleTakeTask = async (orderId: string) => {
    if (!currentWorker) return;
    setActionLoadingId(orderId);
    try {
      // Find current order state to verify it hasn't been taken
      const targetOrder = orders.find(o => o.id === orderId);
      if (!targetOrder) throw new Error('Order not found');

      if (targetOrder.worker_status === 'taken' || targetOrder.worker_status === 'done') {
        alert(currentLang === 'id' ? 'Tugas ini sudah diambil oleh worker lain!' : 'This task has already been taken by another worker!');
        await loadOrdersData(true);
        return;
      }

      // Update order state
      await dbUpdateOrder(orderId, {
        worker_id: currentWorker,
        worker_status: 'taken'
      });

      // Reload order data
      await loadOrdersData(true);
    } catch (err) {
      console.error(err);
      alert(currentLang === 'id' ? 'Gagal mengambil tugas.' : 'Failed to take task.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Submission of Proof Url
  const handleDoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoneOrder || !currentWorker) return;

    setProofError('');
    const url = proofUrlInput.trim();

    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setProofError(currentLang === 'id' ? 'Format URL tidak valid! Harus diawali http:// atau https://' : 'Invalid URL format! Must start with http:// or https://');
      return;
    }

    setActionLoadingId(selectedDoneOrder.id);
    try {
      await dbUpdateOrder(selectedDoneOrder.id, {
        worker_status: 'done',
        worker_proof_url: url || undefined
      });

      setSelectedDoneOrder(null);
      setProofUrlInput('');
      await loadOrdersData(true);
    } catch (err) {
      console.error(err);
      alert(currentLang === 'id' ? 'Gagal menyelesaikan tugas.' : 'Failed to complete task.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper: Get oldest unassigned order (First In First Out)
  const getOldestUnassignedOrder = () => {
    // Standard order is sorted newest-first in database, so we reverse it or sort ascending by created_at
    const unassigned = orders
      .filter(o => o.payment_status === 'PAID' && (!o.worker_status || o.worker_status === 'unassigned'))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return unassigned.length > 0 ? unassigned[0] : null;
  };

  const oldestUnassigned = getOldestUnassignedOrder();

  // Authentication Guard
  if (!currentWorker) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8" id="worker-login-wrapper">
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-2">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight font-sans">
              Worker Portal
            </h2>
            <p className="text-xs text-slate-400 font-medium font-sans">
              GM AGENCY Task Production Center
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3.5 text-xs font-bold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                {currentLang === 'id' ? 'Username Worker' : 'Worker Username'}
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="worker1"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer mt-2 font-sans"
            >
              {currentLang === 'id' ? 'Masuk Tugas' : 'Sign In To Tasks'}
            </button>
          </form>
          <div className="text-center pt-2">
            <span className="text-[10px] text-slate-400 font-sans font-light">
              {currentLang === 'id' 
                ? 'Gunakan akun worker1 s/d worker8 dengan password gmworker1 s/d gmworker8' 
                : 'Use worker1 to worker8 accounts with password gmworker1 to gmworker8'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="worker-panel-container">
      
      {/* Header section with worker status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight font-sans">
              {currentLang === 'id' ? 'Dashboard Worker' : 'Worker Dashboard'}
            </h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider border border-blue-100">
              {currentWorker}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium font-sans mt-0.5">
            {currentLang === 'id' 
              ? 'Kelola, proses, dan selesaikan pesanan digital pelanggan.' 
              : 'Manage, process, and complete client digital orders.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          {/* Polling/Auto-sync pulsing indicator */}
          <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Realtime Sync Active</span>
            <span className="text-[9px] text-emerald-500 font-mono ml-1 hidden sm:inline">
              ({lastRefreshed.toLocaleTimeString()})
            </span>
          </div>

          <button
            onClick={() => loadOrdersData()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            id="worker-refresh-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{currentLang === 'id' ? 'Refresh' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
            id="worker-logout-btn"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-4 text-xs font-bold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}



      {/* 2. TASK MANAGER SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="tasks-layout-grid">
        
        {/* Left: Current Active Assigned Tasks (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-sans flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              {currentLang === 'id' ? 'Tugas Aktif Saya' : 'My Active Tasks'}
            </h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-100 font-sans">
              {orders.filter(o => o.worker_id === currentWorker && o.worker_status === 'taken').length} Aktif
            </span>
          </div>

          <div className="space-y-4">
            {orders.filter(o => o.worker_id === currentWorker && o.worker_status === 'taken').length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 font-medium">
                {currentLang === 'id' 
                  ? 'Anda tidak memiliki tugas yang sedang dikerjakan. Silakan ambil tugas dari daftar antrean.' 
                  : 'You do not have any active tasks in progress. Please take a task from the queue.'}
              </div>
            ) : (
              orders
                .filter(o => o.worker_id === currentWorker && o.worker_status === 'taken')
                .map(order => (
                  <div key={order.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 relative overflow-hidden">
                    {/* Top yellow active bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 font-mono block uppercase">{order.id}</span>
                        <h4 className="text-sm font-bold text-slate-800">{order.product_name}</h4>
                      </div>
                      <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600 uppercase">
                        Sedang Diproses
                      </span>
                    </div>

                    <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Pemesan</span>
                        <span className="font-semibold text-slate-700">{order.buyer_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Jumlah Pengerjaan</span>
                        <span className="font-semibold text-slate-700 font-mono">{order.quantity} pcs</span>
                      </div>
                      {order.target_link && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Link Target</span>
                          <a 
                            href={order.target_link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline font-mono inline-flex items-center gap-1 break-all"
                          >
                            <span>{order.target_link}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>
                      )}
                      {order.target_spam_phone && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Nomor Target</span>
                          <span className="font-semibold text-slate-700 font-mono">{order.target_spam_phone}</span>
                        </div>
                      )}
                      {order.notes && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Catatan Tambahan</span>
                          <p className="text-slate-600 font-light mt-0.5 text-[11px] leading-relaxed bg-white p-2 rounded border border-slate-100">
                            {order.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedDoneOrder(order);
                          setProofUrlInput('');
                          setProofError('');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        <span>Selesaikan Tugas (Done)</span>
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Right: Master Orders Queue & Task Distribution (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-sans flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              {currentLang === 'id' ? 'Semua Daftar Tugas & Status' : 'All Tasks & Distribution Status'}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200 font-sans">
              {orders.filter(o => o.payment_status === 'PAID').length} Order Masuk
            </span>
          </div>

          <div className="space-y-3.5 max-h-[700px] overflow-y-auto pr-1">
            {orders.filter(o => o.payment_status === 'PAID').length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-xs text-slate-400 font-medium">
                {currentLang === 'id' ? 'Belum ada pesanan lunas yang masuk.' : 'No paid orders in system yet.'}
              </div>
            ) : (
              orders
                .filter(o => o.payment_status === 'PAID')
                .map(order => {
                  const isUnassigned = !order.worker_status || order.worker_status === 'unassigned';
                  const isTakenByMe = order.worker_status === 'taken' && order.worker_id === currentWorker;
                  const isTakenByOther = order.worker_status === 'taken' && order.worker_id !== currentWorker;
                  const isDone = order.worker_status === 'done';

                  return (
                    <div 
                      key={order.id} 
                      className={`bg-white rounded-xl border p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isTakenByMe ? 'border-amber-300 bg-amber-50/10' : 'border-slate-100'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">{order.id}</span>
                          <span className="text-[10px] font-light text-slate-400 font-mono">
                            {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* Order State Badge */}
                          {isUnassigned && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-600 border border-slate-200">
                              Antrean (Ready)
                            </span>
                          )}
                          {isTakenByMe && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-700 border border-amber-200">
                              Sedang Saya Kerjakan
                            </span>
                          )}
                          {isTakenByOther && (
                            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-extrabold text-purple-700 border border-purple-200">
                              Dikerjakan: {order.worker_id}
                            </span>
                          )}
                          {isDone && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 border border-emerald-200">
                              Selesai oleh: {order.worker_id}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800 leading-tight">
                            {order.product_name}
                          </h4>
                          <p className="text-xs text-slate-500 font-light flex items-center gap-1.5 flex-wrap">
                            <span>Nama: <strong className="font-semibold text-slate-700">{order.buyer_name}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>Qty: <strong className="font-semibold text-slate-700">{order.quantity} pcs</strong></span>
                          </p>
                        </div>

                        {/* Extra targets info if relevant */}
                        {(order.target_link || order.notes) && (
                          <div className="pt-1.5 flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                            {order.target_link && (
                              <a 
                                href={order.target_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline inline-flex items-center gap-0.5 truncate max-w-[200px]"
                              >
                                <span>Target Link</span>
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              </a>
                            )}
                            {order.notes && (
                              <span className="truncate max-w-[250px] italic">
                                Catatan: "{order.notes}"
                              </span>
                            )}
                          </div>
                        )}

                        {/* Proof link display */}
                        {isDone && order.worker_proof_url && (
                          <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-700">
                            <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                            <a 
                              href={order.worker_proof_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="font-semibold hover:underline inline-flex items-center gap-0.5"
                            >
                              <span>Lihat Bukti Foto</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Action buttons on right */}
                      <div className="shrink-0 flex items-center">
                        {isUnassigned && (
                          <button
                            onClick={() => handleTakeTask(order.id)}
                            disabled={actionLoadingId === order.id}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all cursor-pointer shadow-sm"
                          >
                            {actionLoadingId === order.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3 fill-white" />
                            )}
                            <span>Ambil Tugas</span>
                          </button>
                        )}
                        {isTakenByMe && (
                          <button
                            onClick={() => {
                              setSelectedDoneOrder(order);
                              setProofUrlInput('');
                              setProofError('');
                            }}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer shadow-sm"
                          >
                            <Check className="h-3 w-3" />
                            <span>Kirim Done</span>
                          </button>
                        )}
                        {isTakenByOther && (
                          <span className="text-xs font-semibold text-slate-400 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            Diproses {order.worker_id}
                          </span>
                        )}
                        {isDone && (
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Done</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Done Modal (Request Link Foto Bukti Pengerjaan) */}
      {selectedDoneOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="proof-submission-modal">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 font-sans uppercase tracking-tight">
                  Selesaikan Tugas ({selectedDoneOrder.id})
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {selectedDoneOrder.product_name}
                </p>
              </div>
            </div>

            <form onSubmit={handleDoneSubmit} className="space-y-4">
              {proofError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{proofError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Link Foto / Screenshot Bukti Pengerjaan
                </label>
                <input
                  type="url"
                  value={proofUrlInput}
                  onChange={(e) => setProofUrlInput(e.target.value)}
                  placeholder="https://imgur.com/your-proof-screenshot"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
                <span className="text-[10px] text-slate-400 block font-light leading-relaxed">
                  Opsional. Masukkan tautan/URL gambar bukti hasil pengerjaan (misalnya dari Imgur, Lightshot, Google Drive, atau storage gambar lainnya).
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoneOrder(null)}
                  className="w-1/2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Kirim & Selesaikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
