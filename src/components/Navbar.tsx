/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import GMLogo from './GMLogo';
import { Language } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { Globe, ShieldAlert, Home, Grid, Settings, RefreshCw, LogOut, Sun, Moon, Menu, X, Wallet, Package, FileSpreadsheet } from 'lucide-react';

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
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

  const [isAdminAuth, setIsAdminAuth] = useState(() => {
    try {
      return sessionStorage.getItem('gm_admin_auth') === 'true' || localStorage.getItem('gm_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });

  const isShpAuthenticated = () => {
    try {
      const pathname = window.location.pathname;
      if (pathname === '/adminshp') return false;
      const clean = pathname.replace('/', '').toLowerCase();

      let slot = null;
      try {
        const saved = localStorage.getItem('gm_adminshp_creds');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            for (const key of ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4']) {
              if (parsed[key]?.username?.trim()?.toLowerCase() === clean) {
                slot = key;
                break;
              }
            }
          }
        }
      } catch (e) {}

      if (!slot) {
        if (clean === 'adminera' || clean === 'adminshp1') slot = 'adminshp1';
        else if (clean === 'admincika' || clean === 'adminshp2') slot = 'adminshp2';
        else if (clean === 'adminvira' || clean === 'adminshp3') slot = 'adminshp3';
        else if (clean === 'adminali' || clean === 'adminshp4') slot = 'adminshp4';
      }

      if (!slot) return false;

      const isAuth = sessionStorage.getItem('gm_adminshp_auth') === 'true' || localStorage.getItem(`gm_adminshp_auth_${slot}`) === 'true';
      const authUser = sessionStorage.getItem('gm_adminshp_user') || localStorage.getItem('gm_adminshp_user');
      return isAuth && authUser === slot;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    const handleRoute = () => {
      setCurrentPath(window.location.pathname);
    };
    const handleAuthChange = () => {
      setIsAdminAuth(sessionStorage.getItem('gm_admin_auth') === 'true' || localStorage.getItem('gm_admin_auth') === 'true');
    };
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('admin-auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('admin-auth-change', handleAuthChange);
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
          <div className="relative flex items-center gap-2 sm:gap-3" id="admin-logo-status-container">
            {/* Hamburger Menu Button (Replaces "AD" logo) */}
            <button
              onClick={() => setIsAdminMenuOpen(prev => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-md active:scale-95 border border-slate-700/50"
              title="Menu Admin"
              id="admin-hamburger-btn"
            >
              {isAdminMenuOpen ? (
                <X className="h-5 w-5 text-amber-400 transition-transform duration-200" />
              ) : (
                <Menu className="h-5 w-5 text-white transition-transform duration-200" />
              )}
            </button>

            <span className="text-xs sm:text-sm font-black tracking-wider font-sans uppercase text-slate-800 dark:text-slate-100">
              ADMIN WORKING SPACE
            </span>

            {/* Google Sheets Active indicator */}
            <div 
              className="flex items-center gap-1 sm:gap-1.5 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] font-bold border transition-all bg-emerald-50 text-emerald-700 border-emerald-200"
              title="Sistem Google Sheets Aktif"
              id="sheets-status-pill"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="inline-block">
                <span className="hidden sm:inline">DATABASE: </span>
                GOOGLE SHEETS
              </span>
            </div>

            {/* Premium Hamburger Menu Dropdown Popover */}
            {isAdminMenuOpen && (
              <>
                {/* Backdrop overlay */}
                <div 
                  className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px]" 
                  onClick={() => setIsAdminMenuOpen(false)} 
                />

                {/* Dropdown Card */}
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2.5 z-50 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-2.5 shadow-2xl ring-1 ring-black/5"
                  id="admin-hamburger-dropdown"
                >
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Menu Utama Admin
                    </span>
                    <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900">
                      PREMIUM NAV
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {/* 1. KEUANGAN */}
                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        window.history.pushState(null, '', '/admin/devpayroll');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        window.dispatchEvent(new CustomEvent('admin-navigate-keuangan'));
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 text-left transition-all group cursor-pointer border border-slate-100/60 dark:border-slate-800/60 hover:border-emerald-200 dark:hover:border-emerald-900/60 bg-slate-50/50 dark:bg-slate-800/30"
                      id="menu-item-keuangan"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shadow-xs">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                          <span>KEUANGAN</span>
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">NAVBAR</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          Ikhtisar omset & total pendapatan
                        </div>
                      </div>
                    </button>

                    {/* 2. EDIT KATALOG */}
                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        window.dispatchEvent(new CustomEvent('admin-navigate-katalog'));
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/80 dark:hover:bg-blue-950/40 text-left transition-all group cursor-pointer border border-slate-100/60 dark:border-slate-800/60 hover:border-blue-200 dark:hover:border-blue-900/60 bg-slate-50/50 dark:bg-slate-800/30"
                      id="menu-item-edit-katalog"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform shadow-xs">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          EDIT KATALOG
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          CRUD kelola produk & layanan
                        </div>
                      </div>
                    </button>

                    {/* 3. SPREADSHEET HUB */}
                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        window.dispatchEvent(new CustomEvent('admin-navigate-sheets'));
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-teal-50/80 dark:hover:bg-teal-950/40 text-left transition-all group cursor-pointer border border-slate-100/60 dark:border-slate-800/60 hover:border-teal-200 dark:hover:border-teal-900/60 bg-slate-50/50 dark:bg-slate-800/30"
                      id="menu-item-export-sheet"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform shadow-xs">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          SPREADSHEET HUB
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          Dual-Input Sync, Export & Apps Script
                        </div>
                      </div>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        ) : (
          /* Normal Logo brand encapsulated in white capsule wrapper */
          <div 
            onClick={() => onViewChange('home')} 
            className="cursor-pointer transition-all duration-200 active:scale-95 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full py-1 px-3 sm:py-1.5 sm:px-3.5 flex items-center justify-center shadow-xs hover:shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900"
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

          {/* Admin panel actions (Refresh and Sign Out) */}
          {currentView === 'admin' && isAdminAuth && (
            <>
              {/* Refresh (icon only, minimal) */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('admin-refresh'));
                }}
                className="h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-950 transition-all flex cursor-pointer shadow-sm active:scale-95"
                title="Refresh Data"
                id="nav-refresh-admin"
              >
                <RefreshCw className="h-4 w-4 text-slate-500 hover:text-slate-700" />
              </button>

              {/* Log Out (icon only, minimal) */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('admin-logout'));
                }}
                className="h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all flex cursor-pointer shadow-sm active:scale-95"
                title="Log Out"
                id="nav-logout-admin"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
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
