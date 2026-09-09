/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  LogOut, 
  RefreshCw, 
  Briefcase, 
  Search, 
  ExternalLink,
  ShieldCheck,
  User,
  Layers,
  FileCheck2,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAuthUser, clientLogout, AuthUser } from '../lib/auth';
import { toast } from '../utils/toast';

interface WorkerPanelProps {
  currentLang?: 'id' | 'en';
  onLogout?: () => void;
}

interface WorkerTask {
  id: string;
  source: 'shopee' | 'maps';
  target_link?: string;
  notes?: string;
  worker_id?: string;
  worker_status?: 'unassigned' | 'taken' | 'done';
  status?: string;
  payment_status?: string;
  created_at?: string;
  customer_name?: string;
  product_name?: string;
}

export const WorkerPanel: React.FC<WorkerPanelProps> = ({
  currentLang = 'id',
  onLogout,
}) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getAuthUser());
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'taken' | 'done' | 'available'>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const workerIdentifier = currentUser?.slot || currentUser?.username || 'worker';

  const loadWorkerTasks = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Shopee orders
      const { data: shopeeData, error: shopeeError } = await supabase
        .from('shopee_orders')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Fetch Maps orders
      const { data: mapsData, error: mapsError } = await supabase
        .from('maps_orders')
        .select('*')
        .order('created_at', { ascending: false });

      const combined: WorkerTask[] = [];

      if (shopeeData) {
        shopeeData.forEach((s: any) => {
          combined.push({
            id: s.id,
            source: 'shopee',
            target_link: s.target_link,
            notes: s.notes,
            worker_id: s.worker_id,
            worker_status: s.worker_status || (s.worker_id ? 'taken' : 'unassigned'),
            status: s.status,
            payment_status: s.payment_status,
            created_at: s.created_at,
            customer_name: s.customer_name || s.username_shopee,
            product_name: s.product_name,
          });
        });
      }

      if (mapsData) {
        mapsData.forEach((m: any) => {
          combined.push({
            id: m.id,
            source: 'maps',
            target_link: m.target_link || m.maps_url,
            notes: m.notes,
            worker_id: m.worker_id,
            worker_status: m.worker_status || (m.worker_id ? 'taken' : 'unassigned'),
            status: m.status,
            payment_status: m.payment_status,
            created_at: m.created_at,
            customer_name: m.customer_name,
            product_name: 'Google Maps Review / Rating',
          });
        });
      }

      setTasks(combined);
    } catch (err) {
      console.error('Failed to load worker tasks:', err);
      toast.error(currentLang === 'id' ? 'Gagal memuat tugas worker' : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkerTasks();
  }, []);

  const handleTakeTask = async (task: WorkerTask) => {
    setUpdatingTaskId(task.id);
    try {
      const table = task.source === 'shopee' ? 'shopee_orders' : 'maps_orders';
      const { error } = await supabase
        .from(table)
        .update({
          worker_id: workerIdentifier,
          worker_status: 'taken',
        })
        .eq('id', task.id);

      if (error) throw error;
      toast.success(currentLang === 'id' ? 'Tugas berhasil diambil!' : 'Task taken!');
      await loadWorkerTasks();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengambil tugas');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleCompleteTask = async (task: WorkerTask) => {
    setUpdatingTaskId(task.id);
    try {
      const table = task.source === 'shopee' ? 'shopee_orders' : 'maps_orders';
      const { error } = await supabase
        .from(table)
        .update({
          worker_status: 'done',
          status: 'completed',
        })
        .eq('id', task.id);

      if (error) throw error;
      toast.success(currentLang === 'id' ? 'Tugas ditandai selesai!' : 'Task completed!');
      await loadWorkerTasks();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyelesaikan tugas');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleLogoutClick = async () => {
    await clientLogout('worker');
    if (onLogout) onLogout();
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const isMine = (task.worker_id || '').toLowerCase() === workerIdentifier.toLowerCase();
    const isUnassigned = !task.worker_id || task.worker_status === 'unassigned';

    if (filterTab === 'taken' && (!isMine || task.worker_status === 'done')) return false;
    if (filterTab === 'done' && (!isMine || task.worker_status !== 'done')) return false;
    if (filterTab === 'available' && !isUnassigned) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = task.customer_name?.toLowerCase().includes(q);
      const matchLink = task.target_link?.toLowerCase().includes(q);
      const matchNotes = task.notes?.toLowerCase().includes(q);
      const matchId = task.id.toLowerCase().includes(q);
      return matchName || matchLink || matchNotes || matchId;
    }
    return true;
  });

  const myActiveCount = tasks.filter(
    (t) => (t.worker_id || '').toLowerCase() === workerIdentifier.toLowerCase() && t.worker_status !== 'done'
  ).length;
  const myDoneCount = tasks.filter(
    (t) => (t.worker_id || '').toLowerCase() === workerIdentifier.toLowerCase() && t.worker_status === 'done'
  ).length;
  const availableCount = tasks.filter((t) => !t.worker_id || t.worker_status === 'unassigned').length;

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8" id="worker-panel-container">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header bar */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-200">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  {currentUser?.name || `Worker (${workerIdentifier})`}
                </h1>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200/60">
                  Role: Worker
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentUser?.email || `${workerIdentifier}@gmagency.internal`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadWorkerTasks}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{currentLang === 'id' ? 'Segarkan' : 'Refresh'}</span>
            </button>
            <button
              onClick={handleLogoutClick}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{currentLang === 'id' ? 'Keluar' : 'Logout'}</span>
            </button>
          </div>
        </header>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">{currentLang === 'id' ? 'Tugas Aktif Saya' : 'My Active Tasks'}</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{myActiveCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">{currentLang === 'id' ? 'Selesai Dikerjakan' : 'Completed Tasks'}</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{myDoneCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">{currentLang === 'id' ? 'Tugas Tersedia (Antrean)' : 'Available Queue'}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{availableCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Task Management Section */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200/80 shadow-sm space-y-5">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterTab === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Tugas
              </button>
              <button
                onClick={() => setFilterTab('taken')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterTab === 'taken' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tugas Saya ({myActiveCount})
              </button>
              <button
                onClick={() => setFilterTab('available')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterTab === 'available' ? 'bg-white text-amber-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tersedia ({availableCount})
              </button>
              <button
                onClick={() => setFilterTab('done')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterTab === 'done' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Selesai ({myDoneCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari link / nama / order ID..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Task List */}
          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
              <p className="text-xs">Memuat daftar tugas worker...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileCheck2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Tidak ada tugas dalam kategori ini</p>
              <p className="text-xs text-slate-400 mt-1">Silakan periksa tab tugas lainnya atau segarkan data</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const isMine = (task.worker_id || '').toLowerCase() === workerIdentifier.toLowerCase();
                const isUpdating = updatingTaskId === task.id;

                return (
                  <div key={task.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 rounded-2xl px-3 transition-colors">
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          task.source === 'shopee' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {task.source === 'shopee' ? 'Shopee / Sosmed' : 'Google Maps'}
                        </span>

                        {isMine && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">
                            Ditugaskan ke Anda
                          </span>
                        )}

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          task.worker_status === 'done'
                            ? 'bg-emerald-100 text-emerald-700'
                            : task.worker_status === 'taken'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          Status: {task.worker_status || 'unassigned'}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-900">
                        {task.product_name || 'Pesanan GM Agency'} - <span className="text-slate-500 font-normal">{task.customer_name || 'Customer'}</span>
                      </p>

                      {task.target_link && (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800">
                          <ExternalLink className="h-3 w-3" />
                          <a href={task.target_link} target="_blank" rel="noopener noreferrer" className="underline truncate max-w-md">
                            {task.target_link}
                          </a>
                        </div>
                      )}

                      {task.notes && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          Catatan: {task.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!task.worker_id || task.worker_status === 'unassigned' ? (
                        <button
                          onClick={() => handleTakeTask(task)}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Briefcase className="h-3.5 w-3.5" />
                          <span>Ambil Tugas</span>
                        </button>
                      ) : isMine && task.worker_status !== 'done' ? (
                        <button
                          onClick={() => handleCompleteTask(task)}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Tandai Selesai</span>
                        </button>
                      ) : task.worker_status === 'done' ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="h-4 w-4" /> Selesai
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium px-3 py-1.5 bg-slate-100 rounded-xl">
                          Dikerjakan: {task.worker_id}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
