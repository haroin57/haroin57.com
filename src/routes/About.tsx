import { useRef } from 'react'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

function About() {
  const pageRef = useRef<HTMLDivElement | null>(null)

  usePageMeta({
    title: 'About',
    description: 'haroinについて',
    ogTitle: 'About',
    ogDescription: 'haroinについて',
  })

  useScrollToTop()
  useReveal(pageRef)

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
            </header>

            <h1 className="reveal text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              About
            </h1>

            <section className="reveal space-y-6">
              {/* プロフィール画像 */}
              <div className="flex justify-center">
                <div className="relative h-32 w-32 sm:h-40 sm:w-40 overflow-hidden rounded-full border-2 border-white/20">
                  <img
                    src="/profile.webp"
                    alt="haroin"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* 名前 */}
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-[color:var(--fg-strong)]">
                  haroin
                </h2>
                <p className="mt-1 text-sm sm:text-base opacity-70">
                  Software Developer
                </p>
              </div>

              {/* 自己紹介 */}
              <div className="glass-panel p-4 sm:p-6 space-y-4">
                <p className="text-sm sm:text-base leading-relaxed text-[color:var(--fg)]">
                  長野在住のソフトウェア開発者です。
                  Webフロントエンド・バックエンド開発を中心に、様々な技術に興味を持っています。
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-[color:var(--fg)]">
                  このサイトでは、技術ブログや制作物の紹介、写真などを公開しています。
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-[color:var(--fg)]">
                  趣味でバイクツーリングとDTM、個人開発、写真撮影、読書、映像作品鑑賞を楽しんでいます。
                </p>
              </div>

              {/* 興味・関心 */}
              <div className="space-y-3">
                <h3 className="text-lg sm:text-xl font-semibold text-[color:var(--fg-strong)]">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['React', 'TypeScript', 'Cloudflare', 'Three.js', 'p5.js', 'Photography'].map((interest) => (
                    <span
                      key={interest}
                      className="px-3 py-1 rounded-full border border-white/20 bg-white/5 text-sm text-[color:var(--fg)]"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              {/* リンク */}
              <div className="space-y-3">
                <h3 className="text-lg sm:text-xl font-semibold text-[color:var(--fg-strong)]">
                  Links
                </h3>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://x.com/catnose99"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm sm:text-base text-[color:var(--fg)] opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span>X (Twitter)</span>
                  </a>
                  <a
                    href="https://github.com/haroin57"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm sm:text-base text-[color:var(--fg)] opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    <span>GitHub</span>
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>

        <SiteFooter />
      </main>
    </div>
  )
}

export default About
