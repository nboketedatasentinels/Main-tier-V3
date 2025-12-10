import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const colors = {
  brand: {
    primary: '#5d6bff',
    primaryMuted: '#eef0fb',
    accent: '#f6f7fb',
    text: '#3a4562',
    subtleText: '#6b7392',
    border: '#e6e8f3',
    warning: '#f4540c',
    // Legacy keys preserved for compatibility
    deepPlum: '#27062e',
    flameOrange: '#f4540c',
    royalPurple: '#350e6f',
    gold: '#5d6bff',
    softGold: '#eef0fb',
  },
}

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
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
          bg: '#4b59e6',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: '#3f4ccc',
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
        bg: 'white',
        borderRadius: 'xl',
        boxShadow: 'sm',
        border: '1px solid',
        borderColor: 'brand.border',
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
      subtle: {
        bg: 'brand.primaryMuted',
        color: 'brand.text',
      },
      warning: {
        bg: 'brand.warning',
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
}

const styles = {
  global: {
    body: {
      bg: 'brand.accent',
      color: 'brand.text',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    'h1, h2, h3, h4, h5, h6': {
      color: 'brand.text',
    },
    a: {
      color: 'brand.primary',
      _hover: {
        color: '#4b59e6',
        textDecoration: 'underline',
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
  colors,
  config,
  components,
  styles,
  fonts,
  breakpoints,
})

export default theme
