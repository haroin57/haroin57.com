import fg from 'fast-glob'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function writeWebpVariant(inputPath, outputPath, { width, height, fit, quality }) {
  await ensureDir(path.dirname(outputPath))
  const pipeline = sharp(inputPath).rotate()
  const resized =
    typeof width === 'number' || typeof height === 'number'
      ? pipeline.resize({
          width,
          height,
          fit: fit ?? 'inside',
          withoutEnlargement: true,
        })
      : pipeline

  await resized.webp({ quality }).toFile(outputPath)
}

async function generateAvatar() {
  const inputPath = path.join(PUBLIC_DIR, 'profile.webp')
  if (!(await exists(inputPath))) return

  const sizes = [320, 480]
  for (const size of sizes) {
    const outputPath = path.join(PUBLIC_DIR, `profile-${size}.webp`)
    await writeWebpVariant(inputPath, outputPath, { width: size, height: size, fit: 'cover', quality: 80 })
    console.log(`generated ${path.relative(process.cwd(), outputPath)}`)
  }
}

async function generateBackgroundStrip() {
  const inputPath = path.join(PUBLIC_DIR, 'background-strip.webp')
  if (!(await exists(inputPath))) return

  const widths = [1280, 2560]
  for (const width of widths) {
    const outputPath = path.join(PUBLIC_DIR, `background-strip-${width}.webp`)
    await writeWebpVariant(inputPath, outputPath, { width, quality: 70 })
    console.log(`generated ${path.relative(process.cwd(), outputPath)}`)
  }
}

async function generatePhotoVariants() {
  const files = await fg('Photo/*.webp', { cwd: PUBLIC_DIR })
  const widths = [640, 1280, 1920]

  for (const rel of files) {
    const inputPath = path.join(PUBLIC_DIR, rel)
    const ext = path.extname(rel)
    const base = rel.slice(0, -ext.length)

    for (const width of widths) {
      const outputRel = `${base}-${width}${ext}`
      const outputPath = path.join(PUBLIC_DIR, outputRel)
      await writeWebpVariant(inputPath, outputPath, { width, quality: 75 })
      console.log(`generated ${path.relative(process.cwd(), outputPath)}`)
    }
  }
}

await generateAvatar()
await generateBackgroundStrip()
await generatePhotoVariants()
