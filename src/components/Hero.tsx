/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TRANSLATIONS } from '../lib/translations';
import { Language } from '../types';
import { ArrowRight, CheckCircle2, Star, TrendingUp, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface HeroProps {
  currentLang: Language;
  onExploreClick: () => void;
}

export default function Hero({ currentLang, onExploreClick }: HeroProps) {
  const t = TRANSLATIONS[currentLang];

  const features = currentLang === 'id' 
    ? [
        'Manajemen reputasi 100% legal sesuai panduan resmi',
        'Sistem order per-pcs, presisi & transparan',
        'Pembayaran aman via QRIS otomatis dengan invoice instan',
        'Dukungan penuh tim ahli digital GM Agency'
      ]
    : [
        '100% compliant reputation services matching platform guidelines',
        'Precise and transparent per-piece pricing system',
        'Secure QRIS payment gateway with immediate invoices',
        'Supported by GM Agency digital experts'
      ];

  return (
    <section className="relative overflow-hidden bg-slate-50 border-b border-slate-200 py-16 sm:py-20" id="home-hero">
      {/* Decorative background grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0284c708_1px,transparent_1px),linear-gradient(to_bottom,#0284c708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          
          {/* Main content column */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Promo Tag */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3.5 py-1.5 text-xs font-semibold text-blue-800 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
              <span>{currentLang === 'id' ? 'Layanan Reputasi Bisnis #1' : '#1 Business Reputation Service'}</span>
            </div>

            {/* Title */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-5xl leading-[1.1] font-sans">
              {t.heroTitle}
            </h1>

            {/* Description */}
            <p className="mt-6 text-lg text-slate-600 sm:text-xl max-w-2xl font-sans font-normal leading-relaxed">
              {t.heroSub}
            </p>

            {/* Features checkmark list */}
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 w-full">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-slate-800 font-sans">{feat}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-10 flex flex-wrap gap-4 w-full sm:w-auto">
              <button
                onClick={onExploreClick}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-500/10 transition-all duration-200 hover:bg-blue-700 active:scale-95 sm:w-auto cursor-pointer"
                id="hero-explore-btn"
              >
                {t.heroBtn}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Interactive Hero Graphic Column */}
          <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              {/* Card visual elements */}
              <div className="absolute top-0 right-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-blue-400/5 blur-2xl" />
              <div className="absolute bottom-0 left-0 -ml-6 -mb-6 h-36 w-36 rounded-full bg-indigo-400/5 blur-2xl" />

              <div className="relative space-y-5">
                {/* Visual Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-lg shadow-sm">
                      GM
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">GM Agency</h4>
                      <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Reputation System Online
                      </p>
                    </div>
                  </div>
                  <div className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500 border border-slate-200">
                    IDR (Rp)
                  </div>
                </div>

                {/* Growth Metric box */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        {currentLang === 'id' ? 'Skor Kepercayaan Bisnis' : 'Trust Score Growth'}
                      </span>
                      <h3 className="text-2xl font-extrabold text-slate-900 font-sans">98.4%</h3>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <span>+14.2%</span>
                    <span className="text-slate-500 font-normal">
                      {currentLang === 'id' ? 'rata-rata pertumbuhan klien' : 'avg client organic growth'}
                    </span>
                  </div>
                </div>

                {/* Small review card simulation */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 border border-slate-300">
                        AN
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-900 text-xs truncate">Alek Nasution</h5>
                          <span className="text-[9px] text-slate-400">1m ago</span>
                        </div>
                        <div className="flex gap-0.5 mt-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-600 italic leading-relaxed">
                      "Lokasi toko saya sekarang mudah dicari, ulasan bintang 5 berdatangan dari pembeli asli. Sangat membantu!"
                    </p>
                  </div>
                </div>

                {/* Trust labels */}
                <div className="flex items-center justify-between pt-2 text-[11px] font-bold text-slate-400 border-t border-slate-200">
                  <span>SSL SECURE</span>
                  <span>100% MANUAL PROCESS</span>
                  <span>QRIS INTEGRATION</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
