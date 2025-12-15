import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const colors = {
  // Primary Brand Color: Indigo/Purple
  primary: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#5A0DA0',
    600: '#4A0B80',
    700: '#380860',
    800: '#2d0650',
    900: '#1e0340',
  },
  // Accent/Secondary Color: Gold
  accent: {
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
  secondary: {
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
  // WhatsApp Brand Color
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
  // Status Color Aliases
  statusGreen: '#16a34a',
  statusYellow: '#d97706',
  statusRed: '#dc2626',
  // Legacy brand keys preserved for compatibility
  brand: {
    primary: '#5A0DA0',
    primaryMuted: '#ede9fe',
    accent: '#f8fafc',
    sidebar: '#f1f5f9',
    text: '#334155',
    subtleText: '#64748b',
    border: '#e2e8f0',
    warning: '#f4540c',
    textLight: '#ffffff',
    textOnDark: '#f3f4f6',
    textOnPrimary: '#ffffff',
    deepPlum: '#27062e',
    flameOrange: '#f4540c',
    royalPurple: '#350e6f',
    gold: '#EAB130',
    softGold: '#f9db59',
  },
}

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

const components = {
  Button: {
    baseStyle: {
      fontWeight: '600',
      borderRadius: 'lg',
      transition: 'all 0.2s ease-in-out',
    },
    variants: {
      primary: {
        bg: 'primary.500',
        color: 'white',
        _hover: {
          bg: 'primary.600',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: 'primary.700',
          transform: 'translateY(0)',
        },
      },
      secondary: {
        bg: 'white',
        color: 'brand.text',
        border: '1px solid',
        borderColor: 'neutral.200',
        _hover: {
          bg: 'primary.50',
          color: 'brand.text',
        },
      },
      ghost: {
        color: 'brand.text',
        bg: 'transparent',
        _hover: {
          bg: 'primary.50',
          color: 'brand.text',
        },
      },
      accent: {
        bg: 'accent.500',
        color: 'white',
        _hover: {
          bg: 'accent.600',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: 'accent.700',
          transform: 'translateY(0)',
        },
      },
      destructive: {
        bg: 'error.500',
        color: 'white',
        _hover: {
          bg: 'error.600',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: 'error.700',
          transform: 'translateY(0)',
        },
      },
    },
    sizes: {
      sm: {
        px: 4,
        py: 2,
        fontSize: 'sm',
      },
      md: {
        px: 5,
        py: 3,
        fontSize: 'md',
      },
      lg: {
        px: 6,
        py: 4,
        fontSize: 'lg',
      },
    },
    defaultProps: {
      colorScheme: 'primary',
      variant: 'primary',
    },
  },
  Card: {
    baseStyle: {
      container: {
        bg: 'white',
        borderRadius: 'xl',
        boxShadow: 'card',
        border: '1px solid',
        borderColor: 'neutral.200',
      },
    },
    variants: {
      elevated: {
        container: {
          boxShadow: 'card-elevated',
        },
      },
      muted: {
        container: {
          boxShadow: 'sm',
        },
      },
      interactive: {
        container: {
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          _hover: {
            transform: 'translateY(-4px)',
            boxShadow: 'card-elevated',
            borderColor: 'primary.500',
          },
        },
      },
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: 'full',
      px: 3,
      py: 1,
      fontWeight: 'bold',
      textTransform: 'none',
    },
    variants: {
      primary: {
        bg: 'primary.500',
        color: 'white',
      },
      subtle: {
        bg: 'primary.50',
        color: 'primary.700',
      },
      success: {
        bg: 'success.500',
        color: 'white',
      },
      warning: {
        bg: 'warning.500',
        color: 'white',
      },
      error: {
        bg: 'error.500',
        color: 'white',
      },
      premium: {
        bg: 'accent.50',
        color: 'accent.700',
        border: '1px solid',
        borderColor: 'accent.200',
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: '0.02em',
      },
    },
  },
  Progress: {
    baseStyle: {
      filledTrack: {
        bg: 'primary.500',
      },
      track: {
        bg: 'neutral.100',
      },
    },
    variants: {
      success: {
        filledTrack: {
          bg: 'success.500',
        },
      },
      warning: {
        filledTrack: {
          bg: 'warning.500',
        },
      },
      error: {
        filledTrack: {
          bg: 'error.500',
        },
      },
    },
  },
  Input: {
    defaultProps: {
      focusBorderColor: 'primary.500',
      errorBorderColor: 'error.500',
    },
    variants: {
      outline: {
        field: {
          borderColor: 'neutral.300',
          borderRadius: 'lg',
          _focus: {
            borderColor: 'primary.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
          },
          _invalid: {
            borderColor: 'error.300',
            boxShadow: '0 0 0 1px var(--chakra-colors-error-300)',
          },
        },
      },
    },
  },
  Select: {
    defaultProps: {
      focusBorderColor: 'primary.500',
      errorBorderColor: 'error.500',
    },
    variants: {
      outline: {
        field: {
          borderColor: 'neutral.300',
          borderRadius: 'lg',
          _focus: {
            borderColor: 'primary.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
          },
        },
      },
    },
  },
  Textarea: {
    defaultProps: {
      focusBorderColor: 'primary.500',
      errorBorderColor: 'error.500',
    },
    variants: {
      outline: {
        borderColor: 'neutral.300',
        borderRadius: 'lg',
        _focus: {
          borderColor: 'primary.500',
          boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
        },
      },
    },
  },
  Checkbox: {
    baseStyle: {
      control: {
        borderColor: 'neutral.300',
        _checked: {
          bg: 'primary.500',
          borderColor: 'primary.500',
        },
      },
    },
  },
  Radio: {
    baseStyle: {
      control: {
        borderColor: 'neutral.300',
        _checked: {
          bg: 'primary.500',
          borderColor: 'primary.500',
        },
      },
    },
  },
}

const styles = {
  global: {
    body: {
      bg: 'brand.accent',
      color: 'brand.text',
      fontFamily: 'body',
    },
    'h1, h2, h3, h4, h5, h6': {
      color: 'brand.text',
      fontFamily: 'heading',
    },
    a: {
      color: 'primary.500',
      _hover: {
        color: 'primary.600',
        textDecoration: 'underline',
      },
    },
  },
}

const fonts = {
  heading: "'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  body: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const fontSizes = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
  hero: '62px',
}

const fontWeights = {
  thin: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
}

const letterSpacings = {
  tighter: '-0.02em',
  tight: '-0.01em',
  normal: '0',
  wide: '0.02em',
  wider: '0.04em',
  widest: '0.08em',
}

const shadows = {
  xs: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
  sm: '0 2px 4px rgba(15, 23, 42, 0.06)',
  md: '0 6px 12px rgba(15, 23, 42, 0.08)',
  lg: '0 10px 20px rgba(15, 23, 42, 0.1)',
  xl: '0 16px 32px rgba(15, 23, 42, 0.12)',
  '2xl': '0 24px 48px rgba(15, 23, 42, 0.15)',
  card: '0 8px 24px rgba(15, 23, 42, 0.08)',
  'card-elevated': '0 18px 40px rgba(15, 23, 42, 0.12)',
  focus: '0 0 0 4px rgba(90, 13, 160, 0.35)',
  inner: 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.06)',
}

const radii = {
  none: '0',
  sm: '0.25rem',
  base: '0.5rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  '4xl': '2.5rem',
  full: '9999px',
}

const breakpoints = {
  sm: '30em',
  md: '48em',
  lg: '62em',
  xl: '80em',
  '2xl': '96em',
}

const theme = extendTheme({
  colors,
  config,
  components,
  styles,
  fonts,
  fontSizes,
  fontWeights,
  letterSpacings,
  shadows,
  radii,
  breakpoints,
})

export default theme
