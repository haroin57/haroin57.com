import { useLocation, useParams} from 'react-router-dom'
import PrefetchLink from '../components/PrefetchLink'
import { useEffect, useMemo, useRef, useState, useCallback, startTransition, lazy, Suspense } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import SiteFooter from '../components/SiteFooter'
import ClientOnly from '../components/ClientOnly'
import PostContent from '../components/PostContent'
import TableOfContents from '../components/TableOfContents'
import { GoodIcon, XLogoIcon } from '../components/SvgIcons'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { useScrollBlur } from '../hooks/useScrollBlur'
import { CMS_ENDPOINT, GOOD_ENDPOINT } from '../lib/endpoints'
import { usePageMeta } from '../hooks/usePageMeta'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'
import { useCodeBlockCopy } from '../hooks/useCodeBlockCopy'
import { useAdminAuth } from '../hooks/useAdminAuth'

// 遅延ロード: エディタは管理者のみ使用
const InlinePostEditor = lazy(() => import('../components/InlinePostEditor'))

type TocItem = { id: string; text: string; level: number }
type Post = { slug?: string; title?: string; summary?: string; html?: string; markdown?: string; createdAt?: string; toc?: TocItem[] }
// tagsはgen-postsで配列化される前提
type TaggedPost = Post & { tags?: string[] }

const staticPosts: TaggedPost[] = Array.isArray(postsData) ? (postsData as TaggedPost[]) : []
const SERVER_APPLY_DELAY_MS = 350

function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  // 静的データから初期値を取得（フォールバック用）
  const staticPost = slug ? staticPosts.find((p) => p.slug === slug) : undefined
  const [post, setPost] = useState<TaggedPost | null>(staticPost ?? null)
  const [isLoading, setIsLoading] = useState(!staticPost)
  const location = useLocation()
  const [goodCount, setGoodCount] = useState<number>(0)
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const [isVoting, setIsVoting] = useState<boolean>(false)
  const proseRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)

  // 編集モード関連
  const { isAdmin, idToken } = useAdminAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [postMarkdown, setPostMarkdown] = useState<string>('')

  // CMS APIから記事データを取得
  useEffect(() => {
    if (!slug) return
    let mounted = true

    const fetchPost = async () => {
      try {
        const res = await fetch(`${CMS_ENDPOINT}/posts/${slug}`)
        if (!res.ok) {
          if (mounted) setIsLoading(false)
          return
        }
        const data = (await res.json()) as { post?: TaggedPost }
        if (!mounted) return
        if (data.post) {
          setPost(data.post)
          // markdownがある場合は保存
          if (data.post.markdown) {
            setPostMarkdown(data.post.markdown)
          }
        }
      } catch {
        // API失敗時は静的データを使用
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    fetchPost()
    return () => {
      mounted = false
    }
  }, [slug])

  useScrollToTop()

  // 即座にreveal要素を表示（遅延なし）
  // postが変更されたときにも再実行
  useReveal(pageRef, post?.slug)

  // proseRefのコールバック（PostContentから受け取る）
  const handleProseRef = useCallback((el: HTMLDivElement | null) => {
    proseRef.current = el
  }, [])

  const siteOrigin = (import.meta.env.VITE_SITE_ORIGIN || 'https://haroin57.com').replace(/\/$/, '')

  const shareUrl = useMemo(() => {
    return `${siteOrigin}${location.pathname}`
  }, [location.pathname, siteOrigin])

  // 記事のメタタグを動的に設定
  const descSource = useMemo(() => {
    if (!post) return ''
    return post.summary
      ? post.summary
      : post.html
        ? post.html.replace(/<[^>]+>/g, '').slice(0, 120) || 'haroin57 web'
        : 'haroin57 web'
  }, [post])

  usePageMeta(
    post
      ? {
          title: `${post.title ?? 'Post'} | haroin57 web`,
          description: descSource,
          ogTitle: post.title ?? 'haroin57 web',
          ogDescription: descSource,
          ogUrl: shareUrl,
          twitterTitle: post.title ?? 'haroin57 web',
          twitterDescription: descSource,
        }
      : {}
  )

  useEffect(() => {
    if (!slug) return
    let mounted = true
    const savedVote = typeof window !== 'undefined' && window.localStorage.getItem(`good-voted-${slug}`) === '1'
    const fetchCount = async () => {
      try {
        const res = await fetch(GOOD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, action: 'get' }),
        })
        if (!res.ok) throw new Error('failed')
        const data = (await res.json()) as { total?: number; voted?: boolean }
        if (!mounted) return
        setGoodCount(typeof data.total === 'number' ? data.total : 0)
        setHasVoted(savedVote || Boolean(data.voted))
        if (!savedVote && data.voted) {
          window.localStorage.setItem(`good-voted-${slug}`, '1')
          if (typeof data.total === 'number') {
            window.localStorage.setItem(`good-count-${slug}`, String(data.total))
          }
        }
      } catch {
        // ignore fetch errors
      }
    }
    fetchCount()
    return () => {
      mounted = false
    }
  }, [slug])

  // コードブロックのコピーボタン機能
  useCodeBlockCopy(proseRef, post?.html)

  // スクロール時の背景ブラーエフェクト（モバイル最適化済み）
  useScrollBlur()

  // 編集モードのハンドラ
  const handleEditSave = useCallback((newMarkdown: string, newHtml: string) => {
    setPostMarkdown(newMarkdown)
    setPost((prev) => prev ? { ...prev, html: newHtml, markdown: newMarkdown } : null)
    setIsEditing(false)
  }, [])

  const handleEditClose = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleGood = useCallback(async () => {
    if (!slug || isVoting) return
    const action = hasVoted ? 'unvote' : 'vote'
    const prevCount = goodCount
    const prevVoted = hasVoted
    const optimistic = action === 'vote' ? prevCount + 1 : Math.max(0, prevCount - 1)

    // 楽観的更新をstartTransitionでラップ
    startTransition(() => {
      setGoodCount(optimistic)
      setHasVoted(!prevVoted)
    })
    setIsVoting(true)

    try {
      const res = await fetch(GOOD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action }),
      })
      const data = (await res.json()) as { total?: number; voted?: boolean }
      if (res.ok) {
        // サーバー応答の適用をわずかに遅らせ、楽観的な表示を維持する
        await new Promise((resolve) => setTimeout(resolve, SERVER_APPLY_DELAY_MS))
        const total = typeof data.total === 'number' ? data.total : optimistic
        const voted = typeof data.voted === 'boolean' ? data.voted : action === 'vote'
        startTransition(() => {
          setGoodCount(total)
          setHasVoted(voted)
        })
        window.localStorage.setItem(`good-count-${slug}`, String(total))
        if (voted) window.localStorage.setItem(`good-voted-${slug}`, '1')
        else window.localStorage.removeItem(`good-voted-${slug}`)
      } else {
        // revert on failure
        startTransition(() => {
          setGoodCount(prevCount)
          setHasVoted(prevVoted)
        })
      }
    } catch {
      // revert on error
      startTransition(() => {
        setGoodCount(prevCount)
        setHasVoted(prevVoted)
      })
    } finally {
      setIsVoting(false)
    }
  }, [slug, isVoting, hasVoted, goodCount])

  return (
    <div ref={pageRef} className="relative">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="mx-auto w-full max-w-2xl space-y-6 relative">
            <header
              className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
              style={MAIN_FONT_STYLE}
            >
              <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                Home
              </PrefetchLink>
              <span className="opacity-50">/</span>
              <PrefetchLink to="/posts" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                Posts
              </PrefetchLink>
            </header>

        {isLoading ? (
          <p className="text-[color:var(--fg,inherit)]">Loading...</p>
        ) : !post ? (
          <p className="text-[color:var(--fg,inherit)]">Post not found.</p>
        ) : (
          <>
            <article className="reveal space-y-4 w-full">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                {post.title}
              </h1>
              {post.createdAt ? (
                <p className="text-sm sm:text-base text-[color:var(--fg,inherit)] opacity-80">
                  {post.createdAt.split('T')[0]}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                {post.tags && post.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-[11px] sm:text-sm">
                    {post.tags.map((tag) => (
                      <PrefetchLink
                        key={tag}
                        to={`/posts?tag=${encodeURIComponent(tag)}`}
                        className="px-2 py-1 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                      >
                        {tag}
                      </PrefetchLink>
                    ))}
                  </div>
                ) : null}
                {/* 管理者のみ編集ボタンを表示 */}
                {isAdmin && postMarkdown && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-xs rounded border border-teal-500/50 bg-teal-500/10 hover:bg-teal-500/20 transition-colors text-teal-400"
                  >
                    編集
                  </button>
                )}
              </div>
              {post.html ? (
                <PostContent html={post.html} onProseRef={handleProseRef} />
              ) : null}
            </article>
            <ClientOnly>
              <section className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={handleGood}
                  disabled={isVoting}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm sm:text-base font-semibold transition border ${
                    hasVoted
                      ? 'border-[color:var(--ui-border-strong)] bg-[color:var(--ui-surface)] hover:bg-[color:var(--ui-surface-hover)]'
                      : 'border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]'
                  }`}
                  style={{ color: 'var(--fg)' }}
                >
                  <GoodIcon className="good-icon h-5 w-5" aria-hidden="true" focusable="false" />
                  <span className="tracking-wide">{`${hasVoted ? 'Good!' : 'Good'} ${goodCount}`}</span>
                </button>
              </section>
            </ClientOnly>
            {shareUrl ? (
              <section className="mt-4 flex justify-center">
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title ?? '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] text-sm sm:text-base"
                  aria-label="Share on X"
                  style={{ color: 'var(--fg)' }}
                >
                  <span>Share on</span>
                  <XLogoIcon className="x-share-icon h-4 w-4" aria-hidden="true" focusable="false" />
                </a>
              </section>
            ) : null}
            <section className="mt-6 flex justify-start">
              <PrefetchLink
                to="/posts"
                className="font-morisawa-dragothic underline-thin hover:text-accent text-base sm:text-lg"
                style={{ color: 'var(--fg)' }}
              >
                ← Posts一覧へ
              </PrefetchLink>
            </section>
          </>
        )}
          </div>
          {post?.html ? <TableOfContents toc={post.toc} html={post.html} /> : null}
        </div>

        <SiteFooter />
      </main>

      {/* 編集モーダル */}
      {isEditing && slug && postMarkdown && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
            <div className="text-white">エディタを読み込み中...</div>
          </div>
        }>
          <InlinePostEditor
            markdown={postMarkdown}
            slug={slug}
            idToken={idToken}
            onSave={handleEditSave}
            onClose={handleEditClose}
          />
        </Suspense>
      )}
    </div>
  )
}

export default PostDetail
