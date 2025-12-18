import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const accentGoldScale = {
  50: '#FFF7E6',
  100: '#FFEAC2',
  200: '#FFD88F',
  300: '#FEC25C',
  400: '#FDB038',
  500: '#EAB130',
  600: '#C98C24',
  700: '#A1681B',
  800: '#7A4A13',
  900: '#52300C',
}

const brandActionScale = {
  50: '#f2ecfb',
  100: '#e6daf6',
  200: '#d7cfe2',
  300: '#c1b2e6',
  400: '#a180d6',
  500: '#7f4fc2',
  600: '#5e2ea4',
  700: '#350e6f',
  800: '#2d0c5c',
  900: '#27062e',
}

const brandColors = {
  // Growth.design-approved anchors
  primary: '#350e6f',
  dark: '#27062e',
  indigo: '#350e6f',
  // Legacy/compatibility aliases mapped to new semantic neutrals
  primaryMuted: '#ede9fe',
  accent: '#f8fafc',
  sidebar: '#f1f5f9',
  text: '#0F172A',
  subtleText: '#334155',
  border: '#E2E8F0',
  warning: '#f4540c',
  textLight: '#ffffff',
  textOnDark: '#f3f4f6',
  textOnPrimary: '#ffffff',
  deepPlum: '#27062e',
  flameOrange: '#f4540c',
  royalPurple: '#350e6f',
  gold: '#EAB130',
  softGold: '#f9db59',
}

const colors = {
  // Brand Colors - Semantic Tokens (Growth.design approach)
  brand: brandColors,
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
    muted: '#475569',
    subtle: '#64748B',
    inverse: '#FFFFFF',
  },
  // Border Colors
  border: {
    subtle: '#E2E8F0',
    strong: '#CBD5E1',
    card: '#D6DEE8',
  },
  // Accent Colors - For highlights and status
  accent: {
    warning: '#eab130',  // Gold
    highlight: '#f9db59', // Yellow (backgrounds only, never text)
    purpleSubtle: '#ede9fe', // background tint for guidance sections
    purpleBorder: '#c4b5fd', // border tint for purple callouts
  },
  focusRing: {
    default: 'rgba(53, 14, 111, 0.35)',
  },
  // Danger/Destructive Actions
  danger: {
    DEFAULT: '#f4540c', // Orange
  },
  // Tint Tokens - 80% blend toward white for safe backgrounds
  tint: {
    brandDark: '#d4cdd5',
    brandPrimary: '#d7cfe2',
    danger: '#fdddce',
    accentWarning: '#fbefd6',
    accentHighlight: '#fef8de',
  },
  // Primary/brand action scale used by Chakra color schemes
  primary: brandActionScale,
  purple: brandActionScale,
  // Accent/Secondary Color: Gold (secondary is an alias for accent)
  secondary: accentGoldScale,
  // Neutral Gray Scale
  neutral: {
    50: '#F8F8F8',
    100: '#F0F0F0',
    200: '#E0E0E0',
    300: '#C7C7C7',
    400: '#A3A3A3',
    500: '#7A7A7A',
    600: '#5C5C5C',
    700: '#3F3F3F',
    800: '#262626',
    900: '#1A1A1A',
    darkest: '#1A1A1A',
    dark: '#333333',
    medium: '#555555',
    muted: '#777777',
    light: '#F5F5F5',
    border: '#E0E0E0',
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
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
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
        bg: 'brand.primary',
        color: 'white',
        _hover: {
          bg: 'brand.dark',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: 'brand.dark',
          transform: 'translateY(0)',
        },
      },
      secondary: {
        bg: 'surface.subtle',
        color: 'brand.primary',
        border: '1px solid',
        borderColor: 'brand.primary',
        _hover: {
          bg: 'tint.brandPrimary',
          color: 'brand.primary',
        },
      },
      ghost: {
        color: 'text.primary',
        bg: 'transparent',
        _hover: {
          bg: 'surface.subtle',
          color: 'text.primary',
        },
      },
      accent: {
        bg: 'accent.warning',
        color: 'text.primary',
        _hover: {
          bg: '#ca8a04',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: '#a16207',
          transform: 'translateY(0)',
        },
      },
      destructive: {
        bg: 'danger.DEFAULT',
        color: 'text.primary',
        _hover: {
          bg: '#ea580c',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: '#ea580c',
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
        bg: 'surface.default',
        borderRadius: 'xl',
        boxShadow: 'card',
        border: '1px solid',
        borderColor: 'border.subtle',
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
          bg: 'surface.subtle',
        },
      },
      interactive: {
        container: {
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          _hover: {
            transform: 'translateY(-4px)',
            boxShadow: 'card-elevated',
            borderColor: 'brand.primary',
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
        bg: 'brand.primary',
        color: 'white',
      },
      subtle: {
        bg: 'tint.brandPrimary',
        color: 'brand.primary',
      },
      success: {
        bg: 'success.500',
        color: 'white',
      },
      warning: {
        bg: 'tint.accentWarning',
        color: 'text.primary',
      },
      error: {
        bg: 'tint.danger',
        color: 'text.primary',
      },
      premium: {
        bg: 'tint.accentWarning',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'accent.warning',
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: '0.02em',
      },
    },
  },
  Tag: {
    baseStyle: {
      container: {
        borderRadius: 'full',
        fontWeight: '600',
      },
      label: {
        color: 'text.primary',
      },
    },
    variants: {
      subtle: {
        container: {
          bg: 'surface.muted',
          border: '1px solid',
          borderColor: 'border.strong',
        },
      },
    },
    defaultProps: {
      variant: 'subtle',
    },
  },
  Progress: {
    baseStyle: {
      filledTrack: {
        bg: 'brand.primary',
      },
      track: {
        bg: 'surface.muted',
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
          bg: 'accent.warning',
        },
      },
      error: {
        filledTrack: {
          bg: 'danger.DEFAULT',
        },
      },
    },
  },
  Input: {
    defaultProps: {
      focusBorderColor: 'brand.primary',
      errorBorderColor: 'danger.DEFAULT',
    },
    variants: {
      outline: {
        field: {
          borderColor: 'border.subtle',
          borderRadius: 'lg',
          bg: 'surface.default',
          _focus: {
            borderColor: 'brand.primary',
            boxShadow: '0 0 0 1px var(--chakra-colors-focusRing-default)',
          },
          _invalid: {
            borderColor: 'danger.DEFAULT',
            boxShadow: '0 0 0 1px var(--chakra-colors-danger-DEFAULT)',
          },
        },
      },
    },
  },
  Select: {
    defaultProps: {
      focusBorderColor: 'brand.primary',
      errorBorderColor: 'danger.DEFAULT',
    },
    variants: {
      outline: {
        field: {
          borderColor: 'border.subtle',
          borderRadius: 'lg',
          bg: 'surface.default',
          _focus: {
            borderColor: 'brand.primary',
            boxShadow: '0 0 0 1px var(--chakra-colors-focusRing-default)',
          },
        },
      },
    },
  },
  Textarea: {
    defaultProps: {
      focusBorderColor: 'brand.primary',
      errorBorderColor: 'danger.DEFAULT',
    },
    variants: {
      outline: {
        borderColor: 'border.subtle',
        borderRadius: 'lg',
        bg: 'surface.default',
        _focus: {
          borderColor: 'brand.primary',
          boxShadow: '0 0 0 1px var(--chakra-colors-focusRing-default)',
        },
      },
    },
  },
  Checkbox: {
    baseStyle: {
      control: {
        borderColor: 'border.strong',
        _checked: {
          bg: 'brand.primary',
          borderColor: 'brand.primary',
        },
      },
    },
  },
  Radio: {
    baseStyle: {
      control: {
        borderColor: 'border.strong',
        _checked: {
          bg: 'brand.primary',
          borderColor: 'brand.primary',
        },
      },
    },
  },
  Modal: {
    baseStyle: {
      dialog: {
        bg: 'surface.default',
      },
      header: {
        color: 'text.primary',
      },
      body: {
        color: 'text.secondary',
      },
    },
  },
  Text: {
    baseStyle: {
      color: 'text.primary',
    },
  },
  Heading: {
    baseStyle: {
      color: 'text.primary',
    },
  },
}

const styles = {
  global: {
    body: {
      bg: 'surface.subtle',
      color: 'text.primary',
      fontFamily: 'body',
    },
    'h1, h2, h3, h4, h5, h6': {
      color: 'text.primary',
      fontFamily: 'heading',
    },
    a: {
      color: 'brand.primary',
      _hover: {
        color: 'brand.dark',
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
  '5xl': '2.625rem',
  '6xl': '3rem',
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
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 10px 30px rgba(15, 23, 42, 0.08)',
  lg: '0 18px 40px rgba(15, 23, 42, 0.12)',
  xl: '0 20px 45px rgba(15, 23, 42, 0.14)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  card: '0 10px 30px rgba(15, 23, 42, 0.08)',
  'card-elevated': '0 20px 45px rgba(15, 23, 42, 0.12)',
  focus: '0 0 0 4px var(--chakra-colors-focusRing-default)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
}

const radii = {
  none: '0',
  sm: '0.375rem',
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
