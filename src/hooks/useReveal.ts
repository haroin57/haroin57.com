import { useEffect, type RefObject } from 'react'

export function useReveal<T extends HTMLElement>(ref: RefObject<T | null>, triggerKey?: string | number | boolean | null) {
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    queueMicrotask(() => {
      targets.forEach((el) => el.classList.add('is-visible'))
    })
  }, [ref, triggerKey])
}
