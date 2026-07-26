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
  theme?: 'light' | 'dark';
}

// 5 Slides based on the products sent by the user
const SLIDES = [
  {
    id: 'hapus-maps',
    title: {
      id: 'Jasa Hapus Ulasan Negatif Google Maps',
      en: 'Negative Google Maps Review Removal'
    },
    subtitle: {
      id: 'Layanan professional untuk menjaga reputasi bisnis Anda tetap bersih & tepercaya',
      en: 'Professional service to keep your business reputation pristine and highly trusted'
    },
    features: {
      id: ['Real Human / Manual', 'Pengerjaan Cepat', 'Garansi Kepuasan'],
      en: ['100% Real Human / Manual', 'Fast Turnaround Time', 'Full Satisfaction Warranty']
    },
    colorTheme: 'from-blue-600 to-indigo-600',
    glowColor: 'rgba(59,130,246,0.3)',
    type: 'maps-delete'
  },
  {
    id: 'buzzer-wa',
    title: {
      id: 'Jasa Buzzer WhatsApp Call & Chat',
      en: 'WhatsApp Call & Chat Buzzer Service'
    },
    subtitle: {
      id: 'Dukungan interaktif buzzer manual untuk mempercepat aktivitas operasional Anda',
      en: 'Interactive manual buzzer support to accelerate your outreach and operations'
    },
    features: {
      id: ['Bisa Request Chat', 'Pengerjaan Manual', 'Cocok Tagih Utang'],
      en: ['Customizable Content', '100% Manual Execution', 'Optimized for Debt Reminders']
    },
    colorTheme: 'from-[#25D366] to-[#128C7E]',
    glowColor: 'rgba(37,211,102,0.3)',
    type: 'whatsapp-buzzer'
  },
  {
    id: 'report-sosmed',
    title: {
      id: 'Jasa Report Akun All Sosmed',
      en: 'All Social Media Account Takedown'
    },
    subtitle: {
      id: 'Melaporkan & menghapus akun palsu, tiruan, atau penipuan demi keamanan Anda',
      en: 'Report and take down fake, clone, or fraudulent accounts for your security'
    },
    features: {
      id: ['Dikerjakan Manual 100%', 'Tanpa Akses Akun', 'Proses Cepat & Aman'],
      en: ['100% Manual Campaign', 'No Account Password Needed', 'Fast & Secure Privacy']
    },
    colorTheme: 'from-slate-800 to-slate-950',
    glowColor: 'rgba(30,41,59,0.3)',
    type: 'social-report'
  },
  {
    id: 'review-playstore',
    title: {
      id: 'Jasa Review Aplikasi Playstore',
      en: 'Google Play Store Reviews'
    },
    subtitle: {
      id: 'Tingkatkan unduhan dan bangun profil bintang 5 yang meyakinkan secara organik',
      en: 'Boost organic app installs and establish convincing five-star rating profiles'
    },
    features: {
      id: ['Real Human No Bot', 'Review Organik', 'Proses Cepat'],
      en: ['Real Human, No Bots', 'Genuine Organic Reviews', 'Fast Delivery Process']
    },
    colorTheme: 'from-emerald-500 to-teal-600',
    glowColor: 'rgba(16,185,129,0.3)',
    type: 'playstore-review'
  },
  {
    id: 'review-maps',
    title: {
      id: 'Jasa Review Google Maps',
      en: 'Google Maps 5-Star Reviews'
    },
    subtitle: {
      id: 'Optimalkan kehadiran pencarian lokal & ulasan bintang 5 dari pelanggan nyata',
      en: 'Optimize local search visibility & get glowing five-star reviews from real users'
    },
    features: {
      id: ['Manual No Bot', 'Ulasan Organik', 'Bisa Request Kalimat'],
      en: ['Manual Work, No Bots', '100% Organic Reviews', 'Custom Review Phrasing']
    },
    colorTheme: 'from-blue-500 to-sky-600',
    glowColor: 'rgba(59,130,246,0.3)',
    type: 'maps-review'
  }
];

export default function Hero({ currentLang, onExploreClick, theme = 'dark' }: HeroProps) {
  const t = TRANSLATIONS[currentLang];
  const [activeSlide, setActiveSlide] = React.useState(0);

  // Auto rotate slides every 5 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[activeSlide];
  const slideTitle = currentLang === 'id' ? slide.title.id : slide.title.en;
  const slideSubtitle = currentLang === 'id' ? slide.subtitle.id : slide.subtitle.en;
  const slideFeatures = currentLang === 'id' ? slide.features.id : slide.features.en;
  
  const isDark = theme === 'dark';

  return (
    <section className={`relative overflow-hidden border-b transition-colors duration-300 py-16 sm:py-24 ${
      isDark ? 'bg-slate-900 text-white border-slate-850' : 'bg-slate-50 text-slate-900 border-slate-200'
    }`} id="home-hero">
      {/* Decorative background grid and neon points */}
      <div className={`absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--grid-color)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-color)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]`}
        style={{ '--grid-color': isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)' } as React.CSSProperties}
      />
      <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/5'}`} />
      <div className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/5'}`} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          
          {/* Main content column */}
          <div className="flex flex-col items-start lg:col-span-6 z-10">
            {/* Promo / Trust Badge */}
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm backdrop-blur ${
              isDark 
                ? 'bg-slate-800/80 border border-slate-700/60 text-blue-400' 
                : 'bg-blue-50 border border-blue-100 text-blue-600'
            }`}>
              <Sparkles className={`h-3.5 w-3.5 animate-pulse ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span>{currentLang === 'id' ? 'Layanan Reputasi Bisnis #1' : '#1 Business Reputation Service'}</span>
            </div>

            {/* Static primary title + description with dynamic highlights */}
            <h1 className={`mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-5xl leading-[1.1] font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentLang === 'id' 
                ? 'Kuasai Reputasi Bisnis & Sosmed Secara Real-Time' 
                : 'Command Your Business & Social Reputation in Real-Time'}
            </h1>

            <p className={`mt-4 text-sm sm:text-base max-w-xl font-sans font-normal leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {currentLang === 'id'
                ? 'Kami membantu ribuan bisnis, instansi, dan UMKM mempertahankan reputasi positif melalui interaksi organik dari jaringan pengguna asli.'
                : 'We empower thousands of businesses and brands to protect and optimize their local SEO and social media presence through manual campaign networks.'}
            </p>

            {/* LIVE PERMANENT METRICS INSTRUCTION (125k+ orders & 1000+ customers served) */}
            <div className={`mt-8 grid grid-cols-2 gap-4 w-full max-w-md border rounded-2xl p-4 shadow-md transition-colors ${
              isDark 
                ? 'bg-slate-850/90 border-slate-800' 
                : 'bg-white border-slate-200'
            }`}>
              <div className={`flex flex-col border-r pr-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Delivery</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-500 font-display tracking-tight mt-1.5">125K+</div>
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Orders Completed</span>
              </div>

              <div className="flex flex-col pl-2">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Trusted Clients</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-blue-600 font-display tracking-tight mt-1.5">1000+</div>
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active Partners</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap gap-4 w-full sm:w-auto">
              <button
                onClick={onExploreClick}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 active:scale-95 sm:w-auto cursor-pointer"
                id="hero-explore-btn"
              >
                {t.heroBtn}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Interactive Dynamic Slideshow Graphic Column */}
          <div className="relative flex flex-col justify-center lg:col-span-6 w-full lg:pl-4">
            
            {/* Carousel Active Content Slide with elegant animation */}
            <div 
              className={`relative w-full overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-2xl transition-all duration-500`}
              style={{ 
                boxShadow: `0 25px 50px -12px ${isDark ? slide.glowColor : 'rgba(59,130,246,0.1)'}`,
                borderColor: isDark ? 'rgb(30,41,59)' : 'rgb(226,232,240)',
                backgroundColor: isDark ? 'rgb(2,6,23)' : 'rgb(255,255,255)'
              }}
            >
              {/* Active Slide decorative background glow */}
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />

              {/* Dynamic Slideshow Indicators */}
              <div className="flex items-center gap-2 mb-6">
                {SLIDES.map((s, index) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSlide(index)}
                    className="flex-1 h-1.5 rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{ backgroundColor: activeSlide === index ? 'rgba(156,163,175,0.4)' : 'rgba(156,163,175,0.1)' }}
                  >
                    {activeSlide === index && (
                      <motion.div 
                        initial={{ left: '-100%' }}
                        animate={{ left: '0%' }}
                        transition={{ duration: 5, ease: 'linear' }}
                        className="absolute inset-0 bg-blue-500"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Slide Content Header */}
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1 rounded bg-slate-850 text-slate-400 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-emerald-500">
                  {currentLang === 'id' ? 'Katalog Utama' : 'Master Service'}
                </span>
                
                <h3 className={`text-xl sm:text-2xl font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {slideTitle}
                </h3>
                
                <p className={`text-xs sm:text-sm leading-relaxed max-w-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {slideSubtitle}
                </p>
              </div>

              {/* Visualized Frame Mockup showcasing actual operation */}
              <div className={`mt-6 rounded-2xl border p-4 sm:p-5 relative min-h-[190px] flex flex-col justify-between overflow-hidden ${
                isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />

                {/* Simulated dynamic interface contents based on service type */}
                {slide.type === 'maps-delete' && (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2 text-[10px] font-mono ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>maps.google.com/cid=9842</span>
                      <span className="text-rose-500 font-bold">REMOVAL ACTIVE</span>
                    </div>
                    <div className={`flex items-center gap-3 border rounded-xl p-2.5 ${
                      isDark ? 'bg-rose-500/5 border-rose-500/10' : 'bg-rose-50/50 border-rose-100'
                    }`}>
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-rose-500 text-xs font-bold font-mono ${
                        isDark ? 'bg-slate-800' : 'bg-white border border-rose-200'
                      }`}>1★</div>
                      <div className="flex-1">
                        <div className={`h-2 w-20 rounded mb-1.5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                        <div className={`h-1.5 w-full rounded ${isDark ? 'bg-slate-800' : 'bg-slate-150'}`} />
                      </div>
                      <span className="text-[9px] bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">Deleting</span>
                    </div>
                    <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Clean up 1-star spam reviews perfectly & legally</span>
                    </div>
                  </div>
                )}

                {slide.type === 'whatsapp-buzzer' && (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2 text-[10px] font-mono ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>WhatsApp Campaign</span>
                      <span className="text-[#25D366] font-bold">ONLINE</span>
                    </div>
                    <div className={`border rounded-xl p-2.5 flex items-center gap-3 ${
                      isDark ? 'bg-[#25D366]/5 border-[#25D366]/15' : 'bg-emerald-50/40 border-emerald-100'
                    }`}>
                      <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.729-1.448L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.387 1.966 13.92 1.922 12.007 1.92c-5.439 0-9.865 4.37-9.869 9.8-.001 1.716.463 3.39 1.342 4.88l-.991 3.616 3.731-.963zm10.868-6.082c-.29-.146-1.72-.85-1.985-.947-.266-.097-.46-.146-.653.146-.193.291-.748.946-.917 1.14-.17.194-.339.219-.63.073-.29-.146-1.229-.453-2.34-1.445-.864-.772-1.448-1.725-1.618-2.016-.17-.29-.018-.447.127-.592.13-.13.29-.34.436-.51.145-.17.194-.291.291-.486.097-.194.048-.364-.025-.51-.072-.146-.653-1.577-.894-2.16-.236-.569-.475-.49-.653-.49-.17 0-.364-.025-.558-.025-.194 0-.51.073-.775.364-.266.29-1.018.996-1.018 2.43 0 1.434 1.043 2.818 1.189 3.012.145.195 2.052 3.134 4.973 4.394.694.3 1.236.48 1.658.614.698.221 1.334.19 1.837.115.56-.083 1.72-.704 1.963-1.385.242-.682.242-1.264.17-1.385-.072-.122-.266-.195-.558-.34z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Buzzer Operator</span>
                          <span className={`text-[8px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Incoming Call...</span>
                        </div>
                        <div className={`h-1.5 w-28 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                      </div>
                    </div>
                    <div className="text-[11px] text-[#25D366] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Automated call & chats via organic user network</span>
                    </div>
                  </div>
                )}

                {slide.type === 'social-report' && (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2 text-[10px] font-mono ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>Takedown Operations</span>
                      <span className="text-yellow-600 font-bold">TAKEDOWN PENDING</span>
                    </div>
                    <div className={`border rounded-xl p-2.5 flex items-center gap-3 ${
                      isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-amber-50/50 border-amber-100'
                    }`}>
                      <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-yellow-500">⚠</div>
                      <div className="flex-1">
                        <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-slate-850'}`}>Target Account Flagged</span>
                        <div className={`h-1.5 w-32 rounded mt-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      </div>
                    </div>
                    <div className="text-[11px] text-red-500 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-red-500" />
                      <span>Take down harmful accounts securely and safely</span>
                    </div>
                  </div>
                )}

                {slide.type === 'playstore-review' && (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2 text-[10px] font-mono ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>Google Play Console</span>
                      <span className="text-emerald-500 font-bold">5.0 ★ EXCELLENT</span>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Boost search rankings via authentic app downloads</span>
                    </div>
                  </div>
                )}

                {slide.type === 'maps-review' && (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2 text-[10px] font-mono ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>Local Business Growth</span>
                      <span className="text-blue-500 font-bold">ACTIVE SEO BOOST</span>
                    </div>
                    <div className={`flex gap-1.5 border rounded-xl p-2.5 ${
                      isDark ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50/50 border-blue-100'
                    }`}>
                      <div className="flex gap-0.5 items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>"Lokasi strategis, pelayanan luar biasa!"</span>
                    </div>
                    <div className="text-[11px] text-blue-500 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                      <span>Accelerate organic growth via 5-star Google Map reviews</span>
                    </div>
                  </div>
                )}

                {/* Bullets lists */}
                <div className={`mt-4 pt-3 border-t grid grid-cols-3 gap-2 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
                  {slideFeatures.map((feat, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className={`text-[9px] font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instant WhatsApp Action button directly linking with current slide title */}
              <div className="mt-6 flex gap-3">
                <a
                  href={`https://wa.me/6285921095666?text=Halo%20GM%20Agency%2C%20saya%20tertarik%20dengan%20${encodeURIComponent(slide.title.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:brightness-105 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 transition-transform active:scale-95 text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.729-1.448L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.387 1.966 13.92 1.922 12.007 1.92c-5.439 0-9.865 4.37-9.869 9.8-.001 1.716.463 3.39 1.342 4.88l-.991 3.616 3.731-.963zm10.868-6.082c-.29-.146-1.72-.85-1.985-.947-.266-.097-.46-.146-.653.146-.193.291-.748.946-.917 1.14-.17.194-.339.219-.63.073-.29-.146-1.229-.453-2.34-1.445-.864-.772-1.448-1.725-1.618-2.016-.17-.29-.018-.447.127-.592.13-.13.29-.34.436-.51.145-.17.194-.291.291-.486.097-.194.048-.364-.025-.51-.072-.146-.653-1.577-.894-2.16-.236-.569-.475-.49-.653-.49-.17 0-.364-.025-.558-.025-.194 0-.51.073-.775.364-.266.29-1.018.996-1.018 2.43 0 1.434 1.043 2.818 1.189 3.012.145.195 2.052 3.134 4.973 4.394.694.3 1.236.48 1.658.614.698.221 1.334.19 1.837.115.56-.083 1.72-.704 1.963-1.385.242-.682.242-1.264.17-1.385-.072-.122-.266-.195-.558-.34z" />
                  </svg>
                  <span>{currentLang === 'id' ? 'Hubungi Sekarang' : 'Consult Now'}</span>
                </a>
              </div>
            </div>

            {/* Manual Slide Selector Quick Tabs */}
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {SLIDES.map((s, index) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSlide(index)}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    activeSlide === index 
                      ? 'bg-blue-600 w-6' 
                      : (isDark 
                          ? 'bg-slate-700 hover:bg-slate-500' 
                          : 'bg-slate-300 hover:bg-slate-400')
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
