"use client"

import { useEffect, useRef } from "react"

interface Vector2D {
  x: number
  y: number
}

class Particle {
  pos: Vector2D = { x: 0, y: 0 }
  vel: Vector2D = { x: 0, y: 0 }
  acc: Vector2D = { x: 0, y: 0 }
  target: Vector2D = { x: 0, y: 0 }

  closeEnoughTarget = 100
  maxSpeed = 1.0
  maxForce = 0.1
  particleSize = 10
  isKilled = false

  startColor = { r: 0, g: 0, b: 0 }
  targetColor = { r: 0, g: 0, b: 0 }
  colorWeight = 0
  colorBlendRate = 0.01

  move() {
    // Check if particle is close enough to its target to slow down
    let proximityMult = 1
    const distance = Math.sqrt(Math.pow(this.pos.x - this.target.x, 2) + Math.pow(this.pos.y - this.target.y, 2))

    if (distance < this.closeEnoughTarget) {
      proximityMult = distance / this.closeEnoughTarget
    }

    // Add force towards target
    const towardsTarget = {
      x: this.target.x - this.pos.x,
      y: this.target.y - this.pos.y,
    }

    const magnitude = Math.sqrt(towardsTarget.x * towardsTarget.x + towardsTarget.y * towardsTarget.y)
    if (magnitude > 0) {
      towardsTarget.x = (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult
      towardsTarget.y = (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult
    }

    const steer = {
      x: towardsTarget.x - this.vel.x,
      y: towardsTarget.y - this.vel.y,
    }

    const steerMagnitude = Math.sqrt(steer.x * steer.x + steer.y * steer.y)
    if (steerMagnitude > 0) {
      steer.x = (steer.x / steerMagnitude) * this.maxForce
      steer.y = (steer.y / steerMagnitude) * this.maxForce
    }

    this.acc.x += steer.x
    this.acc.y += steer.y

    // Move particle
    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  draw(ctx: CanvasRenderingContext2D, drawAsPoints: boolean) {
    // Blend towards target color
    if (this.colorWeight < 1.0) {
      this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0)
    }

    // Calculate current color
    const currentColor = {
      r: Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight),
      g: Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight),
      b: Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight),
    }

    if (drawAsPoints) {
      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`
      ctx.fillRect(this.pos.x, this.pos.y, 2, 2)
    } else {
      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`
      ctx.beginPath()
      ctx.arc(this.pos.x, this.pos.y, this.particleSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  kill(width: number, height: number) {
    if (!this.isKilled) {
      // Set target outside the scene
      const randomPos = this.generateRandomPos(width / 2, height / 2, (width + height) / 2)
      this.target.x = randomPos.x
      this.target.y = randomPos.y

      // Begin blending color to black
      this.startColor = {
        r: this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight,
        g: this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight,
        b: this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight,
      }
      this.targetColor = { r: 0, g: 0, b: 0 }
      this.colorWeight = 0

      this.isKilled = true
    }
  }

  private generateRandomPos(x: number, y: number, mag: number): Vector2D {
    const randomX = Math.random() * 1000
    const randomY = Math.random() * 500

    const direction = {
      x: randomX - x,
      y: randomY - y,
    }

    const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
    if (magnitude > 0) {
      direction.x = (direction.x / magnitude) * mag
      direction.y = (direction.y / magnitude) * mag
    }

    return {
      x: x + direction.x,
      y: y + direction.y,
    }
  }
}

interface ParticleTextEffectProps {
  words?: string[]
}

const DEFAULT_WORDS = ["KeepItBack", "Launching Soon"]
const PIXEL_STEPS = 4
const WORD_CHANGE_INTERVAL = 5000
const PARTICLE_COLORS = [
  { r: 74, g: 222, b: 255 },
  { r: 121, g: 142, b: 255 },
  { r: 183, g: 119, b: 255 },
  { r: 255, g: 105, b: 190 },
  { r: 255, g: 177, b: 92 },
  { r: 112, g: 245, b: 190 },
]

export function ParticleTextEffect({ words = DEFAULT_WORDS }: ParticleTextEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: 0, y: 0, isPressed: false, isRightClick: false })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    let wordIndex = 0
    let lastWordChange = performance.now()
    const particles = particlesRef.current

    const resizeCanvas = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
      setWord(words[wordIndex])
    }

    const setWord = (word: string) => {
      const offscreenCanvas = document.createElement("canvas")
      offscreenCanvas.width = width
      offscreenCanvas.height = height
      const offscreenCtx = offscreenCanvas.getContext("2d")
      if (!offscreenCtx) return

      let fontSize = Math.min(220, height * 0.28, width * 0.14)
      offscreenCtx.font = `bold ${fontSize}px Arial`
      const textWidth = offscreenCtx.measureText(word).width
      if (textWidth > width * 0.88) {
        fontSize *= (width * 0.88) / textWidth
        offscreenCtx.font = `bold ${fontSize}px Arial`
      }
      offscreenCtx.fillStyle = "white"
      offscreenCtx.textAlign = "center"
      offscreenCtx.textBaseline = "middle"
      offscreenCtx.fillText(word, width / 2, height / 2)

      const pixels = offscreenCtx.getImageData(0, 0, width, height).data
      const targets: Vector2D[] = []
      for (let y = 0; y < height; y += PIXEL_STEPS) {
        for (let x = 0; x < width; x += PIXEL_STEPS) {
          if (pixels[(y * width + x) * 4 + 3] > 0) targets.push({ x, y })
        }
      }

      for (let i = targets.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[targets[i], targets[j]] = [targets[j], targets[i]]
      }

      targets.forEach((target, index) => {
        let particle = particles[index]
        let assignColor = false
        if (!particle) {
          particle = new Particle()
          assignColor = true
          const angle = Math.random() * Math.PI * 2
          const distance = Math.max(width, height) * 0.7
          particle.pos = {
            x: width / 2 + Math.cos(angle) * distance,
            y: height / 2 + Math.sin(angle) * distance,
          }
          particle.maxSpeed = Math.random() * 6 + 4
          particle.maxForce = particle.maxSpeed * 0.05
          particle.particleSize = Math.random() * 6 + 6
          particle.colorBlendRate = Math.random() * 0.0275 + 0.0025
          particles.push(particle)
        } else if (particle.isKilled) {
          assignColor = true
        }

        particle.isKilled = false
        if (assignColor) {
          particle.targetColor = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
          particle.colorWeight = 0
        }
        particle.target = target
      })

      for (let i = targets.length; i < particles.length; i++) {
        particles[i].kill(width, height)
      }
    }

    const animate = (timestamp: number) => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)"
      ctx.fillRect(0, 0, width, height)

      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i]
        particle.move()
        particle.draw(ctx, true)
        if (particle.isKilled && (
          particle.pos.x < 0 || particle.pos.x > width ||
          particle.pos.y < 0 || particle.pos.y > height
        )) {
          particles.splice(i, 1)
        }
      }

      if (mouseRef.current.isPressed && mouseRef.current.isRightClick) {
        particles.forEach((particle) => {
          if (Math.hypot(particle.pos.x - mouseRef.current.x, particle.pos.y - mouseRef.current.y) < 50) {
            particle.kill(width, height)
          }
        })
      }

      if (timestamp - lastWordChange >= WORD_CHANGE_INTERVAL && words.length > 1) {
        wordIndex = (wordIndex + 1) % words.length
        setWord(words[wordIndex])
        lastWordChange = timestamp
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    const updatePointer = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = event.clientX - rect.left
      mouseRef.current.y = event.clientY - rect.top
    }
    const handleMouseDown = (event: MouseEvent) => {
      updatePointer(event)
      mouseRef.current.isPressed = true
      mouseRef.current.isRightClick = event.button === 2
    }
    const handleMouseUp = () => {
      mouseRef.current.isPressed = false
      mouseRef.current.isRightClick = false
    }
    const handleContextMenu = (event: MouseEvent) => event.preventDefault()

    resizeCanvas()
    animationRef.current = requestAnimationFrame(animate)
    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", updatePointer)
    canvas.addEventListener("contextmenu", handleContextMenu)
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("resize", resizeCanvas)

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", updatePointer)
      canvas.removeEventListener("contextmenu", handleContextMenu)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [words])

  return (
    <div className="particle-page">
      <canvas ref={canvasRef} className="particle-canvas" aria-label="KeepItBack, launching soon" />
      <div className="particle-caption">
        <p className="caption-title">KeepItBack</p>
        <p className="caption-hint">Launching Soon</p>
      </div>
    </div>
  )
}
