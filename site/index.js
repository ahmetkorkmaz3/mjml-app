import './style.scss'

const REPO = 'ahmetkorkmaz3/mjml-app'
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`

// the file names of electron-builder.yml: mjml-app-<version>-<os>-<arch>.<ext>
const ASSETS = {
  'mac-arm64': /-mac-arm64\.dmg$/,
  'mac-x64': /-mac-x64\.dmg$/,
  'win-exe': /-win-x64\.exe$/,
  'win-zip': /-win-x64\.zip$/,
  'linux-appimage': /\.AppImage$/,
  'linux-tar': /-linux-x64\.tar\.gz$/,
}

const OS_LABELS = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }
const PRIMARY_ASSET = { mac: 'mac-arm64', windows: 'win-exe', linux: 'linux-appimage' }

function detectOS() {
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|android/.test(ua)) return null
  if (platform.includes('mac') || ua.includes('mac os')) return 'mac'
  if (platform.includes('win') || ua.includes('windows')) return 'windows'
  if (platform.includes('linux') || ua.includes('linux')) return 'linux'
  return null
}

// Chromium gives the architecture. Safari and Firefox do not, so a Mac gets the Apple silicon file.
async function detectMacArch() {
  try {
    const { architecture } = await navigator.userAgentData.getHighEntropyValues(['architecture'])
    return architecture === 'x86' ? 'mac-x64' : 'mac-arm64'
  } catch {
    return 'mac-arm64'
  }
}

async function fetchRelease() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function findAssetUrls(release) {
  const urls = {}
  for (const [key, pattern] of Object.entries(ASSETS)) {
    const asset = release.assets.find(a => pattern.test(a.name))
    if (asset) urls[key] = asset.browser_download_url
  }
  return urls
}

async function setupDownloads() {
  const os = detectOS()
  const heroButton = document.getElementById('hero-download')
  const heroLabel = document.getElementById('hero-download-label')
  const heroNote = document.getElementById('hero-note')

  if (os) {
    heroLabel.textContent = `Download for ${OS_LABELS[os]}`
    document.querySelector(`.dl[data-os="${os}"]`)?.classList.add('current')
  }

  const release = await fetchRelease()
  if (!release) return

  const version = release.tag_name.replace(/^v/, '')
  for (const el of document.querySelectorAll('[data-version]')) {
    el.textContent = el.closest('.eyebrow') ? `Version ${version}` : version
  }

  const urls = findAssetUrls(release)
  for (const link of document.querySelectorAll('[data-asset]')) {
    link.href = urls[link.dataset.asset] || RELEASES_URL
  }

  if (!os) return
  const primary = os === 'mac' ? await detectMacArch() : PRIMARY_ASSET[os]
  if (!urls[primary]) return
  heroButton.href = urls[primary]
  heroNote.innerHTML = `Version ${version} · <a href="#download">Other platforms</a>`
  if (os === 'mac') {
    heroLabel.textContent = `Download for ${primary === 'mac-x64' ? 'Intel Mac' : 'Apple silicon'}`
  }
}

function setupCopyButtons() {
  for (const button of document.querySelectorAll('[data-copy]')) {
    button.addEventListener('click', async () => {
      const text = document.getElementById(button.dataset.copy).textContent
      try {
        await navigator.clipboard.writeText(text)
        button.textContent = 'Copied'
      } catch {
        button.textContent = 'Error'
      }
      setTimeout(() => (button.textContent = 'Copy'), 1500)
    })
  }
}

function setupReveal() {
  const elements = document.querySelectorAll('.reveal')
  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('visible'))
    return
  }
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('visible')
        observer.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -60px 0px' },
  )
  elements.forEach(el => observer.observe(el))
}

setupReveal()
setupCopyButtons()
setupDownloads()
