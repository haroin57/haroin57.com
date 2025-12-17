import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

async function convert(filename) {
  const input = join(publicDir, filename)
  const output = join(publicDir, filename.replace(/\.(png|jpg|jpeg)$/i, '.webp'))

  console.log(`Converting ${filename}...`)
  await sharp(input)
    .webp({ quality: 85 })
    .toFile(output)
  console.log(`Created ${output}`)
}

await convert('profile.png')
await convert('background.png')
console.log('Done!')
