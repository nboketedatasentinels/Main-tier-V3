/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors - Semantic Tokens (Growth.design approach)
        brand: {
          primary: '#350e6f', // Violet
          dark: '#27062e',    // Deep Purple
        },
        // Surface Colors - For backgrounds and cards
        surface: {
          default: '#FFFFFF',
          subtle: '#F8FAFC',
          muted: '#F1F5F9',
          elevated: '#FFFFFF',
        },
        // Text Colors - For readability
        text: {
          primary: '#0F172A',
          secondary: '#334155',
          muted: '#64748B',
          inverse: '#FFFFFF',
        },
        // Border Colors
        border: {
          subtle: '#E2E8F0',
          strong: '#CBD5E1',
        },
        // Accent Colors - For highlights and status
        accent: {
          warning: '#eab130',  // Gold
          highlight: '#f9db59', // Yellow (backgrounds only)
        },
        // Danger/Destructive Actions
        danger: {
          DEFAULT: '#f4540c', // Orange
        },
        // Tint Tokens - 80% blend toward white for safe backgrounds
        tint: {
          'brand-dark': '#d4cdd5',
          'brand-primary': '#d7cfe2',
          danger: '#fdddce',
          'accent-warning': '#fbefd6',
          'accent-highlight': '#fef8de',
        },
        // Legacy Primary Brand Color: Indigo/Purple (kept for compatibility)
        'brand-indigo': {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#350e6f', // Updated to Violet
          600: '#27062e', // Updated to Deep Purple
          700: '#1e0340',
          800: '#1e0340',
          900: '#1e0340',
        },
        // Accent/Secondary Color: Gold
        'accent-gold': {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#EAB130',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        // Neutral Gray Scale
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          // Named aliases
          darkest: '#0f172a',
          dark: '#1e293b',
          medium: '#64748b',
          muted: '#94a3b8',
          light: '#e2e8f0',
          border: '#e2e8f0',
        },
        // Semantic Status Colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#d97706',
          800: '#c2410c',
          900: '#9a3412',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Special Purpose Colors (legacy compatibility)
        charcoal: '#27062e',
        teal: {
          500: '#14b8a6',
          600: '#0d9488',
        },
        'deep-purple': '#350e6f',
        'bright-yellow': '#f9db59',
        whatsapp: {
          50: '#e7f9f2',
          100: '#b8eed9',
          200: '#89e3c0',
          300: '#5ad8a7',
          400: '#2bcd8e',
          500: '#25D366',
          600: '#1da851',
          700: '#167d3c',
          800: '#0e5227',
          900: '#072712',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        hero: ['62px', { lineHeight: '1.1' }],
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        normal: '0',
        wide: '0.02em',
        wider: '0.04em',
        widest: '0.08em',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
        full: '9999px',
      },
      spacing: {
        0: '0px',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        7: '1.75rem',
        8: '2rem',
        9: '2.25rem',
        10: '2.5rem',
        11: '2.75rem',
        12: '3rem',
        14: '3.5rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        28: '7rem',
        32: '8rem',
        36: '9rem',
        40: '10rem',
        44: '11rem',
        48: '12rem',
        52: '13rem',
        56: '14rem',
        60: '15rem',
        64: '16rem',
        72: '18rem',
        80: '20rem',
        96: '24rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        sm: '0 2px 4px rgba(15, 23, 42, 0.06)',
        DEFAULT: '0 4px 6px rgba(15, 23, 42, 0.07)',
        md: '0 6px 12px rgba(15, 23, 42, 0.08)',
        lg: '0 10px 20px rgba(15, 23, 42, 0.1)',
        xl: '0 16px 32px rgba(15, 23, 42, 0.12)',
        '2xl': '0 24px 48px rgba(15, 23, 42, 0.15)',
        card: '0 8px 24px rgba(15, 23, 42, 0.08)',
        'card-elevated': '0 18px 40px rgba(15, 23, 42, 0.12)',
        focus: '0 0 0 4px rgba(90, 13, 160, 0.35)',
        inner: 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.06)',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
    },
  },
  plugins: [],
}
