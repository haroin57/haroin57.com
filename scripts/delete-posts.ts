/**
 * CMSから指定した記事を削除するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/delete-posts.ts <slug1> <slug2> ...
 */

import '@dotenvx/dotenvx/config'

const ENDPOINT = process.env.CMS_ENDPOINT || 'https://haroin57.com/api/cms'
const ADMIN_SECRET = process.env.ADMIN_SECRET

async function deletePost(slug: string): Promise<{ success: boolean; message: string }> {
  if (!ADMIN_SECRET) {
    return { success: false, message: 'ADMIN_SECRET is required' }
  }

  const url = `${ENDPOINT}/posts/${slug}`

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Admin-Secret': ADMIN_SECRET,
      },
    })

    if (response.ok) {
      return { success: true, message: `Deleted: ${slug}` }
    } else {
      const text = await response.text()
      return { success: false, message: `Failed (${response.status}): ${text}` }
    }
  } catch (error) {
    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function main() {
  const slugs = process.argv.slice(2)

  if (slugs.length === 0) {
    console.log('Usage: npx tsx scripts/delete-posts.ts <slug1> <slug2> ...')
    process.exit(1)
  }

  console.log('=== CMS Post Deletion ===\n')

  for (const slug of slugs) {
    console.log(`Deleting: ${slug}`)
    const result = await deletePost(slug)
    console.log(`  ${result.success ? '✓' : '✗'} ${result.message}`)
  }

  console.log('\nDone.')
}

main()
