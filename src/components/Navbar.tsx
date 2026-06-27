/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import GMLogo from './GMLogo';
import { Language } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { Globe, ShieldAlert, Home, Grid, Settings } from 'lucide-react';

interface NavbarProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
  currentView: 'home' | 'admin' | 'worker' | 'adminshp';
  onViewChange: (view: 'home' | 'admin' | 'worker' | 'adminshp') => void;
  supabaseConnected: boolean;
}

export default function Navbar({
  currentLang,
  onLangChange,
  currentView,
  onViewChange,
  supabaseConnected
}: NavbarProps) {
  const t = TRANSLATIONS[currentLang];

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

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
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md shadow-lg shadow-black/20 shrink-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo brand or Admin Title */}
        {currentView === 'admin' ? (
          <div className="flex items-center gap-2 sm:gap-3" id="admin-logo-status-container">
            {/* Beautiful compact Admin title - no image, no GM Agency name */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-[11px] sm:text-xs tracking-wider shadow-sm select-none">
                AD
              </div>
              <span className="text-xs sm:text-sm font-black tracking-wider text-slate-200 font-sans uppercase">
                Admin Panel
              </span>
            </div>

            {/* Supabase connection status pill (Admin role only!) */}
            <div 
              className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] font-bold border transition-all bg-emerald-950/30 text-emerald-400 border-emerald-900/30`}
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
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold md:flex bg-emerald-950/20 text-emerald-400 border border-emerald-900/20"
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
                currentView === 'admin' && currentPath.includes('settings')
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
              }`}
              title="Settings Admin"
              id="nav-settings-admin"
            >
              <Settings className="h-4 w-4 animate-spin-slow" />
            </button>
          )}

          {/* Navigation View switcher (Only visible in worker mode to return home, hidden for admin and adminshp to keep it clean) */}
          {currentView !== 'home' && currentView !== 'admin' && currentView !== 'adminshp' && (
            <button
              onClick={() => onViewChange('home')}
              className="flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 bg-slate-850 text-white hover:bg-slate-800 shadow-sm cursor-pointer border border-slate-800"
              id="view-toggle-button"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.navHome}</span>
            </button>
          )}

          {/* Language toggle switcher (Hidden on admin and adminshp view) */}
          {currentView !== 'admin' && currentView !== 'adminshp' && (
            <div className="flex items-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900 p-0.5">
              <button
                onClick={() => onLangChange('id')}
                className={`px-1.5 py-1 sm:px-2.5 text-xs font-bold transition-all ${
                  currentLang === 'id'
                    ? 'bg-blue-600 text-white shadow-sm rounded-md'
                    : 'text-slate-400 hover:text-white'
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
                    : 'text-slate-400 hover:text-white'
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
