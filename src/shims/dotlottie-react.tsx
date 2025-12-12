import React from 'react'

interface DotLottieReactProps {
  src: string
  loop?: boolean
  autoplay?: boolean
  style?: React.CSSProperties
}

// Lightweight fallback to unblock environments without the real package.
export const DotLottieReact: React.FC<DotLottieReactProps> = ({ style }) => {
  return (
    <div
      role="img"
      aria-label="Loading animation"
      style={{
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #f9db59, #ff8c42)',
        opacity: 0.9,
        boxShadow: '0 0 24px rgba(0,0,0,0.2)',
        ...style,
      }}
    />
  )
}

export default DotLottieReact
