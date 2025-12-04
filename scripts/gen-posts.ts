// scripts/gen-posts.ts
import fs from 'fs/promises'
import path from 'path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import { remark } from 'remark'
import breaks from 'remark-breaks'
import codeTitles from 'remark-code-titles'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'

const POSTS_DIR = path.join(process.cwd(), 'content/posts')
const OUT_PATH = path.join(process.cwd(), 'src/data/posts.json')

async function main() {
  const files = await fg('**/*.md', { cwd: POSTS_DIR })
  const posts = []

  for (const file of files) {
    const full = await fs.readFile(path.join(POSTS_DIR, file), 'utf8')
    const { data, content } = matter(full) // frontmatterが無ければ data は空
    // HTMLブロックを許可しつつ、改行とコードタイトル、シンタックスハイライトを適用
    const processed = await remark()
      .use(breaks)
      .use(codeTitles)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw) // 既存のHTMLを通す
      .use(rehypeHighlight)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(content)

    const tags =
      Array.isArray(data.tags) && data.tags.length > 0
        ? data.tags.map((t: unknown) => String(t))
        : typeof data.tags === 'string'
          ? data.tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : []

    posts.push({
      slug: file.replace(/\.md$/, ''),
      title: data.title || file,
      summary: data.summary || '',
      createdAt: data.date || null,
      tags,
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
