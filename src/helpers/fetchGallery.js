import values from 'lodash/values'

const githubTemplatesRoot = 'https://raw.githubusercontent.com/mjmlio/email-templates/master'

// the gallery loads once for the session: the GitHub API allows 60 requests an hour without a token
let cache = null

export default function fetchGallery() {
  if (!cache) {
    cache = loadGallery().catch(err => {
      // the next call tries again
      cache = null
      throw err
    })
  }
  return cache
}

async function loadGallery() {
  let res
  try {
    res = await fetch(
      'https://api.github.com/repos/mjmlio/email-templates/git/trees/master?recursive=1',
    )
  } catch (err) {
    throw new Error('Could not connect to GitHub. Check your internet connection.', { cause: err })
  }
  if (!res.ok) {
    if (
      (res.status === 403 || res.status === 429) &&
      res.headers.get('x-ratelimit-remaining') === '0'
    ) {
      throw new Error('GitHub limits the number of requests. Try again in a few minutes.')
    }
    throw new Error(`GitHub answered with the status ${res.status}.`)
  }
  const { tree } = await res.json()
  if (!Array.isArray(tree)) {
    throw new Error('GitHub sent a list of templates that is not valid.')
  }
  const imagesToLoad = []
  const map = tree.reduce((map, item) => {
    const { path } = item

    if (!path.startsWith('templates/') && !path.startsWith('thumbnails/')) {
      return map
    }

    const extract = /.*\/([^.]*)\..*/.exec(path)
    if (!extract) {
      return map
    }

    const templateName = extract[1]
    const isMJML = path.endsWith('.mjml')

    if (!map[templateName]) {
      map[templateName] = {}
    }

    const fullPath = `${githubTemplatesRoot}/${path}`

    if (isMJML) {
      map[templateName].mjml = fullPath
      map[templateName].name = templateName
    } else {
      imagesToLoad.push(fullPath)
      map[templateName].thumbnail = fullPath
    }

    return map
  }, {})

  await Promise.all(imagesToLoad.map(loadImage))

  return values(map)
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = resolve
    img.onerror = resolve
    img.src = src
  })
}
