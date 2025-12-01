// scripts/gen-posts.ts
import fs from 'fs/promises'
import path from 'path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

const POSTS_DIR = path.join(process.cwd(), 'content/posts')
const OUT_PATH = path.join(process.cwd(), 'src/data/posts.json')

async function main() {
  const files = await fg('**/*.md', { cwd: POSTS_DIR })
  const posts = []

  for (const file of files) {
    const full = await fs.readFile(path.join(POSTS_DIR, file), 'utf8')
    const { data, content } = matter(full) // frontmatterが無ければ data は空
    const processed = await remark().use(html).process(content)
    posts.push({
      slug: file.replace(/\.md$/, ''),
      title: data.title || file,
      summary: data.summary || '',
      createdAt: data.date || null,
      html: processed.toString(),
    })
  }

  // ソート（必要なら）
  posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(posts, null, 2), 'utf8')
  console.log(`Generated ${posts.length} posts -> ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
