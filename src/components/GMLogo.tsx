/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GM_LOGO_DATA_URI, GM_LOGO_LOCAL_512, GM_LOGO_ORIGINAL, GM_LOGO_SUPABASE } from '../utils/gmLogoAsset';

export const GM_LOGO_URL = GM_LOGO_DATA_URI;
export const GM_LOGO_FALLBACK = GM_LOGO_LOCAL_512;

const SUBTITLE_ROTATION = [
  'Reputation & Engagement',
  'Public perception building',
  'Brand advocacy',
  'Reputation management'
];

interface GMLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  hideText?: boolean;
  theme?: 'light' | 'dark';
}

export default function GMLogo({
  className = '',
  size = 'md',
  showSubtitle = true,
  hideText = false,
  theme = 'dark'
}: GMLogoProps) {
  const [imgSrc, setImgSrc] = useState<string>(GM_LOGO_DATA_URI);
  const [subtitleIndex, setSubtitleIndex] = useState<number>(0);

  useEffect(() => {
    if (!showSubtitle || hideText) return;
    const interval = setInterval(() => {
      setSubtitleIndex((prev) => (prev + 1) % SUBTITLE_ROTATION.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [showSubtitle, hideText]);

  const dimensions = {
    xs: { width: 'w-7 h-7', titleSize: 'text-xs', subSize: 'text-[8px]', subHeight: 'h-3' },
    sm: { width: 'w-9 h-9 sm:w-10 sm:h-10', titleSize: 'text-base sm:text-lg', subSize: 'text-[10px] sm:text-[11px]', subHeight: 'h-4' },
    md: { width: 'w-12 h-12', titleSize: 'text-2xl', subSize: 'text-xs', subHeight: 'h-4.5' },
    lg: { width: 'w-16 h-16', titleSize: 'text-3xl', subSize: 'text-sm', subHeight: 'h-5' }
  };

  const current = dimensions[size];
  const isDark = theme === 'dark';

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
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
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

      {/* Typography with adaptive Light/Dark mode & Framer Motion 2s rotating subtitle */}
      {!hideText && (
        <div className="flex flex-col justify-center select-none min-w-[175px] sm:min-w-[205px]">
          <span
            className={`${current.titleSize} font-black tracking-tight leading-none transition-colors duration-300 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            GM{' '}
            <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>
              AGENCY
            </span>
          </span>

          {showSubtitle && (
            <div className={`relative overflow-hidden ${current.subHeight} flex items-center mt-1`}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={SUBTITLE_ROTATION[subtitleIndex]}
                  initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={`${current.subSize} font-extrabold tracking-wider font-sans leading-none uppercase whitespace-nowrap ${
                    isDark
                      ? 'text-white'
                      : 'text-slate-700'
                  }`}
                >
                  {SUBTITLE_ROTATION[subtitleIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
