import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

type PageMeta = {
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  ogUrl?: string
  twitterTitle?: string
  twitterDescription?: string
}

const DEFAULT_META: Required<PageMeta> = {
  title: 'haroin57 web',
  description: 'haroinがつくる個人サイト',
  ogTitle: 'haroin57 web',
  ogDescription: 'haroinの個人サイト',
  ogUrl: 'https://haroin57.com',
  twitterTitle: 'haroin57 web',
  twitterDescription: '分散システム、Web開発、デスクトップ音楽のメモやブログをまとめたharoinの個人サイト。',
}

function ensureMeta(key: 'name' | 'property', value: string): HTMLMetaElement {
  let el = document.querySelector(`meta[${key}="${value}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(key, value)
    document.head.appendChild(el)
  }
  return el
}

function updateMeta(meta: PageMeta, pathname: string) {
  const title = meta.title ?? DEFAULT_META.title
  const description = meta.description ?? DEFAULT_META.description
  const ogTitle = meta.ogTitle ?? meta.title ?? DEFAULT_META.ogTitle
  const ogDescription = meta.ogDescription ?? meta.description ?? DEFAULT_META.ogDescription
  const ogUrl = meta.ogUrl ?? `https://haroin57.com${pathname}`
  const twitterTitle = meta.twitterTitle ?? meta.title ?? DEFAULT_META.twitterTitle
  const twitterDescription = meta.twitterDescription ?? meta.description ?? DEFAULT_META.twitterDescription

  document.title = title
  ensureMeta('name', 'description').setAttribute('content', description)
  ensureMeta('property', 'og:title').setAttribute('content', ogTitle)
  ensureMeta('property', 'og:description').setAttribute('content', ogDescription)
  ensureMeta('property', 'og:url').setAttribute('content', ogUrl)
  ensureMeta('name', 'twitter:title').setAttribute('content', twitterTitle)
  ensureMeta('name', 'twitter:description').setAttribute('content', twitterDescription)
  ensureMeta('name', 'twitter:url').setAttribute('content', ogUrl)
}

export function usePageMeta(meta: PageMeta = {}) {
  const location = useLocation()

  useEffect(() => {
    updateMeta(meta, location.pathname)
    // cleanup不要 - 次のページが自分のメタタグを設定する
  }, [meta, location.pathname])
}

export default usePageMeta
