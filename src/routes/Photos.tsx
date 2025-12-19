import { useState } from 'react'
import PageLayout from '../components/PageLayout'
import Lightbox from '../components/Lightbox'
import photosData from '../data/photos.json' with { type: 'json' }

// Types
type PhotoRatio = 'portrait' | 'landscape' | 'square'

type Photo = {
  src: string
  title: string
  location: string
  date: string
  camera: string
  lens: string
  exposure: string
  note: string
  ratio: PhotoRatio
  tone: string
}

// Constants
const SHOT_TAGS: string[] = []

const RATIO_CLASS_MAP: Record<PhotoRatio, string> = {
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
  square: 'aspect-square',
}

// Data
const photos: Photo[] = photosData as Photo[]

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

  return (
    <PageLayout>
      {/* Header */}
      <header className="space-y-4 mb-8">
        <h1 className="reveal text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
          Photos
        </h1>
                {SHOT_TAGS.length > 0 && (
          <div className="reveal flex flex-wrap gap-2">
            {SHOT_TAGS.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </header>

      {/* Photo grid */}
      <div className="reveal glass-panel">
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

      {/* Lightbox */}
      <Lightbox
        isOpen={selectedPhoto !== null}
        onClose={() => setSelectedPhoto(null)}
        imageSrc={selectedPhoto?.src ?? ''}
        imageAlt={selectedPhoto?.title ?? ''}
      >
        {selectedPhoto && <PhotoDetails photo={selectedPhoto} />}
      </Lightbox>
    </PageLayout>
  )
}

export default Photos
