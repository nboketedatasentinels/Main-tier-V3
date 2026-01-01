import React, { useEffect } from 'react'

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'dotlottie-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        autoplay?: boolean
        loop?: boolean
        background?: string
        speed?: number
      }
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

interface DotLottieReactProps {
  src: string
  loop?: boolean
  autoplay?: boolean
  style?: React.CSSProperties
  className?: string
}

const SCRIPT_ID = 'dotlottie-player-loader'

export const DotLottieReact: React.FC<DotLottieReactProps> = ({
  src,
  loop = false,
  autoplay = false,
  style,
  className,
}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (customElements.get('dotlottie-player')) return

    const existingScript = document.getElementById(SCRIPT_ID)
    if (existingScript) return

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  return (
    <dotlottie-player
      src={src}
      loop={loop}
      autoplay={autoplay}
      style={style}
      className={className}
    />
  )
}

export default DotLottieReact
