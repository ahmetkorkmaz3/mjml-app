import { Component } from 'react'

import api from 'helpers/api'

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

      if (base) {
        const images = [...documentElement.querySelectorAll('img')]
        images.forEach(img => {
          const imgSrc = img.getAttribute('src')
          if (imgSrc && !/^(https?:|data:|file:|\/\/)/.test(imgSrc)) {
            img.setAttribute('src', `file://${base}/${imgSrc}`)
          }
        })
      }
    })
  }

  render() {
    const { scrolling } = this.props

    return (
      <iframe
        tabIndex={-1}
        scrolling={scrolling ? undefined : 'no'}
        ref={n => (this._iframe = n)}
      />
    )
  }
}

export default Iframe
