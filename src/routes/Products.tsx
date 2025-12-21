import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import productsData from '../data/products.json' with { type: 'json' }
import ArrowRightIcon from '../components/icons/ArrowRightIcon'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import { useAdminAuth } from '../contexts/AdminAuthContext'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { CMS_ENDPOINT } from '../lib/endpoints'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

type Product = {
  slug: string
  name: string
  description: string
  language: string
  tags?: string[]
  url: string
  demo?: string
}

const staticProducts: Product[] = Array.isArray(productsData) ? (productsData as Product[]) : []

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
}

function Products() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  const { isAdmin, loginWithGoogle, logout, isLoading: authLoading } = useAdminAuth()

  // Productsページのメタタグ
  usePageMeta({
    title: 'Products | haroin57 web',
    description: 'haroinの個人プロジェクトとオープンソース作品',
    ogTitle: 'Products | haroin57 web',
    ogDescription: 'haroinの個人プロジェクトとオープンソース作品',
  })

  useScrollToTop()

  // 動的に取得したプロダクト一覧
  const [products, setProducts] = useState<Product[]>(staticProducts)
  const [isLoading, setIsLoading] = useState(true)

  // CMS APIからプロダクト一覧を取得（失敗時は静的データにフォールバック）
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${CMS_ENDPOINT}/products`)
        if (res.ok) {
          const data = (await res.json()) as { products: Product[] }
          if (data.products && data.products.length > 0) {
            setProducts(data.products)
          }
        }
      } catch {
        // API失敗時は静的データを使用
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [])

  // reveal要素を表示
  useReveal(pageRef, [isLoading])

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="mx-auto w-full max-w-2xl space-y-6 text-left">
            <header
              className="reveal flex items-center justify-between gap-4"
              style={MAIN_FONT_STYLE}
            >
              <div className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
                <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                  Home
                </PrefetchLink>
              </div>
              {/* 管理者UI */}
              <div className="flex items-center gap-2">
                {authLoading ? null : isAdmin ? (
                  <>
                    <Link
                      to="/admin/products/new"
                      className="px-3 py-1 rounded border border-green-500/50 bg-green-500/10 text-green-400 text-xs sm:text-sm font-semibold transition-colors hover:bg-green-500/20"
                    >
                      新規作成
                    </Link>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="px-3 py-1 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] text-xs sm:text-sm font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                    >
                      ログアウト
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => loginWithGoogle()}
                    className="px-3 py-1 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] text-xs sm:text-sm font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                  >
                    管理者ログイン
                  </button>
                )}
              </div>
            </header>

            <h1 className="reveal text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              Products
            </h1>

            {isLoading ? (
              <div className="reveal py-8 text-center opacity-70">読み込み中...</div>
            ) : (
              <ul className="reveal space-y-4">
                {products.map((product) => (
                  <li key={product.slug} className="group relative">
                    <PrefetchLink
                      to={`/products/${product.slug}`}
                      className="glass-panel block p-4 sm:p-6 transition-colors hover:bg-[color:var(--ui-surface-hover)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-2xl font-semibold text-[color:var(--fg-strong)]">
                              {product.name}
                            </h2>
                            <ArrowRightIcon className="h-4 w-4 opacity-60" />
                          </div>
                          <p className="text-sm sm:text-base opacity-80">{product.description}</p>
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: languageColors[product.language] || '#6e7681' }}
                              />
                              {product.language}
                            </span>
                            {product.tags && product.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {product.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[10px] sm:text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {product.demo && (
                        <div className="mt-3 pt-3 border-t border-[color:var(--ui-border)]">
                          <span className="text-xs sm:text-sm opacity-70">Demo: </span>
                          <span className="text-xs sm:text-sm underline-thin">{product.demo}</span>
                        </div>
                      )}
                    </PrefetchLink>
                    {/* 管理者用編集ボタン */}
                    {isAdmin && (
                      <Link
                        to={`/admin/products/${product.slug}/edit`}
                        className="absolute top-4 right-4 px-2 py-0.5 rounded border border-blue-500/50 bg-blue-500/10 text-blue-400 text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 hover:bg-blue-500/20 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        編集
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <SiteFooter />
      </main>
    </div>
  )
}

export default Products
