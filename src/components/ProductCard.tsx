/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, Language } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { MessageSquare, ShoppingCart, Tag } from 'lucide-react';

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

export default function ProductCard({ product, currentLang, onCheckoutClick }: ProductCardProps) {
  const t = TRANSLATIONS[currentLang];
  const name = currentLang === 'id' ? product.name : product.name_en;
  const description = currentLang === 'id' ? product.description : product.description_en;

  // Generate WhatsApp message for direct chat
  const getWhatsAppLink = () => {
    const defaultNumber = '6285921095666'; // GM Agency primary contact
    // Strip non-numbers if there are any
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

  return (
    <div 
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-sm duration-300"
      id={`product-card-${product.id}`}
    >
      {/* Product Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 border-b border-slate-100">
         <img
          src={imageUrlWithCacheBuster}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-slate-900/80 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur">
          <Tag className="h-2.5 w-2.5 text-blue-400" />
          <span className="uppercase tracking-wider">Per Pcs</span>
        </div>
      </div>

      {/* Product Information */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold text-slate-800 text-xs mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
          {name}
        </h3>
        <p className="text-[10px] text-slate-500 mb-3 line-clamp-2 leading-relaxed flex-1">
          {description}
        </p>

        {/* Pricing tag */}
        <div className="text-blue-600 font-bold text-sm mb-3">
          {formatRupiah(product.price)} <span className="text-[10px] font-normal text-slate-400">/ {getUnitSuffix()}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 mt-auto pt-2 border-t border-slate-100">
          {/* Direct WhatsApp chat */}
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-[10px] font-bold text-center flex items-center justify-center gap-1 transition-colors cursor-pointer"
            id={`product-wa-btn-${product.id}`}
          >
            <MessageSquare className="h-3 w-3 shrink-0 fill-white" />
            <span>WhatsApp</span>
          </a>

          {/* Checkout modal */}
          <button
            onClick={() => onCheckoutClick(product)}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold text-center flex items-center justify-center gap-1 transition-all cursor-pointer"
            id={`product-checkout-btn-${product.id}`}
          >
            <ShoppingCart className="h-3 w-3 shrink-0" />
            <span>{t.checkoutNow}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
