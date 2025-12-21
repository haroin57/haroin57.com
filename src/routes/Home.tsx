import { useEffect, useRef, useState } from 'react'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import postsData from '../data/posts.json' with { type: 'json' }
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { CMS_ENDPOINT } from '../lib/endpoints'
import { MAIN_TEXT_STYLE } from '../styles/typography'

type Interest = { title: string; text: string }
type PostMeta = { slug?: string; title?: string; createdAt?: string }

const interests: Interest[] = [
  { title: 'Go, Java, Typescript', text: 'Distributed computing, microservices, and Web development.' },
  { title: 'Frameworks', text: 'React, Next.js, Tailwind CSS' },
  { title: 'Linux', text: 'Virtual machines, shell scripting' },
  { title: 'Desktop music', text: 'Creating music using digital audio workstations.' },
  { title: 'Bike touring', text: 'Exploring new places and enjoying nature on two wheels.' },
  { title: 'PaaS', text: 'Cloudflare, Vercel, AWS' },
]

// 静的データからの初期表示用
const staticPosts: PostMeta[] = Array.isArray(postsData) ? (postsData as PostMeta[]) : []
const initialLatestPosts: PostMeta[] = [...staticPosts]
  .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  .slice(0, 5)

function Home() {
  const [openInterests, setOpenInterests] = useState(false)
  const [latestPosts, setLatestPosts] = useState<PostMeta[]>(initialLatestPosts)
  const pageRef = useRef<HTMLDivElement | null>(null)

  // ホームページはデフォルトのメタタグを使用
  usePageMeta()

  useScrollToTop()

  // CMS APIから最新記事を取得（下書きに戻した記事は除外される）
  useEffect(() => {
    const fetchLatestPosts = async () => {
      try {
        const res = await fetch(`${CMS_ENDPOINT}/posts`)
        if (res.ok) {
          const data = (await res.json()) as { posts: PostMeta[] }
          if (data.posts && data.posts.length > 0) {
            const sorted = [...data.posts]
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
              .slice(0, 5)
            setLatestPosts(sorted)
          }
        }
      } catch {
        // API失敗時は静的データを使用
      }
    }
    fetchLatestPosts()
  }, [])

  // 即座にreveal要素を表示（遅延なし）
  // latestPostsが変更されたときにも再実行
  useReveal(pageRef, [latestPosts])

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="mx-auto w-full max-w-2xl">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                Contents
              </h1>

              <ul className="posts-divider mt-6">
                <li className="space-y-4 py-6">
                  <section className="space-y-4">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setOpenInterests((v) => !v)}
                        aria-expanded={openInterests}
                        className="reveal group relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded-md border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-xl"
                        style={{ color: 'var(--fg)' }}
                      >
                        <div className="translate-y-0 opacity-100 transition duration-500 ease-in-out md:group-hover:-translate-y-[150%] md:group-hover:opacity-0">
                          Interests
                        </div>
                        <div className="absolute translate-y-full opacity-0 transition duration-500 ease-in-out md:translate-y-[150%] md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 transition-transform duration-300"
                            style={{ transform: openInterests ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          >
                            <path
                              d="M7.5 2C7.77614 2 8 2.22386 8 2.5L8 11.2929L11.1464 8.14645C11.3417 7.95118 11.6583 7.95118 11.8536 8.14645C12.0488 8.34171 12.0488 8.65829 11.8536 8.85355L7.85355 12.8536C7.75979 12.9473 7.63261 13 7.5 13C7.36739 13 7.24021 12.9473 7.14645 12.8536L3.14645 8.85355C2.95118 8.65829 2.95118 8.34171 3.14645 8.14645C3.34171 7.95118 3.65829 7.95118 3.85355 8.14645L7 11.2929L7 2.5C7 2.22386 7.22386 2 7.5 2Z"
                              fill="currentColor"
                              fillRule="evenodd"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </button>
                    </div>
                    <div className={`glass-panel collapse ${openInterests ? 'open' : 'closed'}`}>
                      <div className="p-4 sm:p-6">
                        <ul className="list-disc space-y-4 pl-5 text-base sm:text-lg">
                          {interests.map((item) => (
                            <li key={item.title}>
                              <div className="text-lg sm:text-xl font-medium">{item.title}</div>
                              <div className="mt-1 text-sm sm:text-base opacity-90">{item.text}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </li>

                <li className="space-y-3 py-6">
                  <section className="space-y-3">
                    <div className="flex items-center">
                      <PrefetchLink
                        to="/posts"
                        className="reveal relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2.5 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-xl"
                        style={{ color: 'var(--fg)' }}
                      >
                        <span className="relative">Posts (ja)</span>
                      </PrefetchLink>
                    </div>
                    <div className="reveal px-1 text-base sm:text-xl font-medium text-[color:var(--fg-strong)]">
                      Latest Posts
                    </div>
                    <div className="reveal glass-panel">
                      <div className="p-4 sm:p-6">
                        <ul className="list-disc space-y-3 pl-5 text-base sm:text-lg font-vdl-logomaru">
                          {latestPosts.map((post, idx) => (
                            <li
                              key={post.slug ?? post.title ?? idx}
                              className="reveal"
                            >
                              <PrefetchLink
                                to={post.slug ? `/posts/${post.slug}` : '/posts'}
                                className="text-base sm:text-lg underline-thin hover:text-accent"
                                style={{ color: 'var(--fg)' }}
                              >
                                {post.title ?? 'Untitled'}
                              </PrefetchLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </li>

                <li className="space-y-3 py-6">
                  <section className="space-y-3">
                    <div className="flex items-center">
                      <PrefetchLink
                        to="/products"
                        className="reveal relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2.5 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-xl"
                        style={{ color: 'var(--fg)' }}
                      >
                        <span className="relative">Products</span>
                      </PrefetchLink>
                    </div>
                    <p className="reveal text-base sm:text-xl opacity-80 px-1">
                      Personal projects and open source works.
                    </p>
                  </section>
                </li>

                <li className="space-y-3 py-6">
                  <section className="space-y-3">
                    <div className="flex items-center">
                      <PrefetchLink
                        to="/photos"
                        className="reveal relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2.5 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-xl"
                        style={{ color: 'var(--fg)' }}
                      >
                        <span className="relative">Photos</span>
                      </PrefetchLink>
                    </div>
                    <p className="reveal text-base sm:text-xl opacity-80 px-1">
                      Shots from rides and late walks.
                    </p>
                  </section>
                </li>

                <li className="space-y-3 py-6">
                  <section className="space-y-3">
                    <div className="flex items-center">
                      <PrefetchLink
                        to="/bbs"
                        className="reveal relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2.5 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-xl"
                        style={{ color: 'var(--fg)' }}
                      >
                        <span className="relative">BBS</span>
                      </PrefetchLink>
                    </div>
                    <p className="reveal text-base sm:text-xl opacity-80 px-1">
                      自由に書き込める掲示板です。
                    </p>
                  </section>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <SiteFooter />
      </main>
    </div>
  )
}

export default Home
