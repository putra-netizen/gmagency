/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GM_LOGO_DATA_URI, GM_LOGO_LOCAL_512, GM_LOGO_ORIGINAL, GM_LOGO_SUPABASE } from '../utils/gmLogoAsset';

export const GM_LOGO_URL = GM_LOGO_DATA_URI;
export const GM_LOGO_FALLBACK = GM_LOGO_LOCAL_512;

interface GMLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  hideText?: boolean;
}

export default function GMLogo({ className = '', size = 'md', showSubtitle = true, hideText = false }: GMLogoProps) {
  const [imgSrc, setImgSrc] = useState<string>(GM_LOGO_DATA_URI);

  const dimensions = {
    xs: { width: 'w-7 h-7', titleSize: 'text-xs', subSize: 'text-[7px]' },
    sm: { width: 'w-8 h-8 sm:w-9 sm:h-9', titleSize: 'text-sm sm:text-base', subSize: 'text-[8px] sm:text-[9px]' },
    md: { width: 'w-12 h-12', titleSize: 'text-2xl', subSize: 'text-[11px]' },
    lg: { width: 'w-16 h-16', titleSize: 'text-3xl', subSize: 'text-[13px]' }
  };

  const current = dimensions[size];

  const handleImgError = () => {
    if (imgSrc === GM_LOGO_DATA_URI) {
      setImgSrc(GM_LOGO_LOCAL_512);
    } else if (imgSrc === GM_LOGO_LOCAL_512) {
      setImgSrc(GM_LOGO_ORIGINAL);
    } else if (imgSrc !== GM_LOGO_SUPABASE) {
      setImgSrc(GM_LOGO_SUPABASE);
    }
  };

  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 ${className}`}>
      {/* Container for Logo with Rotating Neon Aura */}
      <div className={`relative ${current.width} shrink-0 p-[1.5px] rounded-full flex items-center justify-center`}>
        
        {/* Glowing Background Ring - Rotating Conic Gradient using Framer Motion */}
        <motion.div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #2563eb, #a855f7, #2563eb)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 3.5,
            ease: "linear"
          }}
        />
        
        {/* Soft blur glow behind for realistic light aura */}
        <motion.div 
          className="absolute inset-0 rounded-full blur-[4px] opacity-75"
          style={{
            background: 'conic-gradient(from 0deg, #2563eb, #a855f7, #2563eb)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 3.5,
            ease: "linear"
          }}
        />

        {/* Inner solid mask + Real GM Logo Image */}
        <div className="absolute inset-[1.5px] rounded-full bg-white overflow-hidden z-10 flex items-center justify-center shadow-inner">
          <img 
            src={imgSrc} 
            alt="GM Agency Logo" 
            className="w-full h-full object-contain rounded-full select-none p-0.5"
            onError={handleImgError}
          />
        </div>
      </div>

      {/* Typography with brand custom classes */}
      {!hideText && (
        <div className="flex flex-col select-none">
          <span className={`${current.titleSize} font-extrabold tracking-tight text-slate-800 dark:text-white leading-none`}>
            GM <span className="text-blue-600 dark:text-blue-400">AGENCY</span>
          </span>
          {showSubtitle && (
            <span className={`${current.subSize} font-medium tracking-wider text-slate-400 dark:text-slate-500 font-sans leading-none mt-0.5 uppercase`}>
              Reputation & Engagement
            </span>
          )}
        </div>
      )}
    </div>
  );
}
