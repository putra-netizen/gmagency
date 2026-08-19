/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface GMLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export default function GMLogo({ className = '', size = 'md', showSubtitle = true }: GMLogoProps) {
  const dimensions = {
    xs: { width: 'w-7 h-7', titleSize: 'text-xs', subSize: 'text-[7px]' },
    sm: { width: 'w-8 h-8 sm:w-9 sm:h-9', titleSize: 'text-sm sm:text-base', subSize: 'text-[8px] sm:text-[9px]' },
    md: { width: 'w-12 h-12', titleSize: 'text-2xl', subSize: 'text-[11px]' },
    lg: { width: 'w-16 h-16', titleSize: 'text-3xl', subSize: 'text-[13px]' }
  };

  const current = dimensions[size];

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

        {/* Inner solid mask + image */}
        <div className="absolute inset-[1.5px] rounded-full bg-white dark:bg-slate-900 overflow-hidden z-10 flex items-center justify-center">
          <img
            src="https://reonysrsoaepzykwwfzw.supabase.co/storage/v1/object/public/LOGO-GM/Firefly_Flux_coba%20buatkan%20versi%20GM%20AGENCY%20404784.jpg%20(1).png"
            alt="GM Agency"
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Typography with brand custom classes */}
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
    </div>
  );
}
