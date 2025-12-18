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

const colors = {
  // Primary Brand Color: Indigo/Purple
  primary: {
    50: '#F4EBFF',
    100: '#E3D2FF',
    200: '#C6A7FF',
    300: '#AA7CFF',
    400: '#8D51F0',
    500: '#5A0DA0',
    600: '#4A0B80',
    700: '#380860',
    800: '#270540',
    900: '#180320',
  },
  // Accent/Secondary Color: Gold (secondary is an alias for accent)
  accent: accentGoldScale,
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
  // Legacy brand keys preserved for compatibility
  brand: {
    primary: '#5A0DA0',
    primaryMuted: '#F4EBFF',
    accent: '#F8F8F8',
    sidebar: '#F0F0F0',
    text: '#3F3F3F',
    subtleText: '#7A7A7A',
    border: '#E0E0E0',
    warning: '#f4540c',
    textLight: '#ffffff',
    textOnDark: '#f3f4f6',
    textOnPrimary: '#ffffff',
    deepPlum: '#27062e',
    flameOrange: '#f4540c',
    royalPurple: '#3D0C69',
    gold: '#EAB130',
    softGold: '#FFD600',
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
      bg: 'neutral.50',
      color: 'neutral.900',
      fontFamily: 'body',
    },
    'h1, h2, h3, h4, h5, h6': {
      color: 'neutral.900',
      fontFamily: 'heading',
    },
    a: {
      color: 'primary.600',
      _hover: {
        color: 'primary.700',
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
  focus: '0 0 0 4px rgba(90, 13, 160, 0.35)',
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
