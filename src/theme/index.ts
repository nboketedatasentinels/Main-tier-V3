import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

// T4L Brand Colors (Mandatory)
const colors = {
  brand: {
    deepPlum: '#27062e',
    flameOrange: '#f4540c',
    royalPurple: '#350e6f',
    gold: '#eab130',
    softGold: '#f9db59',
  },
}

// Theme configuration
const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

// Component style overrides
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'lg',
    },
    variants: {
      primary: {
        bg: 'brand.flameOrange',
        color: 'white',
        _hover: {
          bg: '#d94a0b',
          transform: 'translateY(-2px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: '#c04309',
          transform: 'translateY(0)',
        },
      },
      secondary: {
        bg: 'brand.deepPlum',
        color: 'brand.softGold',
        border: '2px solid',
        borderColor: 'brand.gold',
        _hover: {
          bg: 'brand.royalPurple',
          transform: 'translateY(-2px)',
          boxShadow: 'lg',
        },
      },
      ghost: {
        color: 'brand.deepPlum',
        _hover: {
          bg: 'rgba(249, 219, 89, 0.1)',
          color: 'brand.gold',
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
        bg: 'brand.deepPlum',
        borderRadius: 'xl',
        boxShadow: 'md',
        border: '1px solid',
        borderColor: 'rgba(234, 177, 48, 0.2)',
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
      gold: {
        bg: 'brand.gold',
        color: 'brand.deepPlum',
      },
      purple: {
        bg: 'brand.royalPurple',
        color: 'brand.softGold',
      },
      orange: {
        bg: 'brand.flameOrange',
        color: 'white',
      },
    },
  },
  Progress: {
    baseStyle: {
      filledTrack: {
        bg: 'brand.gold',
      },
      track: {
        bg: 'rgba(234, 177, 48, 0.2)',
      },
    },
  },
}

// Global styles
const styles = {
  global: {
    body: {
      bg: 'brand.deepPlum',
      color: 'brand.softGold',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    'h1, h2, h3, h4, h5, h6': {
      color: 'brand.softGold',
    },
    a: {
      color: 'brand.flameOrange',
      _hover: {
        color: 'brand.gold',
        textDecoration: 'underline',
      },
    },
  },
}

// Fonts
const fonts = {
  heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

// Breakpoints
const breakpoints = {
  sm: '30em', // 480px
  md: '48em', // 768px
  lg: '62em', // 992px
  xl: '80em', // 1280px
  '2xl': '96em', // 1536px
}

const theme = extendTheme({
  colors,
  config,
  components,
  styles,
  fonts,
  breakpoints,
})

export default theme
