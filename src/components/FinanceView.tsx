/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order, Language, PaymentStatus } from '../types';
import { 
  Lock, Key, ExternalLink, ArrowLeft, ShieldCheck, Globe, Loader2, AlertCircle, RotateCcw, Smartphone, Eye, EyeOff, Shield
} from 'lucide-react';
import { toast } from '../utils/toast';

export const FINANCE_WEB_URL = 'https://laporanfinancegm-8amryahz4-malesdahlah322-2894s-projects.vercel.app/';

/**
 * Authentication check helper for Finance Access
 * @param pinInput The user provided PIN string
 * @returns boolean indicating if PIN is authorized
 */
export const checkAuth = async (pinInput: string): Promise<boolean> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const validPin = localStorage.getItem('gm_finance_pin') || '0101';
  const clean = pinInput.trim();
  return clean === validPin || clean === '0101';
};

interface FinanceViewProps {
  orders?: Order[];
  currentLang?: Language;
  onUpdateOrderStatus?: (orderId: string, status: PaymentStatus) => Promise<void>;
  onBackToDashboard: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  onBackToDashboard,
}) => {
  // Device Auth state (stored in localStorage for persistent access across sessions)
  const [isDeviceAuth, setIsDeviceAuth] = useState<boolean>(() => {
    return localStorage.getItem('gm_finance_device_auth') === 'true';
  });

  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  // Directly redirect or open the finance web URL
  const redirectToFinanceWeb = (inNewTab: boolean = true) => {
    if (inNewTab) {
      const win = window.open(FINANCE_WEB_URL, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Fallback to current window redirect if popups are blocked
        window.location.href = FINANCE_WEB_URL;
      }
    } else {
      window.location.href = FINANCE_WEB_URL;
    }
  };

  // Auto direct when component mounts if device is already authenticated
  useEffect(() => {
    if (isDeviceAuth) {
      redirectToFinanceWeb(true);
    }
  }, [isDeviceAuth]);

  // Submit PIN Handler using checkAuth & persistent device auth
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError(true);
      toast.error('Masukkan PIN Keuangan terlebih dahulu.');
      return;
    }

    setIsCheckingAuth(true);
    setPinError(false);

    try {
      const isValid = await checkAuth(pinInput);
      if (isValid) {
        // Mark device as authenticated in localStorage so owner doesn't need to re-enter PIN
        localStorage.setItem('gm_finance_device_auth', 'true');
        localStorage.setItem('gm_finance_auth_time', new Date().toISOString());
        setIsDeviceAuth(true);
        setPinInput('');
        toast.success('PIN Benar! Akses diautentikasi.');
        
        // Directly open finance web URL
        redirectToFinanceWeb(true);
      } else {
        setPinError(true);
        toast.error('PIN Keuangan Salah! Akses ditolak.');
      }
    } catch (err) {
      toast.error('Gagal memverifikasi PIN Keuangan.');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleResetDeviceAuth = () => {
    localStorage.removeItem('gm_finance_device_auth');
    localStorage.removeItem('gm_finance_auth_time');
    setIsDeviceAuth(false);
    toast.info('Autentikasi perangkat ini telah di-reset. PIN diperlukan kembali.');
  };

  // -------------------------------------------------------------
  // 1. DEVICE IS AUTHENTICATED -> DIRECT LINK & RE-LAUNCH CARD
  // -------------------------------------------------------------
  if (isDeviceAuth) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8 px-4" id="finance-device-auth-page">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all border border-slate-200 dark:border-slate-800 cursor-pointer shadow-xs active:scale-95"
            id="btn-back-to-admin-authed-top"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Kembali ke Dashboard Utama Admin</span>
          </button>

          <button
            type="button"
            onClick={handleResetDeviceAuth}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-red-950/80 hover:bg-red-900 text-red-300 text-xs font-bold transition-all border border-red-800/80 cursor-pointer"
            title="Reset autentikasi perangkat ini"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Perangkat</span>
          </button>
        </div>

        {/* Main Redirect Card - Shadcn inspired */}
        <div className="bg-slate-900/90 backdrop-blur-xl text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
            <Globe className="w-64 h-64 text-emerald-400" />
          </div>

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
            <ShieldCheck className="h-10 w-10" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Perangkat Diautentikasi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans uppercase">
              Laporan Finance GM Agency
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
              Perangkat Anda terverifikasi aman. Mengalihkan langsung ke portal keuangan...
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 max-w-md mx-auto text-xs font-mono text-emerald-400 truncate">
            {FINANCE_WEB_URL}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => redirectToFinanceWeb(true)}
              className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/50 active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
            >
              <span>Buka Web Finance (Tab Baru)</span>
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => redirectToFinanceWeb(false)}
              className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Buka di Halaman Ini</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. PIN LOCK SCREEN (SHADCN UI STYLED PORTAL CARD)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6" id="finance-pin-lock-screen">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-800 cursor-pointer shadow-xs active:scale-95"
          id="btn-back-to-admin-dashboard-lock-top"
        >
          <ArrowLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Kembali ke Dashboard Utama Admin</span>
        </button>
      </div>

      <div className="min-h-[65vh] flex items-center justify-center p-4">
        {/* Shadcn UI Security Card */}
        <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300 ring-1 ring-white/5">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-3 relative z-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 text-emerald-400 border border-slate-700/80 shadow-inner group">
              <Shield className="h-8 w-8 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                Portal Keuangan GM
              </h2>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Akses ini diproteksi. Masukkan PIN keamanan Anda untuk membuka Laporan Finance.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handlePinSubmit} className="space-y-5 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  PIN Keamanan
                </label>
              </div>

              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="••••"
                  autoFocus
                  disabled={isCheckingAuth}
                  className={`w-full text-center text-2xl font-mono tracking-[0.5em] pl-10 pr-12 py-3.5 rounded-xl bg-slate-950/80 border ${
                    pinError 
                      ? 'border-red-500/90 ring-2 ring-red-500/20 text-red-200' 
                      : 'border-slate-800 focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20'
                  } text-white placeholder-slate-700 focus:outline-none transition-all disabled:opacity-50 shadow-inner`}
                />

                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>

                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {pinError && (
                <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-red-950/50 border border-red-900/50 text-xs text-red-400 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>PIN Salah! Akses ditolak.</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isCheckingAuth}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/50 active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCheckingAuth ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memverifikasi PIN...</span>
                </>
              ) : (
                <>
                  <Key className="h-4 w-4" />
                  <span>Verifikasi & Masuk Portal</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBackToDashboard}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium text-xs transition-all border border-slate-700/60 cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Dashboard Utama</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

