import { DotLottieReact } from '@lottiefiles/dotlottie-react'

export function AppLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-default">
      <DotLottieReact
        src="https://lottie.host/d9b4b8ae-2d44-4bc6-b80a-4d709d78bee5/MxsdsRgn1I.lottie"
        loop
        autoplay
        style={{ width: 160, height: 160, maxWidth: '60vw' }}
      />
    </div>
  )
}
