import { useState, useRef } from 'react'
import Lightbox from '../components/Lightbox'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import { photos, shotTags, type Photo, type PhotoRatio } from '../data/photos'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

// Constants
const RATIO_CLASS_MAP: Record<PhotoRatio, string> = {
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
  square: 'aspect-square',
}

// Components
function PhotoCard({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/20 text-left transition-all hover:border-white/20 hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/20"
    >
      <div className={`relative ${RATIO_CLASS_MAP[photo.ratio]} overflow-hidden`}>
        <img
          src={photo.src}
          alt={photo.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span
          className="absolute left-3 top-3 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: photo.tone }}
        />
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between text-xs opacity-60">
          <span>{photo.location}</span>
          <span>{photo.date}</span>
        </div>
        <h3 className="text-base font-medium text-[color:var(--fg-strong)]">
          {photo.title}
        </h3>
        <p className="text-xs opacity-70 line-clamp-2">{photo.note}</p>
      </div>
    </button>
  )
}

function PhotoDetails({ photo }: { photo: Photo }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: photo.tone }}
        />
        <h2 className="text-lg sm:text-xl font-medium text-white">
          {photo.title}
        </h2>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
        <span>{photo.location}</span>
        <span>{photo.date}</span>
      </div>
      <p className="text-sm text-white/80">{photo.note}</p>
      <div className="flex flex-wrap gap-2 pt-2">
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/70">
          {photo.camera}
        </span>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/70">
          {photo.lens}
        </span>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/70">
          {photo.exposure}
        </span>
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-wide">
      {children}
    </span>
  )
}

// Main component
function Photos() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)

  // Photosページのメタタグ
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
        className="relative z-10 mx-auto min-h-screen max-w-4xl px-4 pt-16 pb-10 space-y-6 page-fade sm:px-6 sm:pt-20 sm:pb-12"
        style={MAIN_TEXT_STYLE}
      >
        <header
          className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
          style={MAIN_FONT_STYLE}
        >
          <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </PrefetchLink>
        </header>

        <article className="reveal space-y-4 w-full">
          <div className="space-y-4 mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              Photos
            </h1>
            {shotTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {shotTags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            )}
          </div>

          {/* Photo grid */}
          <div className="glass-panel">
            <div className="p-4 sm:p-6">
              {photos.length === 0 ? (
                <p className="text-center text-[color:var(--fg)] opacity-70 py-8">
                  写真はまだありません
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {photos.map((photo) => (
                    <PhotoCard
                      key={`${photo.title}-${photo.date}`}
                      photo={photo}
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

        </article>
      </main>

      <SiteFooter />

      {/* Lightbox */}
      <Lightbox
        isOpen={selectedPhoto !== null}
        onClose={() => setSelectedPhoto(null)}
        imageSrc={selectedPhoto?.src ?? ''}
        imageAlt={selectedPhoto?.title ?? ''}
      >
        {selectedPhoto && <PhotoDetails photo={selectedPhoto} />}
      </Lightbox>
    </div>
  )
}

export default Photos
