import React, { useState, useEffect } from 'react';
import { Database, Activity, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { clientEgressTracker } from '../lib/supabase';

interface EgressStats {
  today: string;
  target_daily_mb: number;
  used_mb: number;
  remaining_mb: number;
  percent_used: number;
  status: string;
  queries_today: number;
  cache_hits_today: number;
  cache_hit_rate: string;
  breakdown: Record<string, { bytes: number; queries: number; cacheHits: number }>;
}

export const EgressMonitorBadge: React.FC = () => {
  const [stats, setStats] = useState<EgressStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 1. Try server-side tracking (Cloud Run / Node dev server)
      const res = await fetch('/api/egress-stats');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStats(data);
        return;
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }

    // 2. Seamless client-side tracking fallback for Vercel SPA hosting
    try {
      const clientStats = clientEgressTracker.getSummary();
      setStats(clientStats);
    } catch (err) {
      console.warn('Failed to load client egress stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchStats();
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const isWarning = stats.percent_used > 60;
  const isCritical = stats.percent_used > 85;

  const badgeColor = isCritical 
    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300' 
    : isWarning 
    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300' 
    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300';

  const progressColor = isCritical
    ? 'bg-rose-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className="relative inline-block text-left text-xs">
      <div 
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${badgeColor} cursor-pointer transition-all hover:shadow-xs active:scale-98`}
        title="Klik untuk melihat detail Egress Supabase hari ini"
      >
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span className="font-bold">Egress Supabase:</span>
        <span className="font-extrabold font-mono">{stats.used_mb} MB</span>
        <span className="opacity-60 text-[10px]">/ {stats.target_daily_mb} MB</span>
        <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-black ${isCritical ? 'bg-rose-200 text-rose-800' : isWarning ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
          {stats.percent_used}%
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 opacity-60" /> : <ChevronDown className="h-3 w-3 opacity-60" />}
      </div>

      {expanded && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-black text-xs uppercase tracking-wider">Pemantauan Kuota Egress</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); fetchStats(); }}
              disabled={loading}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1 font-bold">
              <span>Penggunaan Hari Ini ({stats.today}):</span>
              <span className="font-mono font-extrabold">{stats.used_mb} MB ({stats.percent_used}%)</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                style={{ width: `${Math.max(3, Math.min(100, stats.percent_used))}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>0 MB</span>
              <span className="font-bold text-slate-600 dark:text-slate-300">Target Maks: {stats.target_daily_mb} MB/hari</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Query Supabase</div>
              <div className="text-xs font-black font-mono mt-0.5">{stats.queries_today} kali</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Cache Hit Rate</div>
              <div className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.cache_hit_rate}</div>
            </div>
          </div>

          {/* Status Message */}
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold">
            {isCritical ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="text-rose-600 dark:text-rose-400">{stats.status}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-emerald-600 dark:text-emerald-400">{stats.status}</span>
              </>
            )}
          </div>

          {/* Breakdown if any */}
          {Object.keys(stats.breakdown).length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <div className="font-bold text-slate-500 mb-1">Rincian Per Tabel:</div>
              <div className="space-y-1 font-mono">
                {Object.entries(stats.breakdown).map(([tbl, val]) => (
                  <div key={tbl} className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="truncate max-w-[140px]">{tbl}:</span>
                    <span>{(val.bytes / 1024).toFixed(1)} KB ({val.queries} q)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 text-[10px] text-slate-400 italic text-center">
            Optimasi incremental sync & cache 4-menit aktif
          </div>
        </div>
      )}
    </div>
  );
};
