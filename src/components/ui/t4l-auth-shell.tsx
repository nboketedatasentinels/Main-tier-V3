import React, { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

const cn = (...classes: string[]) => classes.filter(Boolean).join(" ")

type RoutePoint = { x: number; y: number; delay: number }

const DotMap = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const routes: { start: RoutePoint; end: RoutePoint; color: string }[] = useMemo(
    () => [
      { start: { x: 100, y: 150, delay: 0 }, end: { x: 200, y: 80, delay: 2 }, color: "#350e6f" },
      { start: { x: 200, y: 80, delay: 2 }, end: { x: 260, y: 120, delay: 4 }, color: "#350e6f" },
      { start: { x: 50, y: 50, delay: 1 }, end: { x: 150, y: 180, delay: 3 }, color: "#350e6f" },
      { start: { x: 280, y: 60, delay: 0.5 }, end: { x: 180, y: 180, delay: 2.5 }, color: "#350e6f" },
    ],
    [],
  )

  const generateDots = (width: number, height: number) => {
    const dots: { x: number; y: number; radius: number; opacity: number }[] = []
    const gap = 12
    const dotRadius = 1

    for (let x = 0; x < width; x += gap) {
      for (let y = 0; y < height; y += gap) {
        const isInMapShape =
          ((x < width * 0.25 && x > width * 0.05) && (y < height * 0.4 && y > height * 0.1)) ||
          ((x < width * 0.25 && x > width * 0.15) && (y < height * 0.8 && y > height * 0.4)) ||
          ((x < width * 0.45 && x > width * 0.3) && (y < height * 0.35 && y > height * 0.15)) ||
          ((x < width * 0.5 && x > width * 0.35) && (y < height * 0.65 && y > height * 0.35)) ||
          ((x < width * 0.7 && x > width * 0.45) && (y < height * 0.5 && y > height * 0.1)) ||
          ((x < width * 0.8 && x > width * 0.65) && (y < height * 0.8 && y > height * 0.6))

        if (isInMapShape && Math.random() > 0.3) {
          dots.push({
            x,
            y,
            radius: dotRadius,
            opacity: Math.random() * 0.45 + 0.15,
          })
        }
      }
    }
    return dots
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
      canvas.width = width
      canvas.height = height
    })

    resizeObserver.observe(canvas.parentElement as Element)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return
    const ctx = context

    const dots = generateDots(dimensions.width, dimensions.height)
    let animationFrameId: number
    let startTime = Date.now()

    function drawDots() {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height)
      dots.forEach(dot => {
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(53, 14, 111, ${dot.opacity})`
        ctx.fill()
      })
    }

    function drawRoutes() {
      const currentTime = (Date.now() - startTime) / 1000
      routes.forEach(route => {
        const elapsed = currentTime - route.start.delay
        if (elapsed <= 0) return

        const duration = 3
        const progress = Math.min(elapsed / duration, 1)

        const x = route.start.x + (route.end.x - route.start.x) * progress
        const y = route.start.y + (route.end.y - route.start.y) * progress

        ctx.beginPath()
        ctx.moveTo(route.start.x, route.start.y)
        ctx.lineTo(x, y)
        ctx.strokeStyle = route.color
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(route.start.x, route.start.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = route.color
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = "#eab130"
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(234, 177, 48, 0.25)"
        ctx.fill()

        if (progress === 1) {
          ctx.beginPath()
          ctx.arc(route.end.x, route.end.y, 3, 0, Math.PI * 2)
          ctx.fillStyle = route.color
          ctx.fill()
        }
      })
    }

    function animate() {
      drawDots()
      drawRoutes()
      const currentTime = (Date.now() - startTime) / 1000
      if (currentTime > 15) startTime = Date.now()
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animationFrameId)
  }, [dimensions, routes])

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}

export function T4LAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "min-h-screen w-full flex items-center justify-center p-4",
        "bg-gradient-to-br from-[#27062e] via-[#350e6f] to-[#4540c0]"
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-5xl overflow-hidden rounded-2xl flex bg-white shadow-2xl"
      >
        <div className="hidden md:block w-1/2 relative overflow-hidden border-r border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-white to-[#eef0fb]">
            <DotMap />

            <div className="absolute inset-0 flex flex-col items-center justify-center p-10 z-10">
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="mb-6"
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#350e6f] to-[#27062e] flex items-center justify-center shadow-lg">
                  <ArrowRight className="text-white h-6 w-6" />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="text-3xl font-bold mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-[#350e6f] to-[#27062e]"
              >
                T4L
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="text-sm text-center text-gray-600 max-w-xs"
              >
                Transformation 4 Leaders — track your growth, earn points, and lead change with confidence.
              </motion.p>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center bg-white">
          {children}
        </div>
      </motion.div>
    </div>
  )
}
