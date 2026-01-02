import { useRef, useMemo } from 'react'
import PrefetchLink from '../components/PrefetchLink'
import productsData from '../data/products.json' with { type: 'json' }
import SiteFooter from '../components/SiteFooter'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useFetch } from '../hooks/useFetch'
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

  // CMS APIからプロダクト一覧を取得（失敗時は静的データにフォールバック）
  // SSRハイドレーション時は静的データを使用し、初回APIフェッチをスキップ
  type ProductsResponse = { products: Product[] }
  const fetchOptions = useMemo(() => ({
    fallback: staticProducts,
    transform: (data: ProductsResponse) => data.products?.length > 0 ? data.products : staticProducts,
    skipInitialFetch: true,
  }), [])
  const { data: products, isLoading } = useFetch<Product[], ProductsResponse>(
    `${CMS_ENDPOINT}/products`,
    fetchOptions
  )

  // reveal要素を表示
  useReveal(pageRef, isLoading)

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-10 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
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
                    <PrefetchLink
                      to="/admin/products/new"
                      className="px-3 py-1 rounded border border-green-500/50 bg-green-500/10 text-green-400 text-xs sm:text-sm font-semibold transition-colors hover:bg-green-500/20"
                    >
                      新規作成
                    </PrefetchLink>
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
              <ul className="reveal font-vdl-logomaru posts-divider">
                {products.map((product) => (
                  <li key={product.slug} className="space-y-2 py-4 group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-[color:var(--fg,inherit)] opacity-75">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: languageColors[product.language] || '#6e7681' }}
                        />
                        {product.language}
                      </div>
                      {isAdmin && (
                        <PrefetchLink
                          to={`/admin/products/${product.slug}/edit`}
                          className="px-2 py-0.5 rounded border border-blue-500/50 bg-blue-500/10 text-blue-400 text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 hover:bg-blue-500/20"
                        >
                          編集
                        </PrefetchLink>
                      )}
                    </div>
                    <h2 className="text-base sm:text-xl text-[color:var(--fg-strong,inherit)]">
                      <PrefetchLink
                        to={`/products/${product.slug}`}
                        className="underline-thin hover:text-accent"
                        style={{ color: 'inherit' }}
                      >
                        {product.name}
                      </PrefetchLink>
                    </h2>
                    <p className="text-xs sm:text-sm text-[color:var(--fg,inherit)] opacity-80">{product.description}</p>
                    {product.tags && product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-[11px] sm:text-sm">
                        {product.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
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
