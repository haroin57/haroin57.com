import { useEffect, useRef } from 'react'

type Vec4 = [number, number, number, number]
type Vec3 = [number, number, number]

const baseVertices: Vec4[] = []
for (let i = 0; i < 16; i += 1) {
  baseVertices.push([
    i & 1 ? 1 : -1,
    i & 2 ? 1 : -1,
    i & 4 ? 1 : -1,
    i & 8 ? 1 : -1,
  ])
}

const edges: Array<[number, number]> = []
for (let i = 0; i < baseVertices.length; i += 1) {
  for (let j = i + 1; j < baseVertices.length; j += 1) {
    let diff = 0
    for (let k = 0; k < 4; k += 1) {
      if (baseVertices[i][k] !== baseVertices[j][k]) diff += 1
    }
    if (diff === 1) edges.push([i, j])
  }
}

const rotate2 = (a: number, b: number, angle: number): [number, number] => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [a * c - b * s, a * s + b * c]
}

const rotate4D = (v: Vec4, aXY: number, aZW: number, aXW: number): Vec4 => {
  let [x, y, z, w] = v
  ;[x, y] = rotate2(x, y, aXY)
  ;[z, w] = rotate2(z, w, aZW)
  ;[x, w] = rotate2(x, w, aXW)
  return [x, y, z, w]
}

const rotate3D = (v: Vec3, aX: number, aY: number): Vec3 => {
  let [x, y, z] = v
  ;[y, z] = rotate2(y, z, aX)
  ;[x, z] = rotate2(x, z, aY)
  return [x, y, z]
}

const project4D = (v: Vec4, distance: number): Vec3 => {
  const scale = distance / (distance - v[3])
  return [v[0] * scale, v[1] * scale, v[2] * scale]
}

const project3D = (v: Vec3, distance: number): Vec3 => {
  const scale = distance / (distance - v[2])
  return [v[0] * scale, v[1] * scale, v[2]]
}

const RENDER_SCALE = 0.72
const TARGET_FPS = 24
const MIN_CANVAS_WIDTH = 320
const MIN_CANVAS_HEIGHT = 240

function P5HypercubeBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    let active = true
    const init = async () => {
      if (!containerRef.current) return
      const { default: P5 } = await import('p5')
      if (!active || !containerRef.current) return

      const sketch = (p: any) => {
        const prefersReduced =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches

        p.setup = () => {
          const w = Math.max(MIN_CANVAS_WIDTH, Math.floor(p.windowWidth * RENDER_SCALE))
          const h = Math.max(MIN_CANVAS_HEIGHT, Math.floor(p.windowHeight * RENDER_SCALE))
          p.createCanvas(w, h, p.WEBGL)
          p.pixelDensity(1)
          p.frameRate(TARGET_FPS)
          p.noFill()
          if (typeof p.noSmooth === 'function') p.noSmooth()
          if (prefersReduced) p.noLoop()
        }

        p.windowResized = () => {
          const w = Math.max(MIN_CANVAS_WIDTH, Math.floor(p.windowWidth * RENDER_SCALE))
          const h = Math.max(MIN_CANVAS_HEIGHT, Math.floor(p.windowHeight * RENDER_SCALE))
          p.resizeCanvas(w, h)
        }

        p.draw = () => {
          const t = p.millis() * 0.00009
          const angleA = t * 1.0
          const angleB = t * 0.7
          const angleC = t * 0.55

          const points: Array<{ x: number; y: number; z: number }> = baseVertices.map((v) => {
            const rotated4d = rotate4D(v, angleA, angleB, angleC)
            const projected3d = project4D(rotated4d, 3.2)
            const rotated3d = rotate3D(projected3d, t * 0.9, t * 0.7)
            const projected2d = project3D(rotated3d, 4.2)
            return { x: projected2d[0], y: projected2d[1], z: projected2d[2] }
          })

          const size = Math.min(p.width, p.height) * 0.1
          const padding = p.windowWidth < 640 ? 16 : 24
          const maxWidth = 896
          const contentWidth = Math.min(p.windowWidth - padding * 2, maxWidth)
          const contentLeft = (p.windowWidth - contentWidth) * 0.5
          const targetX = contentLeft + contentWidth * 0.86
          const targetY = p.windowHeight * 0.42
          const driftX = Math.sin(t * 0.8) * p.windowWidth * 0.03
          const driftY = Math.cos(t * 0.6) * p.windowHeight * 0.03
          const scaleX = p.width / p.windowWidth
          const scaleY = p.height / p.windowHeight
          const centerX = (targetX + driftX) * scaleX
          const centerY = (targetY + driftY) * scaleY
          const offsetX = centerX - p.width * 0.5
          const offsetY = centerY - p.height * 0.5

          p.clear()
          p.translate(offsetX, offsetY, 0)
          p.strokeWeight(1)

          for (const [a, b] of edges) {
            const pa = points[a]
            const pb = points[b]
            const depth = (pa.z + pb.z) * 0.5
            const alpha = Math.max(80, Math.min(255, 180 + depth * 80))
            p.stroke(255, 255, 255, alpha)
            const zA = pa.z * size * 0.4
            const zB = pb.z * size * 0.4
            p.line(pa.x * size, pa.y * size, zA, pb.x * size, pb.y * size, zB)
          }
        }
      }

      instanceRef.current = new P5(sketch, containerRef.current)
    }

    void init()
    return () => {
      active = false
      if (instanceRef.current) {
        instanceRef.current.remove()
        instanceRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} className="p5-bg" aria-hidden="true" />
}

export default P5HypercubeBackground
