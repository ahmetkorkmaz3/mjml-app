import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FORMATS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export function slugify(name) {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'image'
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch (err) {
    return false
  }
}

async function freeName(dir, base, format, used) {
  let name = `${base}.${format}`
  for (let n = 2; used.has(name) || (await exists(join(dir, name))); n++) {
    name = `${base}-${n}.${format}`
  }
  used.add(name)
  return name
}

// Downloads the images of a design into <project>/images. Figma URLs expire,
// so the template uses these local files. A failed image does not stop the
// import, the result has `ok: false` for it.
export async function downloadAssets({
  assets,
  projectPath,
  fetch = globalThis.fetch,
  signal,
  onProgress = () => {},
}) {
  const results = []
  if (!assets.length) {
    return results
  }

  const dir = join(projectPath, 'images')
  await mkdir(dir, { recursive: true })
  const used = new Set()

  for (const [index, asset] of assets.entries()) {
    onProgress({ step: 'assets', detail: `${index + 1}/${assets.length}` })
    const base = slugify(asset.suggestedName)
    let body = null
    let format = 'png'

    try {
      if (asset.url) {
        const res = await fetch(asset.url, { signal })
        if (res.ok) {
          const type = (res.headers.get('content-type') || '').split(';')[0].trim()
          format = FORMATS[type] || 'png'
          body = Buffer.from(await res.arrayBuffer())
        }
      }
    } catch (err) {
      if (signal && signal.aborted) {
        throw err
      }
    }

    const name = await freeName(dir, base, format, used)
    if (body) {
      await writeFile(join(dir, name), body, { flag: 'wx' })
    }
    results.push({
      id: asset.id,
      url: asset.url,
      name: asset.suggestedName,
      path: `images/${name}`,
      ok: Boolean(body),
      format,
    })
  }

  return results
}
