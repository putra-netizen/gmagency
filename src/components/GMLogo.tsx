/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface GMLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export default function GMLogo({ className = '', size = 'md', showSubtitle = true }: GMLogoProps) {
  const dimensions = {
    sm: { width: 40, height: 40, titleSize: 'text-lg', subSize: 'text-[9px]' },
    md: { width: 56, height: 56, titleSize: 'text-2xl', subSize: 'text-[11px]' },
    lg: { width: 80, height: 80, titleSize: 'text-3xl', subSize: 'text-[14px]' }
  };

  const current = dimensions[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* High Fidelity SVG Logo */}
      <svg
        width={current.width}
        height={current.height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm"
      >
        <defs>
          {/* Silver/Metallic gradient matching the logo's 'M' right stem */}
          <linearGradient id="silverGradient" x1="50" y1="20" x2="100" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D8DBE2" />
            <stop offset="30%" stopColor="#A9AEBC" />
            <stop offset="70%" stopColor="#6C7285" />
            <stop offset="100%" stopColor="#4A4E5C" />
          </linearGradient>

          {/* Deep Navy/Blue gradient matching the logo's 'G' stem */}
          <linearGradient id="navyGradient" x1="0" y1="80" x2="70" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B132B" />
            <stop offset="50%" stopColor="#1C2541" />
            <stop offset="100%" stopColor="#3A506B" />
          </linearGradient>
        </defs>

        {/* 'G' Character Body (Navy Gradient) */}
        <path
          d="M 46 22 
             C 28 22, 12 34, 12 52 
             C 12 70, 26 82, 46 82 
             C 60 82, 64 72, 64 64 
             L 64 54 
             L 44 54 
             L 44 64 
             L 54 64 
             C 54 70, 52 72, 46 72 
             C 32 72, 22 66, 22 52 
             C 22 38, 34 32, 46 32 
             C 49 32, 51 32.5, 53 33.5
             L 57.5 24.5
             C 54 23, 50 22, 46 22 Z"
          fill="url(#navyGradient)"
        />

        {/* Upward Chevron Arrow (Silver & Metallic, overlapping the middle) */}
        <path
          d="M 49 14 
             L 41 28 
             L 47 26 
             L 47 52 
             L 51 52 
             L 51 26 
             L 57 28 
             Z"
          fill="url(#silverGradient)"
        />

        {/* 'M' Character Right Columns (Silver Gradient) */}
        <path
          d="M 54 42
             L 64 42
             L 64 78
             L 54 78
             Z"
          fill="url(#silverGradient)"
        />
        <path
          d="M 64 42
             L 74 58
             L 84 42
             L 94 42
             L 94 78
             L 84 78
             L 84 54
             L 76 68
             L 72 68
             L 64 54
             Z"
          fill="url(#silverGradient)"
        />
      </svg>

      {/* Typography with brand custom classes */}
      <div className="flex flex-col select-none">
        <span className={`${current.titleSize} font-extrabold tracking-tight text-slate-800 leading-none`}>
          GM <span className="text-blue-600">AGENCY</span>
        </span>
        {showSubtitle && (
          <span className="text-[9px] font-medium tracking-wider text-slate-400 font-sans leading-none mt-1 uppercase">
            Reputation & Engagement
          </span>
        )}
      </div>
    </div>
  );
}
