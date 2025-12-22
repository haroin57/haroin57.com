import fs from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

type PostMeta = { slug?: string }
type ProductMeta = { slug?: string }

const distDir = path.resolve('dist')
const templatePath = path.join(distDir, 'index.html')
const serverEntryCandidates = ['entry-server.js', 'entry-server.mjs']
let serverEntryPath = ''
for (const filename of serverEntryCandidates) {
  const candidate = path.join(distDir, 'server', filename)
  try {
    await fs.access(candidate)
    serverEntryPath = candidate
    break
  } catch {
    // try next candidate
  }
}

if (!serverEntryPath) {
  throw new Error('SSR entry not found in dist/server')
}

const template = await fs.readFile(templatePath, 'utf8')
const { render } = (await import(pathToFileURL(serverEntryPath).href)) as {
  render: (url: string) => string
}

const routes = new Set<string>(['/', '/home', '/posts', '/products', '/photos'])

const postsPath = path.resolve('src', 'data', 'posts.json')
const posts = JSON.parse(await fs.readFile(postsPath, 'utf8')) as PostMeta[]
for (const post of posts) {
  if (post?.slug) routes.add(`/posts/${post.slug}`)
}

const productsPath = path.resolve('src', 'data', 'products.json')
const products = JSON.parse(await fs.readFile(productsPath, 'utf8')) as ProductMeta[]
for (const product of products) {
  if (product?.slug) routes.add(`/products/${product.slug}`)
}

const rootPattern = /<div id="root"><\/div>/

for (const route of routes) {
  const html = render(route)
  const outputHtml = template.replace(
    rootPattern,
    `<div id="root" data-prerendered="true" data-prerendered-path="${route}">${html}</div>`
  )
  const outputPath =
    route === '/'
      ? path.join(distDir, 'index.html')
      : path.join(distDir, route.replace(/^\//, ''), 'index.html')
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, outputHtml, 'utf8')
}
