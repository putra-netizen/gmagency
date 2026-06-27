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

  const [currentView, setCurrentView] = useState<'home' | 'admin' | 'worker' | 'adminshp'>(() => {
    const path = window.location.pathname;
    if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
    if (path === '/worker' || path.startsWith('/worker/')) return 'worker';
    if (path === '/adminshp' || path.match(/^\/adminshp[1-4](\/.*)?$/)) return 'adminshp';
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
      } else if (path === '/adminshp' || path.match(/^\/adminshp[1-4](\/.*)?$/)) {
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
    loadProducts();
  }, []);

  const t = TRANSLATIONS[currentLang];

  const scrollToServices = () => {
    servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      {/* 1. Header Navbar */}
      <Navbar
        currentLang={currentLang}
        onLangChange={handleLangChange}
        currentView={currentView}
        onViewChange={handleViewChange}
        supabaseConnected={dbIsSupabaseConnected()}
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
            />

            {/* Services Catalogue Section Grid */}
            <div 
              ref={servicesSectionRef} 
              className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 scroll-mt-12"
              id="services-catalogue"
            >
              {/* Grid Header */}
              <div className="text-center max-w-3xl mx-auto mb-10 space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight uppercase">
                  {t.productsTitle}
                </h2>
                <p className="text-slate-500 font-sans leading-relaxed text-xs sm:text-sm">
                  {t.productsSub}
                </p>
              </div>

              {/* Grid Content Loader */}
              {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3">
                  <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-semibold text-slate-500">Loading digital services...</span>
                </div>
              ) : errorMsg ? (
                <div className="mx-auto max-w-md rounded-xl bg-red-50 border border-red-100 p-5 text-center text-sm font-semibold text-red-700">
                  {errorMsg}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      currentLang={currentLang}
                      onCheckoutClick={(prod) => setSelectedProduct(prod)}
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
        <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 font-sans mt-auto">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-900">
              {/* About brand column (5 columns) */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-extrabold text-base">
                    GM
                  </div>
                  <span className="text-lg font-black tracking-widest text-white">GM AGENCY</span>
                </div>
                <p className="text-sm leading-relaxed max-w-sm text-slate-400 font-light">
                  {currentLang === 'id'
                    ? 'Penyedia solusi manajemen reputasi, optimasi pencarian peta, dan engagement organik sosial media terlengkap, profesional, dan 100% legal.'
                    : 'Leading professional reputation managers, local SEO optimization, and compliant organic engagement digital services.'
                  }
                </p>
                <div className="flex items-center gap-2.5 text-xs text-blue-500 font-bold bg-blue-950/40 border border-blue-900/30 w-fit px-3.5 py-1.5 rounded-full">
                  <ShieldCheck className="h-4 w-4" />
                  <span>100% LEGAL & COMPLIANT SERVICES</span>
                </div>
              </div>

              {/* Quick links columns (4 columns) */}
              <div className="md:col-span-4 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">
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
                <h4 className="text-xs font-black text-white uppercase tracking-widest">
                  Contact & Location
                </h4>
                <ul className="space-y-3 text-sm font-light">
                  <li className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>Getak Mumbul, Bali, Indonesia</span>
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
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-light">
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

      {/* 5. Floating Global WhatsApp chat button */}
      {currentView === 'home' && (
        <a
          href="https://wa.me/6285921095666?text=Halo%20GM%20Agency%2C%20saya%20ingin%20berkonsultasi%20mengenai%20layanan%20reputasi%20digital%20bisnis."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/25 transition-transform hover:scale-110 hover:bg-emerald-600 active:scale-95"
          title="Hubungi GM Agency via WhatsApp"
          id="global-floating-whatsapp"
        >
          <MessageSquare className="h-6 w-6 fill-white" />
        </a>
      )}

      {/* 6. Global custom toast container */}
      <ToastContainer />
    </div>
  );
}
