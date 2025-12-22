import { lazy } from 'react'

type ModuleWithDefault<T> = { default: T }

export type PreloadableLazyComponent<T extends React.ComponentType<unknown>> =
  React.LazyExoticComponent<T> & { preload: () => Promise<void> }

type Thenable<T> = {
  then: (onFulfilled: (value: T) => void, onRejected?: (reason: unknown) => void) => void
}

export function lazyWithPreload<T extends React.ComponentType<unknown>>(
  loader: () => Promise<ModuleWithDefault<T>>
): PreloadableLazyComponent<T> {
  let loadedModule: ModuleWithDefault<T> | null = null
  let loadPromise: Promise<ModuleWithDefault<T>> | null = null

  const load = () => {
    if (loadedModule) {
      const resolved = loadedModule
      const thenable: Thenable<ModuleWithDefault<T>> = {
        then(onFulfilled) {
          onFulfilled(resolved)
        },
      }
      return thenable as unknown as Promise<ModuleWithDefault<T>>
    }

    if (!loadPromise) {
      loadPromise = loader().then((module) => {
        loadedModule = module
        return module
      })
    }

    return loadPromise
  }

  const LazyComponent = lazy(load) as unknown as PreloadableLazyComponent<T>
  LazyComponent.preload = () => load().then(() => undefined)

  return LazyComponent
}
