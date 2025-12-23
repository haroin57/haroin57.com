import { useState, useRef } from 'react'
import Lightbox from '../components/Lightbox'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import { photos, type Photo } from '../data/photos'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

// Components
function PhotoCard({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-block w-full overflow-hidden rounded-lg border border-white/10 bg-black/20 text-left transition-all hover:border-white/20 hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/20 break-inside-avoid"
    >
      <div className="relative overflow-hidden">
        <img
          src={photo.src}
          alt={photo.title}
          className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="inline-block text-base font-medium text-white px-2 py-0.5 rounded bg-black/30 backdrop-blur-sm">
            {photo.title}
          </h3>
        </div>
      </div>
    </button>
  )
}

function PhotoDetails({ photo }: { photo: Photo }) {
  return (
    <div>
      <h2 className="text-lg sm:text-xl font-medium text-white">
        {photo.title}
      </h2>
    </div>
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
          <div className="mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              Photos
            </h1>
          </div>

          {/* Photo grid */}
          <div className="glass-panel">
            <div className="p-4 sm:p-6">
              {photos.length === 0 ? (
                <p className="text-center text-[color:var(--fg)] opacity-70 py-8">
                  写真はまだありません
                </p>
              ) : (
                <div className="columns-1 sm:columns-2 gap-4 [&>*]:mb-4">
                  {photos.map((photo) => (
                    <PhotoCard
                      key={photo.title}
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
