import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const TOP_PATH = '/'
const HOME_PATH = '/home'

function normalizeWheelDeltaY(event: WheelEvent) {
  let delta = event.deltaY
  if (event.deltaMode === 1) delta *= 16
  else if (event.deltaMode === 2) delta *= window.innerHeight
  return delta
}

function shouldIgnoreTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('[data-scroll-switch-ignore="true"]')) return true
  if (target.closest('input,textarea,select,option,[contenteditable="true"]')) return true
  return false
}

export default function ScrollTopHomeSwitch() {
  const location = useLocation()
  const navigate = useNavigate()
  const wheelAccumRef = useRef(0)
  const wheelLastAtRef = useRef(0)
  const touchStartYRef = useRef<number | null>(null)
  const touchStartScrollYRef = useRef(0)
  const navigatingRef = useRef(false)
  const cooldownUntilRef = useRef(0)

  useEffect(() => {
    navigatingRef.current = false
    wheelAccumRef.current = 0
  }, [location.pathname])

  useEffect(() => {
    const path = location.pathname
    if (path !== TOP_PATH && path !== HOME_PATH) return

    const isAtTop = () => (window.scrollY || 0) <= 1

    const trigger = (to: string) => {
      const now = performance.now()
      if (navigatingRef.current) return
      if (now < cooldownUntilRef.current) return
      navigatingRef.current = true
      cooldownUntilRef.current = now + 900
      navigate(to)
    }

    const onWheel = (event: WheelEvent) => {
      if (shouldIgnoreTarget(event.target)) return
      const now = performance.now()
      const resetAfterMs = 180
      if (now - wheelLastAtRef.current > resetAfterMs) wheelAccumRef.current = 0
      wheelLastAtRef.current = now

      const deltaY = normalizeWheelDeltaY(event)
      if (!Number.isFinite(deltaY) || deltaY === 0) return

      if (path === TOP_PATH) {
        if (!isAtTop()) return
        if (deltaY <= 0) {
          wheelAccumRef.current = 0
          return
        }
        wheelAccumRef.current += deltaY
        if (wheelAccumRef.current >= 120) trigger(HOME_PATH)
        return
      }

      // HOME_PATH
      if (!isAtTop()) return
      if (deltaY >= 0) {
        wheelAccumRef.current = 0
        return
      }
      wheelAccumRef.current += -deltaY
      if (wheelAccumRef.current >= 120) trigger(TOP_PATH)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (shouldIgnoreTarget(event.target)) return
      if (event.touches.length !== 1) return
      touchStartYRef.current = event.touches[0]?.clientY ?? null
      touchStartScrollYRef.current = window.scrollY || 0
    }

    const onTouchMove = (event: TouchEvent) => {
      if (shouldIgnoreTarget(event.target)) return
      if (event.touches.length !== 1) return
      const startY = touchStartYRef.current
      if (startY === null) return

      const currentY = event.touches[0]?.clientY ?? startY
      const dy = startY - currentY
      const threshold = 72

      if (path === TOP_PATH) {
        if (dy > threshold) trigger(HOME_PATH)
        return
      }

      // HOME_PATH
      if (touchStartScrollYRef.current > 1) return
      if (dy < -threshold) trigger(TOP_PATH)
    }

    const resetTouch = () => {
      touchStartYRef.current = null
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', resetTouch, { passive: true })
    window.addEventListener('touchcancel', resetTouch, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', resetTouch)
      window.removeEventListener('touchcancel', resetTouch)
    }
  }, [location.pathname, navigate])

  return null
}

