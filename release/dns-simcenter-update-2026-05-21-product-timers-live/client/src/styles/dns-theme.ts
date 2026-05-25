// ============================================================
// DNS Corporate Design System
// dns-theme.ts — единый источник дизайн-токенов для всех компонентов
// ============================================================

// ─── Цветовая палитра ──────────────────────────────────────
export const DNS_COLORS = {
  // Основные
  primary: '#F04E23',         // DNS Orange
  primaryLight: '#FF6B35',    // Light Orange
  primaryDark: '#D84315',     // Dark Orange

  // Фон
  bgDark: '#0F1923',          // Dark Navy — основной фон
  bgCard: '#1A2634',          // Card background
  bgElevated: '#243447',      // Elevated surface
  bgOverlay: 'rgba(15, 25, 35, 0.92)',

  // Текст
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Статусы
  success: '#00C853',
  warning: '#FFB300',
  error: '#FF1744',
  info: '#2979FF',

  // Акценты
  accentTeal: '#00D4AA',
  accentBlue: '#4A9EFF',
  accentPurple: '#A78BFA',
} as const;

// ─── Типографика ────────────────────────────────────────────
export const DNS_TYPOGRAPHY = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  sizes: {
    xs: '0.6875rem',    // 11px
    sm: '0.8125rem',    // 13px
    base: '0.9375rem',  // 15px
    lg: '1.125rem',     // 18px
    xl: '1.375rem',     // 22px
    '2xl': '1.75rem',   // 28px
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ─── Анимации и переходы ───────────────────────────────────
export const DNS_ANIMATIONS = {
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  keyframes: {
    fadeIn: 'fadeIn 300ms ease-out',
    slideUp: 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1)',
    scaleIn: 'scaleIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    shimmer: 'shimmer 2s linear infinite',
  },
} as const;

// ─── Breakpoints ────────────────────────────────────────────
export const DNS_BREAKPOINTS = {
  xs: '375px',    // iPhone SE
  sm: '640px',    // Small tablets
  md: '768px',    // Tablets
  lg: '1024px',   // Desktop
  xl: '1280px',   // Large desktop
  '2xl': '1536px', // 4K
} as const;

// ─── Media-query утилиты ────────────────────────────────────
export const DNS_RESPONSIVE = {
  mobileOnly: '@media (max-width: 767px)',
  tabletUp: '@media (min-width: 768px)',
  desktopUp: '@media (min-width: 1024px)',
  wideUp: '@media (min-width: 1280px)',
} as const;

// ─── Тени ───────────────────────────────────────────────────
export const DNS_SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(240, 78, 35, 0.2)',
  glowStrong: '0 0 30px rgba(240, 78, 35, 0.35)',
  inset: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
} as const;

// ─── Границы и скругления ──────────────────────────────────
export const DNS_BORDERS = {
  radius: {
    none: '0',
    sm: '0.375rem',   // 6px
    md: '0.625rem',   // 10px
    lg: '1rem',       // 16px
    xl: '1.25rem',    // 20px
    full: '9999px',
  },
  width: {
    thin: '1px',
    normal: '1.5px',
    thick: '2px',
  },
} as const;

// ─── Градиенты ─────────────────────────────────────────────
export const DNS_GRADIENTS = {
  primary: 'linear-gradient(135deg, #F04E23 0%, #FF6B35 100%)',
  dark: 'linear-gradient(180deg, #0F1923 0%, #1A2634 100%)',
  card: 'linear-gradient(145deg, #1A2634 0%, #243447 100%)',
  hero: 'linear-gradient(135deg, rgba(240,78,35,0.15) 0%, rgba(15,25,35,1) 60%)',
  accentGlow: 'radial-gradient(circle at 50% 50%, rgba(240,78,35,0.1) 0%, transparent 70%)',
} as const;

// ─── Отступы / Spacing ─────────────────────────────────────
export const DNS_SPACING = {
  '0': '0',
  '0.5': '0.125rem',   // 2px
  '1': '0.25rem',      // 4px
  '2': '0.5rem',       // 8px
  '3': '0.75rem',      // 12px
  '4': '1rem',         // 16px
  '5': '1.25rem',      // 20px
  '6': '1.5rem',       // 24px
  '8': '2rem',         // 32px
  '10': '2.5rem',      // 40px
  '12': '3rem',        // 48px
  '16': '4rem',        // 64px
  '20': '5rem',        // 80px
} as const;

// ─── Z-index шкала ──────────────────────────────────────────
export const DNS_Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// ─── Утилитарный тип для токенов ───────────────────────────
export type DNSColors = typeof DNS_COLORS;
export type DNSTypography = typeof DNS_TYPOGRAPHY;
export type DNSAnimations = typeof DNS_ANIMATIONS;
export type DNSBreakpoints = typeof DNS_BREAKPOINTS;
export type DNSShadows = typeof DNS_SHADOWS;
export type DNSBorders = typeof DNS_BORDERS;
export type DNSGradients = typeof DNS_GRADIENTS;
export type DNSSpacing = typeof DNS_SPACING;
export type DNSZIndex = typeof DNS_Z_INDEX;
