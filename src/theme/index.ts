import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

// KEEP existing keys, but FIX meaning and add semantic names.
// If you truly need that blue/purple, move it to brand.indigo and keep brand.gold gold.
const colors = {
  brand: {
    deepPlum: '#27062e',
    royalPurple: '#350e6f',
    flameOrange: '#f4540c',
    gold: '#eab130',
    softGold: '#f9db59',

    primary: '#f4540c',
    secondary: '#350e6f',
    indigo: '#5d6bff',

    // Backwards compatibility keys
    primaryMuted: '#eef0fb',
    accent: '#f6f7fb',
    sidebar: '#f3f4fb',
    text: '#3a4562',
    subtleText: '#6b7392',
    border: '#e6e8f3',
    warning: '#f4540c',
    textLight: '#ffffff',
    textOnDark: '#f3f4f6',
    textOnPrimary: '#ffffff',
  },
}

/**
 * TEXT RULES:
 * - Never use brand.softGold / brand.gold for body text.
 * - Use semantic tokens: text.primary, text.secondary, text.muted, text.inverse.
 * - Brand colors are for accents (borders, icons, CTA backgrounds).
 */
const semanticTokens = {
  colors: {
    // Backgrounds
    'bg.page': { default: '#07040d', _dark: '#07040d' },
    'bg.surface': { default: '#0d0716', _dark: '#0d0716' },
    'bg.card': { default: '#140a23', _dark: '#140a23' },

    // Text
    'text.primary': { default: 'gray.900', _dark: 'whiteAlpha.900' },
    'text.secondary': { default: 'gray.700', _dark: 'whiteAlpha.800' },
    'text.muted': { default: 'gray.600', _dark: 'whiteAlpha.700' },
    'text.subtle': { default: 'gray.500', _dark: 'whiteAlpha.600' },
    'text.inverse': { default: 'whiteAlpha.900', _dark: 'gray.900' },

    // Borders
    'border.subtle': { default: 'blackAlpha.200', _dark: 'whiteAlpha.200' },

    // Brand semantic
    'action.primary': { default: 'brand.flameOrange', _dark: 'brand.flameOrange' },
    'action.secondary': { default: 'brand.royalPurple', _dark: 'brand.royalPurple' },
    'accent.gold': { default: 'brand.gold', _dark: 'brand.gold' },
  },
}

const styles = {
  global: {
    body: {
      bg: 'bg.page',
      color: 'text.primary',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    'h1, h2, h3, h4, h5, h6': {
      color: 'text.primary',
    },
    a: {
      color: 'brand.primary',
      _hover: {
        color: '#c24300',
        textDecoration: 'underline',
      },
    },
  },
}

const components = {
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'lg',
    },
    variants: {
      primary: {
        bg: 'brand.primary',
        color: 'white',
        _hover: {
          bg: '#c24300',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: '#9d3600',
          transform: 'translateY(0)',
        },
      },
      secondary: {
        bg: 'white',
        color: 'brand.text',
        border: '1px solid',
        borderColor: 'brand.border',
        _hover: {
          bg: 'brand.primaryMuted',
          color: 'brand.text',
        },
      },
      ghost: {
        color: 'brand.text',
        _hover: {
          bg: 'brand.primaryMuted',
          color: 'brand.text',
        },
      },
    },
    defaultProps: {
      variant: 'primary',
    },
  },
  Card: {
    baseStyle: {
      container: {
        bg: 'bg.card',
        color: 'text.primary',
        borderColor: 'border.subtle',
        borderWidth: '1px',
        borderRadius: 'xl',
        boxShadow: 'sm',
      },
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: 'full',
      px: 3,
      py: 1,
      fontWeight: 'bold',
    },
    variants: {
      primary: {
        bg: 'brand.primary',
        color: 'white',
      },
    },
  },
  Progress: {
    baseStyle: {
      filledTrack: {
        bg: 'brand.primary',
      },
      track: {
        bg: 'brand.primaryMuted',
      },
    },
  },
  Heading: {
    baseStyle: {
      color: 'text.primary',
    },
  },
  Text: {
    baseStyle: {
      color: 'text.secondary',
    },
  },
  FormLabel: {
    baseStyle: {
      color: 'text.secondary',
      fontWeight: 'medium',
    },
  },
  FormHelperText: {
    baseStyle: {
      color: 'text.muted',
    },
  },
  Modal: {
    baseStyle: {
      dialog: {
        bg: 'bg.surface',
        color: 'text.primary',
        borderColor: 'border.subtle',
      },
    },
  },
}

const fonts = {
  heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const breakpoints = {
  sm: '30em',
  md: '48em',
  lg: '62em',
  xl: '80em',
  '2xl': '96em',
}

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  styles,
  components,
  fonts,
  breakpoints,
})

export default theme
