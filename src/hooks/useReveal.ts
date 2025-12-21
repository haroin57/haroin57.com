import { useEffect, type DependencyList, type RefObject } from 'react'

export function useReveal(ref: RefObject<HTMLElement>, deps: DependencyList = []) {
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    queueMicrotask(() => {
      targets.forEach((el) => el.classList.add('is-visible'))
    })
  }, [ref, ...deps])
}
