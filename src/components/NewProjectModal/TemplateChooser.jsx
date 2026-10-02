import { Component } from 'react'
import cx from 'classnames'
import { Collapse } from 'react-collapse'

import {
  MdAutorenew as IconChecking,
  MdNote as IconSimple,
  MdViewDay as IconSeparated,
} from 'react-icons/md'

import fetchGallery from 'helpers/fetchGallery'

import Button from 'components/Button'
import Tabbable from 'components/Tabbable'

class TemplateChooser extends Component {
  state = {
    // can be basic | gallery
    source: 'basic',

    isFetching: false,
    // the message of the last error, or null
    error: null,
    gallery: [],
  }

  componentWillUnmount() {
    this._unmounted = true
  }

  handleChangeSource = async source => {
    this.setState({ source })
    if (source === 'gallery') {
      this.loadGallery()
    } else {
      this.props.onSelect('singleBasic')
    }
  }

  loadGallery = async () => {
    if (this.state.isFetching) {
      return
    }
    this.setState({ isFetching: true, error: null })

    try {
      const gallery = await fetchGallery()
      if (this._unmounted) return
      this.setState({ isFetching: false, gallery })
      if (this.state.source === 'gallery') {
        this.handleSelectGalleryTemplate(0)
      }
    } catch (err) {
      if (this._unmounted) return
      this.setState({ isFetching: false, error: err.message || 'Could not load the gallery.' })
    }
  }

  handleSelectGalleryTemplate = i => {
    this.props.onSelect(this.state.gallery[i])
  }

  render() {
    const { template, onSelect } = this.props

    const { source, isFetching, error, gallery } = this.state

    return (
      <div className="flow-v-20">
        <div className="d-f TemplateChooserTabs">
          <Tabbable
            onClick={() => this.handleChangeSource('basic')}
            className={cx('TemplateChooserTabs--tab f-1 cu-d', {
              isActive: source === 'basic',
            })}
          >
            {'Basic'}
          </Tabbable>
          <Tabbable
            onClick={() => this.handleChangeSource('gallery')}
            className={cx('TemplateChooserTabs--tab f-1 cu-d', {
              isActive: source === 'gallery',
            })}
          >
            {'Gallery'}
          </Tabbable>
        </div>

        <Collapse isOpened>
          {source === 'basic' ? (
            <div className="d-f">
              <TabItem
                onClick={() => onSelect('singleBasic')}
                isSelected={template === 'singleBasic'}
                label="Single file, basic layout"
              >
                <IconSimple size={80} />
              </TabItem>

              <TabItem
                onClick={() => onSelect('headerFooter')}
                isSelected={template === 'headerFooter'}
                label="Header & Footer"
              >
                <IconSeparated size={80} />
              </TabItem>
            </div>
          ) : source === 'gallery' ? (
            <div>
              {isFetching ? (
                <div className="z" style={{ height: 250 }}>
                  <IconChecking className="rotating mb-20" size={30} />
                  {'Fetching templates...'}
                </div>
              ) : error ? (
                <div className="z flow-v-10" style={{ height: 250 }}>
                  <div>{`Could not load the gallery. ${error}`}</div>
                  <Button variant="secondary" onClick={this.loadGallery}>
                    {'Retry'}
                  </Button>
                </div>
              ) : (
                <div className="r" style={{ height: 450 }}>
                  <div className="sticky o-y-a Gallery">
                    {gallery.map((tpl, i) => (
                      <Tabbable
                        key={tpl.name}
                        onClick={() => this.handleSelectGalleryTemplate(i)}
                        className={cx('Gallery-Item-wrapper', {
                          isSelected: template.name === tpl.name,
                        })}
                      >
                        <div
                          className="Gallery-Item"
                          style={{
                            backgroundImage: `url(${tpl.thumbnail})`,
                          }}
                        >
                          <div className="Gallery-item-label small">{tpl.name}</div>
                        </div>
                      </Tabbable>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Collapse>
      </div>
    )
  }
}

function TabItem({ onClick, isSelected, thumbnail, children, label }) {
  return (
    <Tabbable
      onClick={onClick}
      className={cx('Gallery-Item-wrapper', {
        isSelected,
      })}
    >
      <div
        className="Gallery-Item"
        style={{
          backgroundImage: thumbnail ? `url(${thumbnail})` : undefined,
        }}
      >
        {children}
        <div className="Gallery-item-label small">{label}</div>
      </div>
    </Tabbable>
  )
}

export default TemplateChooser
