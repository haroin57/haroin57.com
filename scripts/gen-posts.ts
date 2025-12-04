// scripts/gen-posts.ts
import fs from 'fs/promises'
import path from 'path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import { remark } from 'remark'
import breaks from 'remark-breaks'
import codeTitles from 'remark-code-titles'
import remarkGfm from 'remark-gfm'
import remarkSlug from 'remark-slug'
import remarkToc from 'remark-toc'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'

const POSTS_DIR = path.join(process.cwd(), 'content/posts')
const OUT_PATH = path.join(process.cwd(), 'src/data/posts.json')

async function main() {
  const files = await fg('**/*.md', { cwd: POSTS_DIR })
  const posts = []

  const cardifyLinks = () => {
    return (tree: any) => {
      visit(tree, 'element', (node: any, index: number | null, parent: any) => {
        if (!parent || parent.tagName !== 'p' || index === null) return
        const children = parent.children || []
        if (
          children.length === 1 &&
          children[0].type === 'element' &&
          children[0].tagName === 'a' &&
          children[0].properties?.href
        ) {
          parent.tagName = 'div'
          parent.properties = {
            ...(parent.properties || {}),
            className: ['link-card'],
          }
        }
      })
    }
  }

  const injectToc = () => {
    return (tree: any) => {
      const headings: { depth: number; text: string; id?: string }[] = []
      visit(tree, 'heading', (node: any) => {
        const text = toString(node).trim()
        // 目次見出しそのものは除外
        if (text === '目次') return
        if (node.depth >= 2 && node.depth <= 4) {
          headings.push({ depth: node.depth, text, id: node.data?.id })
        }
      })

      const tocIndex = tree.children.findIndex(
        (n: any) => n.type === 'heading' && toString(n).trim() === '目次'
      )
      if (tocIndex === -1 || headings.length === 0) return

      const list = {
        type: 'list',
        ordered: false,
        spread: false,
        children: headings.map((h) => ({
          type: 'listItem',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: h.id ? `#${h.id}` : '#',
                  children: [{ type: 'text', value: h.text }],
                },
              ],
            },
          ],
        })),
        data: {
          hName: 'div',
          hProperties: { className: ['toc-box'] },
        },
      }

      tree.children.splice(tocIndex + 1, 0, list)
    }
  }

  for (const file of files) {
    const full = await fs.readFile(path.join(POSTS_DIR, file), 'utf8')
    const { data, content } = matter(full) // frontmatterが無ければ data は空
    // HTMLブロックを許可しつつ、改行とコードタイトル、シンタックスハイライトを適用
    const processed = await remark()
      .use(breaks)
      .use(codeTitles)
      .use(remarkGfm)
      .use(remarkSlug)
      .use(remarkMath)
      .use(injectToc)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeKatex)
      .use(rehypePrettyCode, {
        defaultLang: 'plaintext',
        keepBackground: false,
        showLineNumbers: true,
      })
      .use(rehypeRaw) // 既存のHTMLを通す
      .use(cardifyLinks)
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
