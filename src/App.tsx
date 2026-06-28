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
import WorkerPanel from './components/WorkerPanel';
import AdminShpPanel from './components/AdminShpPanel';
import ToastContainer from './components/ToastContainer';
import { Product, Language, Order } from './types';
import { dbGetProducts, isSupabaseConfigured, dbIsSupabaseConnected } from './lib/supabase';
import { TRANSLATIONS } from './lib/translations';
import { MessageSquare, Phone, MapPin, Mail, Clock, ShieldCheck, Heart } from 'lucide-react';
import { motion } from 'motion/react';

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

  const isAdminShpPath = (path: string) => {
    if (path === '/adminshp' || path.startsWith('/adminshp/')) return true;
    const match = path.match(/^\/([^/]+)(\/.*)?$/);
    if (!match) return false;
    const firstSegment = match[1].toLowerCase();
    
    // Default routes
    const defaultRoutes = ['adminshp', 'adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'];
    if (defaultRoutes.includes(firstSegment)) return true;
    
    // Custom routes from gm_adminshp_creds
    try {
      const saved = localStorage.getItem('gm_adminshp_creds');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          for (const key of Object.keys(parsed)) {
            const customUser = parsed[key]?.username?.trim()?.toLowerCase();
            if (customUser && customUser === firstSegment) {
              return true;
            }
          }
        }
      }
    } catch (e) {}
    
    return false;
  };

  const [currentView, setCurrentView] = useState<'home' | 'admin' | 'worker' | 'adminshp'>(() => {
    const path = window.location.pathname;
    if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
    if (path === '/worker' || path.startsWith('/worker/')) return 'worker';
    if (isAdminShpPath(path)) return 'adminshp';
    return 'home';
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const servicesSectionRef = useRef<HTMLDivElement>(null);

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
  const handleViewChange = (view: 'home' | 'admin' | 'worker' | 'adminshp') => {
    setCurrentView(view);
    if (view === 'admin') {
      window.history.pushState(null, '', '/admin');
    } else if (view === 'worker') {
      window.history.pushState(null, '', '/worker');
    } else if (view === 'adminshp') {
      window.history.pushState(null, '', '/adminshp');
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

      if (path === '/' || path === '') {
        window.history.replaceState(null, '', '/home');
        setCurrentView('home');
      } else if (path === '/admin' || path.startsWith('/admin/')) {
        setCurrentView('admin');
      } else if (path === '/worker' || path.startsWith('/worker/')) {
        setCurrentView('worker');
      } else if (isAdminShpPath(path)) {
        setCurrentView('adminshp');
      } else if (path === '/home') {
        setCurrentView('home');
      } else {
        setCurrentView('home');
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
        // Silent background refresh of products to provide automatic realtime updates
        dbGetProducts()
          .then((data) => {
            setProducts(data);
          })
          .catch((err) => console.error('Silent products refresh failed:', err));
      }, 15000);
      
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

            {/* Services Catalogue Section Grid */}
            <div 
              ref={servicesSectionRef} 
              className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 scroll-mt-12"
              id="services-catalogue"
            >
              {/* Grid Header */}
              <div className="text-center max-w-3xl mx-auto mb-10 space-y-2">
                <h2 className={`text-2xl font-black font-sans tracking-tight uppercase ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {t.productsTitle}
                </h2>
                <p className={`font-sans leading-relaxed text-xs sm:text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {t.productsSub}
                </p>
              </div>

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
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      currentLang={currentLang}
                      onCheckoutClick={(prod) => setSelectedProduct(prod)}
                      theme={theme}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : currentView === 'worker' ? (
          /* WORKER TASKS DASHBOARD SCREEN */
          <div className="fade-in">
            <WorkerPanel currentLang={currentLang} />
          </div>
        ) : currentView === 'adminshp' ? (
          /* MANUAL entries Shopee Portal SCREEN */
          <div className="fade-in">
            <AdminShpPanel currentLang={currentLang} />
          </div>
        ) : (
          /* ADMIN DATABASE DASHBOARD SCREEN */
          <div className="fade-in">
            <AdminPanel currentLang={currentLang} />
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
            <div className={`grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b ${
              theme === 'dark' ? 'border-slate-900' : 'border-slate-200'
            }`}>
              {/* About brand column (5 columns) */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-10 w-10 shrink-0 p-0.5 rounded-full border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center overflow-hidden">
                    <img
                      src="https://reonysrsoaepzykwwfzw.supabase.co/storage/v1/object/public/LOGO-GM/Firefly_Flux_coba%20buatkan%20versi%20GM%20AGENCY%20404784.jpg%20(1).png"
                      alt="GM Agency"
                      className="w-full h-full object-cover rounded-full"
                      referrerPolicy="no-referrer"
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
            </div>

            {/* Copyright signature */}
            <div className={`pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-light ${
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
            </div>
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

      {/* 6. Global custom toast container */}
      <ToastContainer />
    </div>
  );
}
