/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import GMLogo from './GMLogo';
import { Language } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { Globe, ShieldAlert, Home, Grid, Settings, RefreshCw, LogOut, Sun, Moon, Menu, X, Wallet, Package, FileSpreadsheet, User, ShieldCheck, Database, TrendingUp, ShoppingBag, Star, MapPin, QrCode, Download, ExternalLink } from 'lucide-react';

import { loginWithBackend, clientLogout, getAuthUser, getViewAsShpSlot, setViewAsShpSlot } from '../lib/auth';

interface NavbarProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
  currentView: 'home' | 'admin' | 'not-found';
  onViewChange: (view: 'home' | 'admin') => void;
  supabaseConnected: boolean;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  isAdminSidebarOpen?: boolean;
  onAdminSidebarOpenChange?: (open: boolean) => void;
}

export default function Navbar({
  currentLang,
  onLangChange,
  currentView,
  onViewChange,
  supabaseConnected,
  theme = 'dark',
  onThemeToggle,
  isAdminSidebarOpen,
  onAdminSidebarOpenChange
}: NavbarProps) {
  const t = TRANSLATIONS[currentLang];

  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const isSidebarOpen = isAdminSidebarOpen !== undefined ? isAdminSidebarOpen : internalSidebarOpen;

  const setSidebarOpen = (updater: boolean | ((prev: boolean) => boolean)) => {
    const nextValue = typeof updater === 'function' ? updater(isSidebarOpen) : updater;
    if (onAdminSidebarOpenChange) {
      onAdminSidebarOpenChange(nextValue);
    } else {
      setInternalSidebarOpen(nextValue);
    }
  };

  const [activeAdminSection, setActiveAdminSection] = useState<{ tab: string; settingsTab: string }>({
    tab: 'shopee_orders',
    settingsTab: 'products'
  });
  const [activeShpTab, setActiveShpTab] = useState<'shopee' | 'maps' | 'report_maps'>('shopee');

  const [viewAsSlot, setViewAsSlot] = useState<string | null>(() => {
    try {
      return getViewAsShpSlot();
    } catch {
      return null;
    }
  });

  const [isAdminAuth, setIsAdminAuth] = useState(() => {
    try {
      const user = getAuthUser();
      if (user?.role === 'admin') return true;
      return sessionStorage.getItem('gm_admin_auth') === 'true' || localStorage.getItem('gm_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [isShpAuth, setIsShpAuth] = useState(() => {
    try {
      const user = getAuthUser();
      if (user?.role === 'admin') return false;
      if (user?.role === 'adminshp') return true;
      const hasAdmin = sessionStorage.getItem('gm_admin_auth') === 'true' || localStorage.getItem('gm_admin_auth') === 'true';
      if (hasAdmin) return false;
      return sessionStorage.getItem('gm_adminshp_auth') === 'true' || localStorage.getItem('gm_adminshp_auth') === 'true';
    } catch (e) {
      return false;
    }
  });

  const isSuperAdminOnly = Boolean(isAdminAuth && !isShpAuth && !viewAsSlot);
  const isAdminShpSession = Boolean((!isAdminAuth && isShpAuth) || (isAdminAuth && viewAsSlot));
  const canShowAdminSidebar = Boolean(currentView === 'admin' && (isSuperAdminOnly || isAdminShpSession));

  const getAdminDisplayName = (): string => {
    if (isSuperAdminOnly) {
      return 'Super Admin';
    }
    try {
      const targetSlot = viewAsSlot || (() => {
        const user = getAuthUser();
        if (user?.role === 'adminshp') {
          return user.slot || user.inputer || user.username || user.name || '';
        }
        return sessionStorage.getItem('gm_adminshp_user') || localStorage.getItem('gm_adminshp_user') || '';
      })();

      const normalized = (targetSlot || '').trim().toLowerCase();
      if (normalized === 'adminshp1' || normalized === 'adminera' || normalized === 'era') return 'Admin Era';
      if (normalized === 'adminshp2' || normalized === 'admincika' || normalized === 'cika') return 'Admin Cika';
      if (normalized === 'adminshp3' || normalized === 'adminvira' || normalized === 'vira') return 'Admin Vira';
      if (normalized === 'adminshp4' || normalized === 'adminarok' || normalized === 'arok' || normalized === 'adminali' || normalized === 'ali' || normalized === 'fadhluali') return 'Admin Arok';

      if (targetSlot) {
        const cleaned = targetSlot.replace(/\b(ali|fadhluali)\b/gi, 'Arok').trim();
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      return 'Admin SHP';
    } catch {
      return 'Admin SHP';
    }
  };

  const adminDisplayName = getAdminDisplayName();

  useEffect(() => {
    if (!canShowAdminSidebar && isSidebarOpen) {
      setSidebarOpen(false);
    }
  }, [canShowAdminSidebar, isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  useEffect(() => {
    const handleRoute = () => {
      setCurrentPath(window.location.pathname);
    };
    const handleTabChanged = (e: Event) => {
      const custom = e as CustomEvent<{ activeTab?: string; activeSettingsTab?: string }>;
      if (custom?.detail) {
        setActiveAdminSection({
          tab: custom.detail.activeTab || 'shopee_orders',
          settingsTab: custom.detail.activeSettingsTab || 'products'
        });
      }
    };
    const handleShpTabChanged = (e: Event) => {
      const custom = e as CustomEvent<{ activeTab?: 'shopee' | 'maps' | 'report_maps' }>;
      if (custom?.detail?.activeTab) {
        setActiveShpTab(custom.detail.activeTab);
      }
    };
    const handleAuthChange = () => {
      const user = getAuthUser();
      const viewAs = getViewAsShpSlot();
      setViewAsSlot(viewAs);

      const hasAdmin = user?.role === 'admin' || sessionStorage.getItem('gm_admin_auth') === 'true' || localStorage.getItem('gm_admin_auth') === 'true';
      setIsAdminAuth(hasAdmin);
      if (hasAdmin) {
        setIsShpAuth(false);
      } else {
        setIsShpAuth(user?.role === 'adminshp' || sessionStorage.getItem('gm_adminshp_auth') === 'true' || localStorage.getItem('gm_adminshp_auth') === 'true');
      }
    };
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('admin-tab-changed', handleTabChanged);
    window.addEventListener('adminshp-tab-changed', handleShpTabChanged);
    window.addEventListener('admin-auth-change', handleAuthChange);
    window.addEventListener('adminshp-auth-change', handleAuthChange);
    window.addEventListener('gm_auth_changed', handleAuthChange);
    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('admin-tab-changed', handleTabChanged);
      window.removeEventListener('adminshp-tab-changed', handleShpTabChanged);
      window.removeEventListener('admin-auth-change', handleAuthChange);
      window.removeEventListener('adminshp-auth-change', handleAuthChange);
      window.removeEventListener('gm_auth_changed', handleAuthChange);
    };
  }, []);

  const navigateSidebar = (eventName: string, urlPath?: string) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    if (urlPath) {
      window.history.pushState(null, '', urlPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    window.dispatchEvent(new CustomEvent(eventName));
  };

  const superAdminGroups = [
    {
      title: 'Manajemen & Keuangan',
      items: [
        {
          id: 'menu-item-keuangan',
          label: 'Keuangan & Omset',
          icon: Wallet,
          isActive: activeAdminSection.tab === 'keuangan',
          onClick: () => navigateSidebar('admin-navigate-keuangan', '/admin/keuangan')
        },
        {
          id: 'menu-item-edit-katalog',
          label: 'Edit Katalog',
          icon: Package,
          isActive: activeAdminSection.tab === 'settings' && activeAdminSection.settingsTab === 'products',
          onClick: () => navigateSidebar('admin-navigate-katalog', '/admin/settings')
        },
        {
          id: 'menu-item-cms-hero-stats',
          label: 'CMS Count Delivery',
          icon: TrendingUp,
          isActive: activeAdminSection.tab === 'settings' && activeAdminSection.settingsTab === 'hero_stats',
          onClick: () => navigateSidebar('admin-navigate-hero-stats', '/admin/settings')
        }
      ]
    },
    {
      title: 'Sistem & Konfigurasi',
      items: [
        {
          id: 'menu-item-qris-config',
          label: 'Konfigurasi QRIS',
          icon: QrCode,
          isActive: activeAdminSection.tab === 'settings' && activeAdminSection.settingsTab === 'qris_config',
          onClick: () => navigateSidebar('admin-navigate-qris', '/admin/settings')
        },
        {
          id: 'menu-item-app-install',
          label: 'Pasang Aplikasi',
          icon: Download,
          isActive: activeAdminSection.tab === 'settings' && activeAdminSection.settingsTab === 'app_install',
          onClick: () => navigateSidebar('admin-navigate-app-install', '/admin/settings')
        }
      ]
    }
  ];

  const adminShpGroups = [
    {
      title: 'Menu Workspace',
      items: [
        {
          id: 'sidebar-shp-item-shopee',
          label: 'Report Sosmed & Spam WA',
          icon: ShoppingBag,
          isActive: activeShpTab === 'shopee',
          onClick: () => navigateSidebar('adminshp-navigate-shopee')
        },
        {
          id: 'sidebar-shp-item-reviews',
          label: 'Review Orders',
          icon: Star,
          isActive: activeShpTab === 'maps',
          onClick: () => navigateSidebar('adminshp-navigate-maps')
        },
        {
          id: 'sidebar-shp-item-reports',
          label: 'Report Orders',
          icon: MapPin,
          isActive: activeShpTab === 'report_maps',
          onClick: () => navigateSidebar('adminshp-navigate-report-maps')
        }
      ]
    }
  ];

  const activeSidebarGroups = isSuperAdminOnly ? superAdminGroups : adminShpGroups;

  return (
    <>
      <header className={`sticky top-0 z-[65] w-full border-b backdrop-blur-md shrink-0 transition-colors duration-300 ${
        currentView === 'home'
          ? (theme === 'dark'
              ? 'border-slate-800 bg-slate-950/80 shadow-lg shadow-black/20 text-white'
              : 'border-slate-200 bg-white/80 shadow-sm text-slate-900')
          : 'border-slate-200 bg-white/95 shadow-xs text-slate-900'
      }`}>
        <div className={`mx-auto flex h-16 items-center justify-between px-4 sm:px-6 ${
          currentView === 'admin' && canShowAdminSidebar ? 'w-full' : 'max-w-7xl lg:px-8'
        }`}>
          
          {/* Logo brand or Admin Title */}
          {currentView === 'admin' ? (
            <div className="relative flex items-center gap-2.5 sm:gap-3" id="admin-logo-status-container">
              {/* Layout spacer aligned with the fixed animated Hamburger-to-X toggle button */}
              {canShowAdminSidebar && (
                <div className="h-9 w-9 shrink-0" aria-hidden="true" />
              )}

              <div 
                onClick={() => {
                  if (!isAdminAuth && !isShpAuth) {
                    onViewChange('home');
                  }
                }}
                className={`flex items-center gap-2 ${!isAdminAuth && !isShpAuth ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
                title={!isAdminAuth && !isShpAuth ? "Kembali ke Beranda" : undefined}
              >
                <GMLogo size="xs" showSubtitle={false} hideText={true} />
                <span className="text-xs sm:text-sm font-black tracking-wider font-sans uppercase text-slate-800 whitespace-nowrap">
                  ADMIN WORKING SPACE
                </span>
              </div>
            </div>
          ) : (
          /* Clean Logo & Brand Lockup without white capsule, adapting to Light/Dark Mode */
          <div 
            onClick={() => onViewChange('home')} 
            className="flex cursor-pointer transition-all duration-200 active:scale-95 py-1 items-center justify-center"
            id="brand-logo-container"
          >
            <GMLogo size="sm" showSubtitle={true} theme={theme} />
          </div>
        )}

        {/* Action controls */}
        <div className="flex items-center gap-1.5 sm:gap-3" id="nav-actions">

          {/* Minimalist icon-only top-right actions for Super Admin & Admin SHP */}
          {currentView === 'admin' && canShowAdminSidebar && (
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Transparent Icon-Only Refresh */}
              <button
                type="button"
                onClick={() => {
                  if (isAdminShpSession) {
                    window.dispatchEvent(new CustomEvent('adminshp-refresh'));
                  } else {
                    window.dispatchEvent(new CustomEvent('admin-refresh'));
                  }
                }}
                className="flex h-8 w-8 items-center justify-center bg-transparent border-0 shadow-none p-0 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                title="Refresh Data"
                aria-label="Refresh Data"
                id={isAdminShpSession && !isAdminAuth ? 'nav-refresh-adminshp' : 'nav-refresh-admin'}
              >
                <RefreshCw className="h-[18px] w-[18px]" />
              </button>

              {/* Transparent Icon-Only Log Out / Exit */}
              <button
                type="button"
                onClick={() => {
                  if (viewAsSlot) {
                    setViewAsShpSlot(null);
                    setViewAsSlot(null);
                  } else if (isAdminShpSession) {
                    window.dispatchEvent(new CustomEvent('adminshp-logout'));
                  } else {
                    window.dispatchEvent(new CustomEvent('admin-logout'));
                  }
                }}
                className="flex h-8 w-8 items-center justify-center bg-transparent border-0 shadow-none p-0 text-slate-500 hover:text-red-600 transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
                title={viewAsSlot ? "Kembali ke Super Admin" : "Keluar"}
                aria-label={viewAsSlot ? "Kembali ke Super Admin" : "Keluar"}
                id={isAdminShpSession && !isAdminAuth ? 'nav-logout-adminshp' : 'nav-logout-admin'}
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>

              {/* Flat Profile Icon + Admin Name (Shown to the right of Exit icon when sidebar is hidden to the left) */}
              <AnimatePresence initial={false}>
                {!isSidebarOpen && (
                  <motion.div
                    key="nav-hidden-sidebar-profile"
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-1.5 text-slate-600 select-none pl-0.5"
                    id={isAdminShpSession && !isAdminAuth ? 'nav-identity-adminshp' : 'nav-identity-superadmin'}
                    title={adminDisplayName}
                  >
                    <User className="h-[18px] w-[18px] text-slate-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap truncate max-w-[110px] sm:max-w-none">
                      {adminDisplayName}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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

          {/* Language toggle switcher (Shown only on home view) */}
          {currentView === 'home' && (
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

      {/* ROLE-SCOPED ADMIN SIDEBAR (Super Admin & All Admin SHP Roles, hidden on Login Portal) */}
      {canShowAdminSidebar && (
        <>
          <button
            type="button"
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-expanded={isSidebarOpen}
            aria-controls="admin-sidebar-panel"
            aria-label={isSidebarOpen ? 'Tutup Sidebar Admin' : 'Buka Sidebar Admin'}
            title={isSidebarOpen ? 'Tutup Sidebar' : 'Buka Menu Admin'}
            id="admin-hamburger-btn"
            className="fixed top-3.5 left-4 sm:left-6 z-[70] flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer shadow-sm active:scale-95 border border-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
              <motion.span
                className="absolute h-[2px] w-4 rounded-full bg-current"
                initial={false}
                animate={isSidebarOpen ? { y: 0, rotate: 45 } : { y: -5, rotate: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.span
                className="absolute h-[2px] w-4 rounded-full bg-current"
                initial={false}
                animate={isSidebarOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.span
                className="absolute h-[2px] w-4 rounded-full bg-current"
                initial={false}
                animate={isSidebarOpen ? { y: 0, rotate: -45 } : { y: 5, rotate: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          </button>

          <AnimatePresence>
            {isSidebarOpen && (
              <motion.aside
                key="admin-sidebar-panel"
                id="admin-sidebar-panel"
                aria-label={isSuperAdminOnly ? 'Navigasi Utama Super Admin' : 'Navigasi Admin SHP'}
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="fixed top-16 bottom-0 left-0 z-[60] flex w-[272px] sm:w-[280px] flex-col bg-white border-r border-slate-200 shadow-[4px_0_24px_-4px_rgba(15,23,42,0.08)]"
              >
                {/* Sidebar Navigation Groups (No grey scrollbar) */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {activeSidebarGroups.map((group) => (
                    <div key={group.title} className="space-y-1">
                      <div className="px-3 pb-1 text-[11px] font-bold tracking-wider uppercase text-slate-400">
                        {group.title}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              id={item.id}
                              onClick={item.onClick}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors duration-150 cursor-pointer text-left ${
                                item.isActive
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 shrink-0 ${
                                  item.isActive ? 'text-white' : 'text-slate-500'
                                }`}
                              />
                              <span className="truncate whitespace-nowrap">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>

                {/* Sidebar Action Footer (No account info box) */}
                <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 p-3">
                  {isSuperAdminOnly ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSidebarOpen(false);
                          onViewChange('home');
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span>Beranda</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSidebarOpen(false);
                          window.dispatchEvent(new CustomEvent('admin-logout'));
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <LogOut className="h-3.5 w-3.5 shrink-0" />
                        <span>Keluar</span>
                      </button>
                    </div>
                  ) : viewAsSlot ? (
                    <button
                      type="button"
                      onClick={() => {
                        setViewAsShpSlot(null);
                        setViewAsSlot(null);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" />
                      <span>Kembali ke Super Admin</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarOpen(false);
                        window.dispatchEvent(new CustomEvent('adminshp-logout'));
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" />
                      <span>Keluar</span>
                    </button>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
}
