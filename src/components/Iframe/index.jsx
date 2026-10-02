import { Component } from 'react'

import api from 'helpers/api'
import { resolveFileURL, rewriteCssUrls } from 'helpers/file-url'

class Iframe extends Component {
  static defaultProps = {
    scrolling: true,
    openLinks: false,
    value: '',
    base: '',
  }

  componentDidMount() {
    this.setIframeContent(this.props.value)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.setIframeContent(this.props.value)
    }
  }

  setIframeContent = value => {
    const { openLinks, base } = this.props

    window.requestAnimationFrame(() => {
      if (!this._iframe) {
        return
      }
      const doc = this._iframe.contentDocument
      const { documentElement } = doc
      documentElement.innerHTML = value

      if (openLinks) {
        const links = [...documentElement.querySelectorAll('a')]
        links.forEach(link => {
          link.addEventListener('click', e => {
            e.preventDefault()
            const href = link.getAttribute('href')
            if (href) {
              api.shell.openExternal(href)
            }
          })
        })
      }

      // the relative paths of the local files are relative to the folder
      if (base) {
        documentElement.querySelectorAll('img[src]').forEach(img => {
          const url = resolveFileURL(base, img.getAttribute('src'))
          if (url) img.setAttribute('src', url)
        })
        documentElement.querySelectorAll('[background]').forEach(node => {
          const url = resolveFileURL(base, node.getAttribute('background'))
          if (url) node.setAttribute('background', url)
        })
        documentElement.querySelectorAll('[style*="url("]').forEach(node => {
          const style = node.getAttribute('style')
          const rewritten = rewriteCssUrls(style, base)
          if (rewritten !== style) node.setAttribute('style', rewritten)
        })
      }
    })
  }

  render() {
    const { scrolling } = this.props

    return (
      <iframe
        // no allow-scripts: the email HTML (inline handlers included) must not
        // run code, it could reach window.parent.api. allow-same-origin lets
        // this component write the document and handle the link clicks.
        sandbox="allow-same-origin"
        tabIndex={-1}
        scrolling={scrolling ? undefined : 'no'}
        ref={n => (this._iframe = n)}
      />
    )
  }
}

export default Iframe
