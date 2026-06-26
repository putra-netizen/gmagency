/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import GMLogo from './GMLogo';
import { Language } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { Globe, ShieldAlert, Home, Grid, Settings, Sun, Moon } from 'lucide-react';

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

  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('gm_theme') === 'dark' || document.documentElement.classList.contains('dark');
    } catch (e) {
      return document.documentElement.classList.contains('dark');
    }
  });

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

  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('gm_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('gm_theme', 'light');
      }
    } catch (e) {
      console.warn('Theme storage is restricted', e);
    }
  }, [darkMode]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white shadow-sm shrink-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo brand */}
        <div 
          onClick={() => onViewChange('home')} 
          className="cursor-pointer transition-transform duration-200 active:scale-95"
          id="brand-logo-container"
        >
          <GMLogo size="sm" showSubtitle={true} />
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 sm:gap-4" id="nav-actions">
          {/* Supabase status pill -> Layanan 24 Jam */}
          {currentView === 'home' && (
            <div 
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold md:flex bg-emerald-50 text-emerald-700 border border-emerald-100"
              title="Layanan 24 Jam"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Layanan 24 Jam</span>
            </div>
          )}

          {/* Settings Admin button - only visible in admin view */}
          {currentView === 'admin' && (
            <button
              onClick={() => {
                window.history.pushState(null, '', '/admin/settings');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className={`items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all flex border cursor-pointer ${
                currentView === 'admin' && currentPath.includes('settings')
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
              }`}
              title="Settings Admin"
              id="nav-settings-admin"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings Admin</span>
            </button>
          )}

          {/* Navigation View switcher (Only visible in admin/worker mode to return home, hidden for public) */}
          {currentView !== 'home' && (
            <button
              onClick={() => onViewChange('home')}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 bg-slate-900 text-white hover:bg-slate-800 shadow-sm cursor-pointer"
              id="view-toggle-button"
            >
              <Home className="h-3.5 w-3.5" />
              <span>{t.navHome}</span>
            </button>
          )}

          {/* Dark Mode toggle button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
            title="Toggle Dark Mode"
            id="dark-mode-toggle"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-500 animate-pulse" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>

          {/* Language toggle switcher */}
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => onLangChange('id')}
              className={`px-2.5 py-1 text-xs font-bold transition-all ${
                currentLang === 'id'
                  ? 'bg-white text-blue-600 shadow-sm rounded-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="lang-toggle-id"
            >
              ID
            </button>
            <button
              onClick={() => onLangChange('en')}
              className={`px-2.5 py-1 text-xs font-bold transition-all ${
                currentLang === 'en'
                  ? 'bg-white text-blue-600 shadow-sm rounded-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="lang-toggle-en"
            >
               EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
