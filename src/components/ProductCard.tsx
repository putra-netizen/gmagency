/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, Language } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { ShoppingCart, Star, Flame, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface ProductCardProps {
  key?: string;
  product: Product;
  currentLang: Language;
  onCheckoutClick: (product: Product) => void;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Official WhatsApp Logo SVG
export function WhatsAppLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      className={className} 
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.729-1.448L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.387 1.966 13.92 1.922 12.007 1.92c-5.439 0-9.865 4.37-9.869 9.8-.001 1.716.463 3.39 1.342 4.88l-.991 3.616 3.731-.963zm10.868-6.082c-.29-.146-1.72-.85-1.985-.947-.266-.097-.46-.146-.653.146-.193.291-.748.946-.917 1.14-.17.194-.339.219-.63.073-.29-.146-1.229-.453-2.34-1.445-.864-.772-1.448-1.725-1.618-2.016-.17-.29-.018-.447.127-.592.13-.13.29-.34.436-.51.145-.17.194-.291.291-.486.097-.194.048-.364-.025-.51-.072-.146-.653-1.577-.894-2.16-.236-.569-.475-.49-.653-.49-.17 0-.364-.025-.558-.025-.194 0-.51.073-.775.364-.266.29-1.018.996-1.018 2.43 0 1.434 1.043 2.818 1.189 3.012.145.195 2.052 3.134 4.973 4.394.694.3 1.236.48 1.658.614.698.221 1.334.19 1.837.115.56-.083 1.72-.704 1.963-1.385.242-.682.242-1.264.17-1.385-.072-.122-.266-.195-.558-.34z" />
    </svg>
  );
}

export default function ProductCard({ product, currentLang, onCheckoutClick }: ProductCardProps) {
  const t = TRANSLATIONS[currentLang];
  const name = currentLang === 'id' ? product.name : product.name_en;
  const description = currentLang === 'id' ? product.description : product.description_en;

  // Generate WhatsApp message for direct chat
  const getWhatsAppLink = () => {
    const defaultNumber = '6285921095666'; // GM Agency primary contact
    const number = product.whatsapp_number ? product.whatsapp_number.replace(/[^0-9]/g, '') : defaultNumber;
    const cleanNumber = number.startsWith('0') ? '62' + number.slice(1) : number.startsWith('+') ? number.slice(1) : number;
    
    const message = currentLang === 'id'
      ? `Halo GM Agency, saya tertarik dengan layanan *${product.name}* (${formatRupiah(product.price)} / pcs) yang tertera di website. Bisa tolong berikan informasi lebih lanjut?`
      : `Hello GM Agency, I am interested in the *${product.name_en}* service (${formatRupiah(product.price)} / pcs) shown on your website. Could you please provide more details?`;
      
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  // Determine specific suffix for pricing
  const getUnitSuffix = () => {
    if (product.id.includes('gmaps-creation')) {
      return currentLang === 'id' ? 'titik' : 'location';
    }
    if (product.id.includes('report')) {
      return currentLang === 'id' ? 'report' : 'reports';
    }
    if (product.id.includes('vote')) {
      return currentLang === 'id' ? 'vote' : 'votes';
    }
    if (product.id.includes('comment')) {
      return currentLang === 'id' ? 'komentar' : 'comments';
    }
    return currentLang === 'id' ? 'ulasan' : 'reviews';
  };

  // Cache-busting URL to prevent browser caching of images, memoized to prevent constant reloading on component re-renders
  const imageUrlWithCacheBuster = React.useMemo(() => {
    if (!product.image_url) return '';
    return `${product.image_url}${product.image_url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  }, [product.image_url]);

  // Determine premium dynamic badge tags to attract attention
  const badgeDetails = React.useMemo(() => {
    const id = product.id.toLowerCase();
    if (id.includes('gmaps') || id.includes('maps')) {
      return {
        label: currentLang === 'id' ? 'Sangat Direkomendasikan' : 'Highly Recommended',
        color: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        dotColor: 'bg-amber-500',
        icon: <Star className="h-3 w-3 text-amber-400" />
      };
    }
    if (id.includes('vote') || id.includes('comment') || id.includes('instagram') || id.includes('shopee')) {
      return {
        label: currentLang === 'id' ? 'Terlaris' : 'Best Seller',
        color: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
        dotColor: 'bg-rose-500',
        icon: <Flame className="h-3 w-3 text-rose-400" />
      };
    }
    return {
      label: currentLang === 'id' ? 'Premium Jasa' : 'Premium Service',
      color: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      dotColor: 'bg-indigo-500',
      icon: <Sparkles className="h-3 w-3 text-indigo-400" />
    };
  }, [product.id, currentLang]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -8, 
        boxShadow: "0 20px 25px -5px rgba(59, 130, 246, 0.2), 0 10px 10px -5px rgba(59, 130, 246, 0.1)"
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md hover:border-blue-500/50 transition-colors duration-300 h-full"
      id={`product-card-${product.id}`}
    >
      {/* Decorative Top Hover Border Glow Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-20" />

      {/* Product Image Stage */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-slate-850">
        {/* Subtle radial sheen on card background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_60%)] z-10 pointer-events-none" />
        
        <img
          src={imageUrlWithCacheBuster}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Dynamic Attraction Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {/* Dynamic recommended/best seller badge */}
          <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${badgeDetails.color} backdrop-blur shadow-sm`}>
            {badgeDetails.icon}
            <span>{badgeDetails.label}</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badgeDetails.dotColor}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${badgeDetails.dotColor}`}></span>
            </span>
          </div>
        </div>

        {/* Hover overlay sheen/consultation badge */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 z-10 pointer-events-none">
          <span className="text-[10px] text-white font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Delivery Active
          </span>
        </div>
      </div>

      {/* Product Content / Information */}
      <div className="flex flex-1 flex-col p-4 bg-gradient-to-b from-slate-900/80 to-slate-950/80">
        <h3 className="font-bold text-slate-100 text-sm mb-1.5 line-clamp-1 group-hover:text-blue-400 transition-colors duration-300">
          {name}
        </h3>
        <p className="text-[11px] text-slate-400 mb-4 line-clamp-3 leading-relaxed flex-1">
          {description}
        </p>

        {/* Modern Pricing Container */}
        <div className="mb-4 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Starting Price</span>
            <div className="text-blue-400 font-black text-base leading-none mt-1">
              {formatRupiah(product.price)}
            </div>
          </div>
          <div className="text-[10px] font-bold bg-blue-950/40 text-blue-400 px-2 py-0.5 rounded border border-blue-900/30">
            Per {getUnitSuffix()}
          </div>
        </div>

        {/* Interactive Call-To-Action Button Row */}
        <div className="flex gap-2 mt-auto pt-3 border-t border-slate-800/60">
          {/* Direct WhatsApp with Official Branding and Pulsing Glow */}
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white rounded-lg text-[10px] font-extrabold text-center flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-105 active:scale-95 cursor-pointer border border-emerald-500/30"
            id={`product-wa-btn-${product.id}`}
          >
            <WhatsAppLogo className="h-3.5 w-3.5 shrink-0 fill-white drop-shadow-sm" />
            <span>Consult</span>
          </a>

          {/* Premium Instant Checkout Button */}
          <button
            onClick={() => onCheckoutClick(product)}
            className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-[10px] font-extrabold text-center flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25 hover:brightness-105 active:scale-95 cursor-pointer border border-blue-600/30"
            id={`product-checkout-btn-${product.id}`}
          >
            <ShoppingCart className="h-3.5 w-3.5 shrink-0 drop-shadow-sm" />
            <span>{t.checkoutNow}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

