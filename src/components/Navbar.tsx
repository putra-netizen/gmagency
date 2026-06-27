/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import GMLogo from './GMLogo';
import { Language } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { Globe, ShieldAlert, Home, Grid, Settings, RefreshCw, LogOut, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
  currentView: 'home' | 'admin' | 'worker' | 'adminshp';
  onViewChange: (view: 'home' | 'admin' | 'worker' | 'adminshp') => void;
  supabaseConnected: boolean;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
}

export default function Navbar({
  currentLang,
  onLangChange,
  currentView,
  onViewChange,
  supabaseConnected,
  theme = 'dark',
  onThemeToggle
}: NavbarProps) {
  const t = TRANSLATIONS[currentLang];

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const isShpAuthenticated = () => {
    try {
      const pathname = window.location.pathname;
      if (pathname === '/adminshp') return false;
      const clean = pathname.replace('/', '').toLowerCase();
      const isValidSlot = ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'].includes(clean);
      if (!isValidSlot) return false;

      const isAuth = sessionStorage.getItem('gm_adminshp_auth') === 'true';
      const authUser = sessionStorage.getItem('gm_adminshp_user');
      return isAuth && authUser === clean;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    const handleRoute = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  return (
    <header className={`sticky top-0 z-50 w-full border-b backdrop-blur-md shrink-0 transition-colors duration-300 ${
      currentView === 'home'
        ? (theme === 'dark'
            ? 'border-slate-800 bg-slate-950/80 shadow-lg shadow-black/20 text-white'
            : 'border-slate-200 bg-white/80 shadow-sm text-slate-900')
        : 'border-slate-200 bg-white/80 shadow-sm text-slate-900'
    }`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo brand or Admin Title */}
        {currentView === 'admin' ? (
          <div className="flex items-center gap-2 sm:gap-3" id="admin-logo-status-container">
            {/* Beautiful compact Admin title - no image, no GM Agency name */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-[11px] sm:text-xs tracking-wider shadow-sm select-none">
                AD
              </div>
              <span className="text-xs sm:text-sm font-black tracking-wider font-sans uppercase text-slate-800">
                Admin Panel
              </span>
            </div>

            {/* Supabase connection status pill (Admin role only!) */}
            <div 
              className="flex items-center gap-1 sm:gap-1.5 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] font-bold border transition-all bg-emerald-50 text-emerald-750 border-emerald-100"
              title={supabaseConnected ? "Database Supabase Aktif" : "Database Supabase Tidak Aktif (Local Fallback)"}
              id="supabase-status-pill"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${supabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="inline-block">
                <span className="hidden sm:inline">Supabase: </span>
                {supabaseConnected ? 'AKTIF' : 'OFFLINE'}
              </span>
            </div>
          </div>
        ) : (
          /* Normal Logo brand encapsulated in white capsule wrapper */
          <div 
            onClick={() => onViewChange('home')} 
            className="cursor-pointer transition-transform duration-200 active:scale-95 bg-white border border-slate-200 rounded-full py-1 px-3 sm:py-1.5 sm:px-4 flex items-center justify-center shadow-md shadow-black/5 hover:shadow-lg hover:bg-slate-50"
            id="brand-logo-container"
          >
            <GMLogo size="sm" showSubtitle={true} />
          </div>
        )}

        {/* Action controls */}
        <div className="flex items-center gap-1.5 sm:gap-3" id="nav-actions">
          {/* Supabase status pill -> Layanan 24 Jam */}
          {currentView === 'home' && (
            <div 
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold md:flex ${
                theme === 'dark'
                  ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/20'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}
              title="Layanan 24 Jam"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Layanan 24 Jam</span>
            </div>
          )}

          {/* Settings Admin button - only visible in admin view (icon only) */}
          {currentView === 'admin' && (
            <button
              onClick={() => {
                window.history.pushState(null, '', '/admin/settings');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className={`h-9 w-9 items-center justify-center rounded-full transition-all flex border cursor-pointer ${
                currentPath.includes('settings')
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-950'
              }`}
              title="Settings Admin"
              id="nav-settings-admin"
            >
              <Settings className="h-4 w-4 animate-spin-slow" />
            </button>
          )}

          {/* AdminShp view actions (Refresh and Sign Out) */}
          {currentView === 'adminshp' && isShpAuthenticated() && (
            <>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('adminshp-refresh'));
                }}
                className="h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-950 transition-all flex cursor-pointer shadow-sm active:scale-95"
                title="Refresh Data"
                id="nav-refresh-adminshp"
              >
                <RefreshCw className="h-4 w-4 text-slate-500 hover:text-slate-700" />
              </button>

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('adminshp-logout'));
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50/50 px-3 py-2 text-xs font-semibold text-red-650 hover:bg-red-100/60 transition-all shadow-sm active:scale-95 cursor-pointer"
                id="nav-logout-adminshp"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          )}

          {/* Navigation View switcher (Only visible in worker mode to return home, hidden for admin and adminshp to keep it clean) */}
          {currentView !== 'home' && currentView !== 'admin' && currentView !== 'adminshp' && (
            <button
              onClick={() => onViewChange('home')}
              className="flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm cursor-pointer border bg-slate-100 text-slate-750 hover:bg-slate-200 border-slate-200"
              id="view-toggle-button"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.navHome}</span>
            </button>
          )}

          {/* Theme switcher (Only visible in home view) */}
          {currentView === 'home' && onThemeToggle && (
            <button
              onClick={onThemeToggle}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-sm active:scale-95 ${
                theme === 'dark'
                  ? 'border-slate-800 bg-slate-900 text-amber-400 hover:bg-slate-800 hover:text-amber-300'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              id="theme-toggle-button"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}

          {/* Language toggle switcher (Hidden on admin and adminshp view) */}
          {currentView !== 'admin' && currentView !== 'adminshp' && (
            <div className={`flex items-center overflow-hidden rounded-lg p-0.5 border ${
              currentView === 'home'
                ? (theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm')
                : 'border-slate-200 bg-slate-100'
            }`}>
              <button
                onClick={() => onLangChange('id')}
                className={`px-1.5 py-1 sm:px-2.5 text-xs font-bold transition-all ${
                  currentLang === 'id'
                    ? 'bg-blue-600 text-white shadow-sm rounded-md'
                    : currentView === 'home'
                      ? (theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950')
                      : 'text-slate-500 hover:text-slate-950'
                }`}
                id="lang-toggle-id"
              >
                ID
              </button>
              <button
                onClick={() => onLangChange('en')}
                className={`px-1.5 py-1 sm:px-2.5 text-xs font-bold transition-all ${
                  currentLang === 'en'
                    ? 'bg-blue-600 text-white shadow-sm rounded-md'
                    : currentView === 'home'
                      ? (theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950')
                      : 'text-slate-500 hover:text-slate-950'
                }`}
                id="lang-toggle-en"
              >
                 EN
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
