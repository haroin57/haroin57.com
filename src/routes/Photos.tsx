import { useState, useRef } from 'react'
import Lightbox from '../components/Lightbox'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import { photos, type Photo } from '../data/photos'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

const buildSrcSet = (src: string): string => {
  const base = src.replace(/\.webp$/i, '')
  return [
    `${base}-640.webp 640w`,
    `${base}-1280.webp 1280w`,
    `${base}-1920.webp 1920w`,
  ].join(', ')
}

const buildVariantSrc = (src: string, width: number): string => src.replace(/\.webp$/i, `-${width}.webp`)

function Photos() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)

  usePageMeta({
    title: 'Photos | haroin57 web',
    description: 'ライドや散歩で撮った写真',
    ogTitle: 'Photos | haroin57 web',
    ogDescription: 'ライドや散歩で撮った写真',
  })

  useScrollToTop()
  useReveal(pageRef)

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
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
              Photos
            </h1>

            {photos.length === 0 ? (
              <div className="reveal py-8 text-center opacity-70">写真はまだありません</div>
            ) : (
              <ul className="reveal font-vdl-logomaru posts-divider">
                {photos.map((photo) => (
                  <li key={photo.title} className="space-y-3 py-6 group">
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto(photo)}
                      className="w-full text-left focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg overflow-hidden"
                    >
                      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/20 transition-all group-hover:border-white/20">
                        <img
                          src={buildVariantSrc(photo.src, 1280)}
                          srcSet={buildSrcSet(photo.src)}
                          sizes="(max-width: 672px) 100vw, 672px"
                          width={photo.width}
                          height={photo.height}
                          alt={photo.title}
                          className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </button>
                    <h2 className="text-lg sm:text-xl text-[color:var(--fg-strong,inherit)]">
                      {photo.title}
                    </h2>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <SiteFooter />
      </main>

      {/* Lightbox */}
      <Lightbox
        isOpen={selectedPhoto !== null}
        onClose={() => setSelectedPhoto(null)}
        imageSrc={selectedPhoto ? buildVariantSrc(selectedPhoto.src, 1920) : ''}
        imageSrcSet={selectedPhoto ? buildSrcSet(selectedPhoto.src) : undefined}
        imageSizes="(max-width: 896px) 100vw, 896px"
        imageWidth={selectedPhoto?.width}
        imageHeight={selectedPhoto?.height}
        imageAlt={selectedPhoto?.title ?? ''}
      >
        {selectedPhoto && (
          <div>
            <h2 className="text-lg sm:text-xl font-medium text-white">
              {selectedPhoto.title}
            </h2>
          </div>
        )}
      </Lightbox>
    </div>
  )
}

export default Photos
