/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import { motion, HTMLMotionProps, Variants } from 'motion/react';

interface RevealProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
  viewportMargin?: string;
  once?: boolean;
}

/**
 * Standard upward fade scroll-triggered reveal.
 * Smooth cubic-bezier curve for that crisp, native feel.
 */
export function RevealFadeUp({
  children,
  delay = 0,
  duration = 0.6,
  y = 30,
  className = '',
  viewportMargin = '-40px',
  once = true,
  ...props
}: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: viewportMargin }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Reveal with gentle scale and opacity fade.
 */
export function RevealScale({
  children,
  delay = 0,
  duration = 0.6,
  scale = 0.94,
  className = '',
  viewportMargin = '-40px',
  once = true,
  ...props
}: RevealProps & { scale?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once, margin: viewportMargin }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Directional slide in reveal (left or right).
 */
export function RevealSlide({
  children,
  direction = 'left',
  delay = 0,
  duration = 0.65,
  distance = 40,
  className = '',
  viewportMargin = '-40px',
  once = true,
  ...props
}: RevealProps & { direction?: 'left' | 'right'; distance?: number }) {
  const x = direction === 'left' ? -distance : distance;

  return (
    <motion.div
      initial={{ opacity: 0, x }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once, margin: viewportMargin }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger Container & Child for cascading lists or grids
 */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (staggerDelay = 0.1) => ({
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.05
    }
  })
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export function RevealStaggerContainer({
  children,
  stagger = 0.1,
  className = '',
  viewportMargin = '-40px',
  once = true,
  ...props
}: {
  children: ReactNode;
  stagger?: number;
  className?: string;
  viewportMargin?: string;
  once?: boolean;
} & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={containerVariants}
      custom={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: viewportMargin }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealStaggerItem({
  children,
  className = '',
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={itemVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
