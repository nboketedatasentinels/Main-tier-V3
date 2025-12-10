import { extendTheme, type ThemeConfig, type StyleFunctionProps } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const colors = {
  brand: {
    plum: '#27062e',
    orange: '#f4540c',
    purple: '#350e6f',
    gold: '#eab130',
    softGold: '#f9db59',
  },
  success: {
    500: '#10b981',
  },
  warning: {
    500: '#f59e0b',
  },
  danger: {
    500: '#ef4444',
  },
}

const semanticTokens = {
  colors: {
    'bg.page': {
      default: '#07040d',
      _dark: '#07040d',
    },
    'bg.surface': {
      default: '#0d0716',
      _dark: '#0d0716',
    },
    'bg.card': {
      default: '#140a23',
      _dark: '#140a23',
    },
    'bg.cardMuted': {
      default: 'rgba(20,10,35,0.8)',
      _dark: 'rgba(20,10,35,0.8)',
    },
    'border.subtle': {
      default: 'whiteAlpha.200',
      _dark: 'whiteAlpha.200',
    },
    'brand.primary': {
      default: 'brand.orange',
      _dark: 'brand.orange',
    },
    'brand.secondary': {
      default: 'brand.purple',
      _dark: 'brand.purple',
    },
    'brand.surfaceAccent': {
      default: 'brand.plum',
      _dark: 'brand.plum',
    },
    'brand.gold': {
      default: 'brand.gold',
      _dark: 'brand.gold',
    },
    'brand.softGold': {
      default: 'brand.softGold',
      _dark: 'brand.softGold',
    },
    'text.primary': {
      default: 'white',
      _dark: 'white',
    },
    'text.muted': {
      default: 'gray.400',
      _dark: 'gray.400',
    },
    'text.subtle': {
      default: 'gray.500',
      _dark: 'gray.500',
    },
    'text.invert': {
      default: '#0b0712',
      _dark: '#0b0712',
    },
    'status.success': {
      default: 'success.500',
      _dark: 'success.500',
    },
    'status.warning': {
      default: 'warning.500',
      _dark: 'warning.500',
    },
    'status.danger': {
      default: 'danger.500',
      _dark: 'danger.500',
    },
    'badge.premium': {
      default: 'brand.gold',
      _dark: 'brand.gold',
    },
  },
}

const fonts = {
  heading: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  body: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
}

const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
}

const shadows = {
  outline: '0 0 0 2px rgba(244, 84, 12, 0.6)',
  subtle: '0 10px 30px rgba(0,0,0,0.35)',
  elevated: '0 18px 45px rgba(0,0,0,0.55)',
}

const styles = {
  global: () => ({
    'html, body, #root': {
      height: '100%',
    },
    body: {
      bg: 'bg.page',
      color: 'text.primary',
      fontFamily: 'body',
    },
    '*::selection': {
      backgroundColor: 'brand.softGold',
      color: 'text.invert',
    },
    '::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '::-webkit-scrollbar-thumb': {
      background: 'rgba(255,255,255,0.16)',
      borderRadius: 'full',
    },
    '::-webkit-scrollbar-thumb:hover': {
      background: 'rgba(255,255,255,0.32)',
    },
  }),
}

const layerStyles = {
  card: {
    bg: 'bg.card',
    borderRadius: '2xl',
    boxShadow: 'subtle',
    borderWidth: '1px',
    borderColor: 'border.subtle',
    padding: 6,
  },
  cardMuted: {
    bg: 'bg.cardMuted',
    borderRadius: '2xl',
    borderWidth: '1px',
    borderColor: 'border.subtle',
    padding: 4,
  },
  pill: {
    borderRadius: 'full',
    px: 3,
    py: 1,
    fontSize: 'xs',
    fontWeight: 'semibold',
  },
}

const textStyles = {
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontSize: 'xs',
    color: 'text.subtle',
  },
  pageTitle: {
    fontSize: ['2xl', '3xl'],
    fontWeight: 'bold',
    letterSpacing: '-0.03em',
  },
  statLabel: {
    fontSize: 'xs',
    color: 'text.subtle',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
  },
}

const components = {
  Button: {
    baseStyle: {
      borderRadius: 'full',
      fontWeight: 'semibold',
      _focusVisible: {
        boxShadow: 'outline',
      },
      _disabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
      },
    },
    sizes: {
      sm: {
        px: 4,
        h: 9,
        fontSize: 'sm',
      },
      md: {
        px: 6,
        h: 11,
        fontSize: 'sm',
      },
      lg: {
        px: 7,
        h: 12,
        fontSize: 'md',
      },
      icon: {
        p: 0,
        boxSize: 10,
      },
    },
    variants: {
      primary: () => ({
        bg: 'brand.primary',
        color: 'text.invert',
        boxShadow: 'subtle',
        _hover: {
          bg: 'brand.primary',
          filter: 'brightness(1.1)',
          transform: 'translateY(-1px)',
        },
        _active: {
          transform: 'translateY(0)',
          boxShadow: 'none',
        },
      }),
      secondary: () => ({
        bg: 'transparent',
        borderWidth: '1px',
        borderColor: 'border.subtle',
        color: 'text.primary',
        _hover: {
          bg: 'bg.surface',
        },
        _active: {
          bg: 'bg.card',
        },
      }),
      ghost: () => ({
        bg: 'transparent',
        color: 'text.primary',
        _hover: {
          bg: 'whiteAlpha.100',
        },
        _active: {
          bg: 'whiteAlpha.200',
        },
      }),
      premium: () => ({
        bg: 'linear-gradient(135deg, brand.gold, brand.softGold)',
        color: 'text.invert',
        boxShadow: 'elevated',
        _hover: {
          filter: 'brightness(1.05)',
        },
        _active: {
          filter: 'brightness(0.97)',
        },
      }),
      link: () => ({
        color: 'brand.primary',
        fontWeight: 'medium',
        _hover: {
          textDecoration: 'underline',
        },
      }),
    },
    defaultProps: {
      size: 'md',
      variant: 'primary',
    },
  },
  Heading: {
    baseStyle: {
      color: 'text.primary',
      fontWeight: 'semibold',
      letterSpacing: '-0.02em',
    },
  },
  Text: {
    baseStyle: {
      color: 'text.muted',
    },
  },
  Card: {
    baseStyle: {
      container: {
        bg: 'bg.card',
        borderRadius: '2xl',
        boxShadow: 'subtle',
        borderWidth: '1px',
        borderColor: 'border.subtle',
        _hover: {
          boxShadow: 'elevated',
          transform: 'translateY(-1px)',
        },
        transition: 'all 0.2s ease',
      },
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: 'full',
      fontWeight: 'semibold',
      textTransform: 'none',
    },
    variants: {
      premium: {
        bg: 'badge.premium',
        color: 'text.invert',
      },
      free: {
        bg: 'whiteAlpha.200',
        color: 'text.primary',
      },
      success: {
        bg: 'status.success',
        color: 'text.invert',
      },
      warning: {
        bg: 'status.warning',
        color: 'gray.900',
      },
    },
  },
  Tag: {
    baseStyle: {
      borderRadius: 'full',
      fontWeight: 'medium',
    },
  },
  Tabs: {
    baseStyle: {
      tab: {
        fontWeight: 'medium',
      },
    },
    variants: {
      softRounded: (_props: StyleFunctionProps) => ({
        tab: {
          borderRadius: 'full',
          px: 4,
          py: 2,
          _selected: {
            bg: 'bg.card',
            color: 'brand.gold',
          },
        },
      }),
      underline: {
        tab: {
          borderRadius: 0,
          pb: 3,
          _selected: {
            color: 'brand.gold',
            borderColor: 'brand.gold',
          },
        },
      },
    },
  },
  Input: {
    baseStyle: {
      field: {
        borderRadius: 'lg',
      },
    },
    variants: {
      filled: {
        field: {
          bg: 'bg.surface',
          borderWidth: '1px',
          borderColor: 'border.subtle',
          _hover: {
            bg: 'bg.surface',
          },
          _focusVisible: {
            borderColor: 'brand.primary',
            boxShadow: 'outline',
          },
        },
      },
      outline: {
        field: {
          borderRadius: 'lg',
          borderColor: 'border.subtle',
          _hover: {
            borderColor: 'whiteAlpha.400',
          },
          _focusVisible: {
            borderColor: 'brand.primary',
            boxShadow: 'outline',
          },
        },
      },
    },
    defaultProps: {
      variant: 'filled',
    },
  },
  Textarea: {
    variants: {
      filled: {
        bg: 'bg.surface',
        borderWidth: '1px',
        borderColor: 'border.subtle',
        borderRadius: 'lg',
        _focusVisible: {
          borderColor: 'brand.primary',
          boxShadow: 'outline',
        },
      },
    },
    defaultProps: {
      variant: 'filled',
    },
  },
  Select: {
    variants: {
      filled: {
        field: {
          bg: 'bg.surface',
          borderWidth: '1px',
          borderColor: 'border.subtle',
          borderRadius: 'lg',
          _focusVisible: {
            borderColor: 'brand.primary',
            boxShadow: 'outline',
          },
        },
      },
    },
    defaultProps: {
      variant: 'filled',
    },
  },
  Modal: {
    baseStyle: {
      dialog: {
        bg: 'bg.surface',
        borderRadius: '2xl',
        boxShadow: 'elevated',
      },
      header: {
        fontWeight: 'semibold',
      },
    },
  },
  Drawer: {
    baseStyle: {
      dialog: {
        bg: 'bg.surface',
      },
    },
  },
  Tooltip: {
    baseStyle: {
      borderRadius: 'lg',
      px: 3,
      py: 2,
      bg: 'bg.card',
      color: 'text.primary',
      boxShadow: 'subtle',
    },
  },
  Progress: {
    baseStyle: {
      track: {
        bg: 'whiteAlpha.200',
      },
      filledTrack: {
        bg: 'brand.primary',
      },
    },
  },
  Skeleton: {
    baseStyle: {
      startColor: 'whiteAlpha.100',
      endColor: 'whiteAlpha.300',
    },
  },
  Table: {
    baseStyle: {
      th: {
        textTransform: 'none',
        fontSize: 'xs',
        fontWeight: 'semibold',
        letterSpacing: '0.08em',
        color: 'text.subtle',
      },
      td: {
        borderColor: 'border.subtle',
      },
    },
    variants: {
      simple: {
        table: {
          borderCollapse: 'separate',
          borderSpacing: 0,
        },
        th: {
          bg: 'bg.surface',
        },
        td: {
          bg: 'transparent',
        },
      },
    },
  },
}

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts,
  radii,
  shadows,
  styles,
  layerStyles,
  textStyles,
  components,
})

export default theme
