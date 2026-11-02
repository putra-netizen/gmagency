/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductCard from './components/ProductCard';
import CheckoutModal from './components/CheckoutModal';
import AdminPanel from './components/AdminPanel';
import AdminShpPanel from './components/AdminShpPanel';
import { WorkerPanel } from './components/WorkerPanel';
import { FinanceView } from './components/FinanceView';
import ToastContainer from './components/ToastContainer';
import { Product, Language, Order } from './types';
import { dbGetProducts, isSupabaseConfigured, dbIsSupabaseConnected, supabase } from './lib/supabase';
import { TRANSLATIONS } from './lib/translations';
import { initGlobalAutoSync } from './utils/autoSyncManager';
import { getAuthUser, resolveUserRole, getViewAsShpSlot, setViewAsShpSlot } from './lib/auth';
import { MessageSquare, Phone, MapPin, Mail, Clock, ShieldCheck, Heart, AlertCircle, Shield, Award, Sparkles, CheckCircle2, UserCheck, ArrowRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RevealFadeUp, RevealScale, RevealStaggerContainer, RevealStaggerItem } from './components/RevealMotion';
import { GM_LOGO_DATA_URI, GM_LOGO_LOCAL_512 } from './utils/gmLogoAsset';

export default function App() {
  // Global States
  const [currentLang, setCurrentLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('gm_lang');
      return (saved === 'id' || saved === 'en') ? saved : 'id';
    } catch (e) {
      return 'id';
    }
  });

  const [currentView, setCurrentView] = useState<'home' | 'admin' | 'not-found'>(() => {
    const path = window.location.pathname;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone && (path === '/' || path === '' || path === '/home')) {
      try {
        window.history.replaceState(null, '', '/admin');
      } catch (e) {}
      return 'admin';
    }
    if (path === '/' || path === '' || path === '/home') return 'home';
    if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
    return 'not-found';
  });

  // Track authenticated role for portal: 'admin' | 'adminshp' | 'finance' | 'worker' | null
  const [adminRole, setAdminRole] = useState<'admin' | 'adminshp' | 'finance' | 'worker' | null>(() => {
    try {
      const user = getAuthUser();
      if (user?.role) return user.role;
      return null;
    } catch (e) {
      return null;
    }
  });

  const [viewAsShpSlot, setViewAsShpSlotState] = useState<string | null>(() => {
    return getViewAsShpSlot();
  });

  useEffect(() => {
    // 1. Initial check with official Supabase getSession
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const authUser = await resolveUserRole(session.user);
        setAdminRole(authUser.role);
      }
    }).catch(console.error);

    // 2. Official Supabase onAuthStateChange listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser = await resolveUserRole(session.user);
        setAdminRole(authUser.role);
      } else if (event === 'SIGNED_OUT') {
        setAdminRole(null);
        setViewAsShpSlot(null);
        setViewAsShpSlotState(null);
      }
    });

    const handleAuthChange = () => {
      try {
        const user = getAuthUser();
        if (user?.role) {
          setAdminRole(user.role);
        } else {
          setAdminRole(null);
        }
        setViewAsShpSlotState(getViewAsShpSlot());
      } catch (e) {
        setAdminRole(null);
        setViewAsShpSlotState(null);
      }
    };
    window.addEventListener('admin-auth-change', handleAuthChange);
    window.addEventListener('adminshp-auth-change', handleAuthChange);
    window.addEventListener('gm_auth_changed', handleAuthChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('admin-auth-change', handleAuthChange);
      window.removeEventListener('adminshp-auth-change', handleAuthChange);
      window.removeEventListener('gm_auth_changed', handleAuthChange);
    };
  }, []);

  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallToast, setShowInstallToast] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      const isInstalled = localStorage.getItem('gm_install_installed') === 'true';
      const isDismissed = sessionStorage.getItem('gm_install_dismissed') === 'true';

      // Only prompt when in the admin panel, not standalone, not installed, and not dismissed
      if (currentView === 'admin' && !isStandalone && !isInstalled && !isDismissed) {
        setShowInstallToast(true);
      }
    };

    const handleAppInstalled = () => {
      localStorage.setItem('gm_install_installed', 'true');
      setShowInstallToast(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show custom prompt after 4 seconds if in the admin view and conditions are met
    const timer = setTimeout(() => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      const isInstalled = localStorage.getItem('gm_install_installed') === 'true';
      if (currentView === 'admin' && !isStandalone && !isInstalled) {
        try {
          const dismissed = sessionStorage.getItem('gm_install_dismissed') === 'true';
          if (!dismissed) {
            setShowInstallToast(true);
          }
        } catch (err) {}
      }
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, [currentView]);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      if (outcome === 'accepted') {
        localStorage.setItem('gm_install_installed', 'true');
      }
      setDeferredPrompt(null);
      setShowInstallToast(false);
    } else {
      alert(
        currentLang === 'id'
          ? 'Untuk memasang GM AGENCY di perangkat Anda:\n\n' +
            '• Safari (iOS): Klik tombol "Share" (Bagikan) 📤 di baris bawah browser, lalu pilih "Add to Home Screen" (Tambahkan ke Layar Utama) ➕.\n\n' +
            '• Chrome (Android/PC): Klik ikon menu titik tiga ⁝ di kanan atas browser, lalu pilih "Install app" (Instal aplikasi) atau "Tambahkan ke Layar Utama".'
          : 'To install GM AGENCY on your device:\n\n' +
            '• Safari (iOS): Tap the "Share" button 📤 at the bottom of the screen, then choose "Add to Home Screen" ➕.\n\n' +
            '• Chrome (Android/PC): Tap the menu icon ⁝ at the top right, then select "Install app" or "Add to Home Screen".'
      );
    }
  };

  const handleDismissInstall = () => {
    setShowInstallToast(false);
    try {
      sessionStorage.setItem('gm_install_dismissed', 'true');
    } catch (e) {}
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const servicesSectionRef = useRef<HTMLDivElement>(null);

  // Global Automatic Sync for ANY device (Runs on startup without manual clicks)
  useEffect(() => {
    initGlobalAutoSync();
  }, []);

  // Sync translation to localStorage
  const handleLangChange = (lang: Language) => {
    setCurrentLang(lang);
    try {
      localStorage.setItem('gm_lang', lang);
    } catch (e) {
      console.warn('Storage access is restricted', e);
    }
  };

  // Sync route pathname (SPA routing)
  const handleViewChange = (view: 'home' | 'admin') => {
    setCurrentView(view);
    if (view === 'admin') {
      window.history.pushState(null, '', '/admin');
    } else {
      window.history.pushState(null, '', '/home');
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Listen to path changes
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      
      // Cleanly strip any trailing hash leftover from old routes to keep URL pristine
      if (window.location.hash) {
        window.history.replaceState(null, '', path);
      }

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

      if (isStandalone && (path === '/' || path === '' || path === '/home')) {
        window.history.replaceState(null, '', '/admin');
        setCurrentView('admin');
      } else if (path === '/' || path === '' || path === '/home') {
        setCurrentView('home');
      } else if (path === '/admin' || path.startsWith('/admin/')) {
        setCurrentView('admin');
      } else {
        // Obsolete routes (e.g. /worker1-8, /adminshp, /adminshp1-4, etc.) show 404
        setCurrentView('not-found');
      }
    };
    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Fetch products catalogue
  const loadProducts = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await dbGetProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(currentLang === 'id' ? 'Gagal memuat katalog layanan.' : 'Failed to load services catalogue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'home') {
      loadProducts();
      
      const interval = setInterval(() => {
        if (document.hidden) return;
        // Silent background refresh of products to provide automatic realtime updates
        dbGetProducts()
          .then((data) => {
            setProducts(data);
          })
          .catch((err) => console.error('Silent products refresh failed:', err));
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [currentView]);

  const t = TRANSLATIONS[currentLang];

  const scrollToServices = () => {
    servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('gm_theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  const handleThemeToggle = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('gm_theme', next);
      } catch (e) {}
      return next;
    });
  };

  const isDarkHome = currentView === 'home' && theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-300 ${
      isDarkHome ? 'bg-[#070b19] text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* 1. Header Navbar */}
      <Navbar
        currentLang={currentLang}
        onLangChange={handleLangChange}
        currentView={currentView}
        onViewChange={handleViewChange}
        supabaseConnected={dbIsSupabaseConnected()}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />

      {/* 2. Main Content Views */}
      <main className="flex-grow">
        {currentView === 'home' ? (
          /* HOME/SERVICES LANDING SCREEN */
          <div className="fade-in">
            {/* Hero Section Banner */}
            <Hero 
              currentLang={currentLang} 
              onExploreClick={scrollToServices} 
              theme={theme}
            />

            {/* TRUST & ADVANTAGES SECTION — 4 PILLARS WITH REVEAL MOTION */}
            <section className={`border-b transition-colors duration-300 py-14 sm:py-16 ${
              theme === 'dark' ? 'bg-[#090e24] border-slate-800/80' : 'bg-slate-100/70 border-slate-200'
            }`} id="landing-trust-pillars">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Section Header with Reveal */}
                <RevealFadeUp className="text-center max-w-2xl mx-auto mb-10 space-y-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest border ${
                    theme === 'dark' 
                      ? 'bg-blue-950/40 text-blue-400 border-blue-900/40' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    <span>{currentLang === 'id' ? 'KEUNGGULAN UTAMA GM' : 'CORE GM ADVANTAGES'}</span>
                  </span>
                  <h3 className={`text-2xl sm:text-3xl font-black font-sans tracking-tight ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {currentLang === 'id' 
                      ? 'Kenapa Ribuan Brand Memilih GM Agency?' 
                      : 'Why Thousands of Brands Trust GM Agency?'}
                  </h3>
                  <p className={`text-xs sm:text-sm font-sans leading-relaxed ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {currentLang === 'id'
                      ? 'Layanan reputasi digital dengan standar manual ketat, kepatuhan platform 100%, dan garansi perlindungan penuh.'
                      : 'Enterprise-grade reputation services built on strict manual protocols, 100% compliance, and full retention warranties.'}
                  </p>
                </RevealFadeUp>

                {/* 4 Pillars Grid with Staggered Scroll Reveal */}
                <RevealStaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Pillar 1 */}
                  <RevealStaggerItem className={`p-6 rounded-2xl border transition-all duration-300 group ${
                    theme === 'dark'
                      ? 'bg-slate-900/60 border-slate-800/90 hover:border-emerald-500/50 hover:bg-slate-900'
                      : 'bg-white border-slate-200 hover:border-emerald-500/50 hover:shadow-lg'
                  }`}>
                    <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <h4 className={`text-sm font-black mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' ? '100% Real Human / Manual' : '100% Real Human / Manual'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Dikerjakan akun aktif nyata tanpa bot atau skrip berbahaya demi keamanan profil bisnis Anda.'
                        : 'Executed by real human accounts with zero bot automation to protect your business standing.'}
                    </p>
                  </RevealStaggerItem>

                  {/* Pillar 2 */}
                  <RevealStaggerItem className={`p-6 rounded-2xl border transition-all duration-300 group ${
                    theme === 'dark'
                      ? 'bg-slate-900/60 border-slate-800/90 hover:border-amber-500/50 hover:bg-slate-900'
                      : 'bg-white border-slate-200 hover:border-amber-500/50 hover:shadow-lg'
                  }`}>
                    <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Award className="h-5 w-5" />
                    </div>
                    <h4 className={`text-sm font-black mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' ? 'Garansi Retensi Penuh' : 'Full Retention Guarantee'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Jaminan ulasan tetap bertahan & perlindungan kualitas layanan profesional tanpa cemas turun.'
                        : 'Assured review stability and dedicated retention protection for your peace of mind.'}
                    </p>
                  </RevealStaggerItem>

                  {/* Pillar 3 */}
                  <RevealStaggerItem className={`p-6 rounded-2xl border transition-all duration-300 group ${
                    theme === 'dark'
                      ? 'bg-slate-900/60 border-slate-800/90 hover:border-blue-500/50 hover:bg-slate-900'
                      : 'bg-white border-slate-200 hover:border-blue-500/50 hover:shadow-lg'
                  }`}>
                    <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Shield className="h-5 w-5" />
                    </div>
                    <h4 className={`text-sm font-black mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' ? 'Privasi 100% Terjaga' : '100% Private & Confidential'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Tanpa akses sandi akun target. Seluruh data identitas pemesan dirahasiakan ketat.'
                        : 'Zero password required. Target URLs and customer credentials remain strictly confidential.'}
                    </p>
                  </RevealStaggerItem>

                  {/* Pillar 4 */}
                  <RevealStaggerItem className={`p-6 rounded-2xl border transition-all duration-300 group ${
                    theme === 'dark'
                      ? 'bg-slate-900/60 border-slate-800/90 hover:border-purple-500/50 hover:bg-slate-900'
                      : 'bg-white border-slate-200 hover:border-purple-500/50 hover:shadow-lg'
                  }`}>
                    <div className="h-11 w-11 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Zap className="h-5 w-5" />
                    </div>
                    <h4 className={`text-sm font-black mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' ? 'Monitoring & Transparan' : 'Live Monitoring & Reports'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Proses terjadwal secara bertahap natural dengan rekap link target live setelah tuntas.'
                        : 'Executed at natural intervals with complete verification links provided upon delivery.'}
                    </p>
                  </RevealStaggerItem>
                </RevealStaggerContainer>
              </div>
            </section>

            {/* Services Catalogue Section Grid with Scroll Reveal */}
            <div 
              ref={servicesSectionRef} 
              className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 scroll-mt-12"
              id="services-catalogue"
            >
              {/* Grid Header with Reveal Motion */}
              <RevealFadeUp className="text-center max-w-3xl mx-auto mb-10 space-y-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest border ${
                  theme === 'dark' 
                    ? 'bg-blue-950/40 text-blue-400 border-blue-900/40' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {currentLang === 'id' ? 'KATALOG DIGITAL RESMI' : 'OFFICIAL DIGITAL CATALOGUE'}
                </span>
                <h2 className={`text-2xl sm:text-3xl font-black font-sans tracking-tight uppercase ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {t.productsTitle}
                </h2>
                <p className={`font-sans leading-relaxed text-xs sm:text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {t.productsSub}
                </p>
              </RevealFadeUp>

              {/* Grid Content Loader */}
              {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3">
                  <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-semibold text-slate-400">Loading digital services...</span>
                </div>
              ) : errorMsg ? (
                <div className="mx-auto max-w-md rounded-xl bg-red-950/20 border border-red-900/30 p-5 text-center text-sm font-semibold text-red-400">
                  {errorMsg}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  {products.map((product, idx) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      currentLang={currentLang}
                      onCheckoutClick={(prod) => setSelectedProduct(prod)}
                      theme={theme}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* HOW IT WORKS / 3-STEP ORDERING WORKFLOW SECTION WITH REVEAL MOTION */}
            <section className={`border-t transition-colors duration-300 py-16 sm:py-20 ${
              theme === 'dark' ? 'bg-[#050814] border-slate-900' : 'bg-slate-100/60 border-slate-200'
            }`} id="landing-workflow">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Workflow Header with Reveal */}
                <RevealFadeUp className="text-center max-w-2xl mx-auto mb-12 space-y-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest border ${
                    theme === 'dark' 
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{currentLang === 'id' ? 'CARA KERJA CEPAT' : 'SIMPLE WORKFLOW'}</span>
                  </span>
                  <h3 className={`text-2xl sm:text-3xl font-black font-sans tracking-tight ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {currentLang === 'id' 
                      ? '3 Langkah Mudah Memulai Kampanye' 
                      : '3 Simple Steps to Start Your Campaign'}
                  </h3>
                  <p className={`text-xs sm:text-sm font-sans leading-relaxed ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {currentLang === 'id'
                      ? 'Tanpa proses rumit. Mulai dalam hitungan menit dan pantau hasil pesanan Anda secara nyata.'
                      : 'No hassle. Get started in minutes and track verifiable campaign outcomes.'}
                  </p>
                </RevealFadeUp>

                {/* 3 Step Cards with Staggered Scroll Reveal */}
                <RevealStaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                  {/* Step 1 */}
                  <RevealStaggerItem className={`relative p-6 sm:p-7 rounded-2xl border transition-all duration-300 ${
                    theme === 'dark' ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black text-blue-500 font-mono">01</span>
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        theme === 'dark' ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {currentLang === 'id' ? 'PILIH' : 'SELECT'}
                      </span>
                    </div>
                    <h4 className={`text-base font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' ? 'Pilih Layanan & Target' : 'Select Service & Target'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Pilih layanan yang Anda perlukan di katalog, tentukan jumlah pcs, dan masukkan link target atau nomor kontak.'
                        : 'Browse our catalogue, specify quantity in pcs, and provide your target URL or contact details.'}
                    </p>
                  </RevealStaggerItem>

                  {/* Step 2 */}
                  <RevealStaggerItem className={`relative p-6 sm:p-7 rounded-2xl border transition-all duration-300 ${
                    theme === 'dark' ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black text-emerald-500 font-mono">02</span>
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        theme === 'dark' ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {currentLang === 'id' ? 'BAYAR QRIS' : 'PAY QRIS'}
                      </span>
                    </div>
                    <h4 className={`text-base font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' ? 'Bayar Otomatis QRIS' : 'Automated QRIS Checkout'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Pindai barcode QRIS otomatis dengan aplikasi pembayaran atau m-banking Anda, lalu konfirmasi instan via WhatsApp.'
                        : 'Scan the dynamic QRIS code with any mobile banking or e-wallet, then confirm directly via official WhatsApp.'}
                    </p>
                  </RevealStaggerItem>

                  {/* Step 3 */}
                  <RevealStaggerItem className={`relative p-6 sm:p-7 rounded-2xl border transition-all duration-300 ${
                    theme === 'dark' ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black text-purple-500 font-mono">03</span>
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        theme === 'dark' ? 'bg-purple-950/60 text-purple-400' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {currentLang === 'id' ? 'SELESAI' : 'COMPLETE'}
                      </span>
                    </div>
                    <h4 className={`text-base font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' ? 'Eksekusi Manual & Selesai' : 'Manual Delivery & Proof'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Tim jaringan GM Agency langsung menjalankan tugas manual secara natural dan mengirimkan tautan rekap pengerjaan.'
                        : 'Our manual network executes the campaign naturally and delivers complete report links upon completion.'}
                    </p>
                  </RevealStaggerItem>
                </RevealStaggerContainer>

                {/* Bottom CTA Banner with Reveal */}
                <RevealFadeUp delay={0.2} className={`mt-12 p-6 sm:p-8 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-6 ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border-blue-900/40' 
                    : 'bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50 border-blue-200'
                }`}>
                  <div className="space-y-1 text-center sm:text-left">
                    <h4 className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLang === 'id' 
                        ? 'Siap Meningkatkan Reputasi Bisnis Anda Hari Ini?' 
                        : 'Ready to Elevate Your Business Reputation Today?'}
                    </h4>
                    <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {currentLang === 'id'
                        ? 'Konsultasi gratis bersama tim spesialis reputasi GM Agency melalui WhatsApp resmi.'
                        : 'Free consultation with GM Agency reputation specialists on official WhatsApp.'}
                    </p>
                  </div>
                  <a
                    href="https://wa.me/6285921095666?text=Halo%20GM%20Agency%2C%20saya%20ingin%20konsultasi%20layanan%20reputasi%20digital."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <span>{currentLang === 'id' ? 'Konsultasi Sekarang' : 'Consult Now'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </RevealFadeUp>
              </div>
            </section>
          </div>
        ) : currentView === 'not-found' ? (
          /* 404 - HALAMAN TIDAK DITEMUKAN SCREEN */
          <div className="min-h-[65vh] flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4 shadow-xs">
              <AlertCircle className="h-8 w-8 stroke-[2.2]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 font-sans tracking-tight">
              404 - Halaman Tidak Ditemukan
            </h1>
            <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
              {currentLang === 'id'
                ? 'Halaman atau portal yang Anda akses tidak tersedia. Akses seluruh portal manajemen GM Agency kini telah dipusatkan satu pintu di /admin.'
                : 'The page you are trying to access is not available. All GM Agency management portals are now unified at /admin.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => handleViewChange('admin')}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Buka Portal /admin
              </button>
              <button
                onClick={() => handleViewChange('home')}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        ) : (
          /* UNIFIED MANAGEMENT PORTAL SCREEN (/admin) */
          <div className="fade-in">
            {adminRole === 'adminshp' || (adminRole === 'admin' && viewAsShpSlot) ? (
              <AdminShpPanel
                currentLang={currentLang}
                viewAsSlot={viewAsShpSlot}
                onReturnToGmAdmin={() => {
                  setViewAsShpSlot(null);
                  setViewAsShpSlotState(null);
                  if (adminRole !== 'admin') {
                    const user = getAuthUser();
                    if (user?.role === 'admin') {
                      setAdminRole('admin');
                    }
                  }
                }}
              />
            ) : (
              <AdminPanel
                currentLang={currentLang}
                onInstallApp={handleInstallApp}
                onSwitchToAdminShp={() => {
                  const user = getAuthUser();
                  const slot = user?.slot || (user?.inputer && user.inputer !== 'adminshp' ? (user.inputer === 'vira' ? 'adminshp3' : user.inputer === 'cika' ? 'adminshp2' : (user.inputer === 'arok' || user.inputer === 'ali') ? 'adminshp4' : user.inputer === 'era' ? 'adminshp1' : null) : null) || getViewAsShpSlot();
                  if (slot) {
                    setViewAsShpSlot(slot);
                    setViewAsShpSlotState(slot);
                  }
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* 3. Global Static Footer */}
      {currentView === 'home' && (
        <footer className={`transition-colors duration-300 font-sans mt-auto ${
          theme === 'dark' 
            ? 'bg-slate-950 text-slate-400 border-t border-slate-900' 
            : 'bg-slate-100 text-slate-600 border-t border-slate-200'
        }`}>
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <RevealFadeUp className={`grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b ${
              theme === 'dark' ? 'border-slate-900' : 'border-slate-200'
            }`}>
              {/* About brand column (5 columns) */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-10 w-10 shrink-0 rounded-full bg-white border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center overflow-hidden p-0.5">
                    <img
                      src={GM_LOGO_DATA_URI}
                      alt="GM Agency Logo"
                      className="w-full h-full object-contain rounded-full"
                      onError={(e) => {
                        if (e.currentTarget.src !== GM_LOGO_LOCAL_512) {
                          e.currentTarget.src = GM_LOGO_LOCAL_512;
                        }
                      }}
                    />
                  </div>
                  <span className={`text-lg font-black tracking-widest ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>GM AGENCY</span>
                </div>
                <p className={`text-sm leading-relaxed max-w-sm font-light ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-650'
                }`}>
                  {currentLang === 'id'
                    ? 'Penyedia solusi manajemen reputasi, optimasi pencarian peta, dan engagement organik sosial media terlengkap, profesional, dan 100% legal.'
                    : 'Leading professional reputation managers, local SEO optimization, and compliant organic engagement digital services.'
                  }
                </p>
                <div className={`flex items-center gap-2.5 text-xs font-bold w-fit px-3.5 py-1.5 rounded-full border ${
                  theme === 'dark' 
                    ? 'text-blue-400 bg-blue-950/40 border-blue-900/30' 
                    : 'text-blue-600 bg-blue-50 border-blue-100'
                }`}>
                  <ShieldCheck className="h-4 w-4" />
                  <span>100% LEGAL & COMPLIANT SERVICES</span>
                </div>
              </div>

              {/* Quick links columns (4 columns) */}
              <div className="md:col-span-4 space-y-4">
                <h4 className={`text-xs font-black uppercase tracking-widest ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {currentLang === 'id' ? 'Layanan Kami' : 'Core Services'}
                </h4>
                <ul className="space-y-2.5 text-sm font-light">
                  <li><span className="hover:text-blue-400 transition-colors cursor-pointer" onClick={() => { setCurrentView('home'); setTimeout(scrollToServices, 100); }}>Google Maps Reputation</span></li>
                  <li><span className="hover:text-blue-400 transition-colors cursor-pointer" onClick={() => { setCurrentView('home'); setTimeout(scrollToServices, 100); }}>Tripadvisor Management</span></li>
                  <li><span className="hover:text-blue-400 transition-colors cursor-pointer" onClick={() => { setCurrentView('home'); setTimeout(scrollToServices, 100); }}>App Store Rating Assistance</span></li>
                  <li><span className="hover:text-blue-400 transition-colors cursor-pointer" onClick={() => { setCurrentView('home'); setTimeout(scrollToServices, 100); }}>Social Media Compliance</span></li>
                </ul>
              </div>

              {/* Contact details columns (3 columns) */}
              <div className="md:col-span-3 space-y-4">
                <h4 className={`text-xs font-black uppercase tracking-widest ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  Contact & Location
                </h4>
                <ul className="space-y-3 text-sm font-light">
                  <li className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>Jakarta Selatan, Indonesia</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>+62 859-2109-5666</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>support@gmagency.com</span>
                  </li>
                </ul>
              </div>
            </RevealFadeUp>

            {/* Copyright signature */}
            <RevealFadeUp delay={0.15} className={`pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-light ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-650'
            }`}>
              <p>
                &copy; {new Date().getFullYear()} GM AGENCY (GM GROUP). All rights reserved.
              </p>
              <p className="flex items-center gap-1">
                Crafted professionally with 
                <Heart className="h-3 w-3 text-red-500 fill-red-500" />
                for business reputational organic growth.
              </p>
            </RevealFadeUp>
          </div>
        </footer>
      )}

      {/* 4. One-Page Checkout Modal Overlay */}
      {selectedProduct && (
        <CheckoutModal
          product={selectedProduct}
          currentLang={currentLang}
          onClose={() => setSelectedProduct(null)}
          onSuccess={(order) => {
            // Success action: keep modal open to show successful invoice & WA button, 
            // but we can refresh the admin background states silently
            loadProducts();
          }}
        />
      )}

      {/* 5. Floating Global WhatsApp chat button with real logo and glowing aura */}
      {currentView === 'home' && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          {/* Decorative Message Bubble */}
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="hidden sm:flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 text-xs font-bold text-slate-800"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>
              {currentLang === 'id' ? 'Ada Pertanyaan? Chat Sekarang!' : 'Any Questions? Chat Now!'}
            </span>
          </motion.div>

          {/* Interactive Floating Pulse Button */}
          <motion.a
            href="https://wa.me/6285921095666?text=Halo%20GM%20Agency%2C%20saya%20ingin%20berkonsultasi%20mengenai%20layanan%20reputasi%20digital%20bisnis."
            target="_blank"
            rel="noopener noreferrer"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              y: [0, -8, 0]
            }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            transition={{
              scale: { type: "spring", stiffness: 260, damping: 20 },
              opacity: { duration: 0.2 },
              y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
            }}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white shadow-[0_4px_25px_rgba(37,211,102,0.45)] hover:shadow-[0_4px_35px_rgba(37,211,102,0.7)] cursor-pointer"
            title="Hubungi GM Agency via WhatsApp"
            id="global-floating-whatsapp"
          >
            {/* Pulsating background ring */}
            <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
            
            {/* Real WhatsApp SVG Logo */}
            <svg 
              viewBox="0 0 24 24" 
              className="h-7 w-7 fill-white drop-shadow-md"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.729-1.448L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.387 1.966 13.92 1.922 12.007 1.92c-5.439 0-9.865 4.37-9.869 9.8-.001 1.716.463 3.39 1.342 4.88l-.991 3.616 3.731-.963zm10.868-6.082c-.29-.146-1.72-.85-1.985-.947-.266-.097-.46-.146-.653.146-.193.291-.748.946-.917 1.14-.17.194-.339.219-.63.073-.29-.146-1.229-.453-2.34-1.445-.864-.772-1.448-1.725-1.618-2.016-.17-.29-.018-.447.127-.592.13-.13.29-.34.436-.51.145-.17.194-.291.291-.486.097-.194.048-.364-.025-.51-.072-.146-.653-1.577-.894-2.16-.236-.569-.475-.49-.653-.49-.17 0-.364-.025-.558-.025-.194 0-.51.073-.775.364-.266.29-1.018.996-1.018 2.43 0 1.434 1.043 2.818 1.189 3.012.145.195 2.052 3.134 4.973 4.394.694.3 1.236.48 1.658.614.698.221 1.334.19 1.837.115.56-.083 1.72-.704 1.963-1.385.242-.682.242-1.264.17-1.385-.072-.122-.266-.195-.558-.34z" />
            </svg>
          </motion.a>
        </div>
      )}

      {/* PWA Install Banner/Toast */}
      <AnimatePresence>
        {showInstallToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-800 p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-4 text-white animate-fade-in"
            id="pwa-install-toast"
          >
            <div className="flex items-start gap-4">
              {/* Enlarged Favicon Logo */}
              <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-white border border-slate-700 shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center p-1">
                <img
                  src={GM_LOGO_DATA_URI}
                  alt="GM Agency Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (e.currentTarget.src !== GM_LOGO_LOCAL_512) {
                      e.currentTarget.src = GM_LOGO_LOCAL_512;
                    }
                  }}
                />
              </div>

              {/* Message Details */}
              <div className="space-y-1">
                <h4 className="font-sans font-black tracking-wider text-sm text-blue-400 uppercase">
                  {currentLang === 'id' ? 'PASANG GM AGENCY' : 'INSTALL GM AGENCY'}
                </h4>
                <p className="font-sans text-xs font-semibold text-white">
                  {currentLang === 'id' ? 'Tambahkan ke Desktop / Home Screen' : 'Add to Desktop / Home Screen'}
                </p>
                <p className="font-sans text-[11px] leading-relaxed text-slate-400">
                  {currentLang === 'id'
                    ? 'Akses portal admin & kelola pesanan langsung lewat pintasan desktop dengan cepat, lancar tanpa bolak-balik.'
                    : 'Access admin portals & manage orders directly through your desktop or mobile shortcut with absolute ease.'
                  }
                </p>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-800/80 pt-3.5">
              <button
                onClick={handleDismissInstall}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {currentLang === 'id' ? 'Nanti Saja' : 'Later'}
              </button>
              <button
                onClick={handleInstallApp}
                className="px-4.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>{currentLang === 'id' ? 'PASANG SEKARANG' : 'INSTALL NOW'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Global custom toast container */}
      <ToastContainer />
    </div>
  );
}
