import { Component } from 'react'
import cx from 'classnames'
import { connect } from 'react-redux'
import isEqual from 'lodash/isEqual'
import find from 'lodash/find'

import Iframe from 'components/Iframe'

import { updateSettings } from 'actions/settings'
import { addAlert } from 'reducers/alerts'
import { compile } from 'helpers/preview-content'
import { pathToFileURL } from 'helpers/file-url'

export default connect(
  state => ({
    preview: state.preview,
    previewSize: state.settings.get('previewSize'),
    templating: state.settings.get('templating'),
  }),
  {
    updateSettings,
    addAlert,
  },
)(
  class FilePreview extends Component {
    state = {
      content: '',
    }

    // the number of the last compile: an older result that ends later is dropped
    _compileId = 0

    // the last error shown, so the same error does not show on each keystroke
    _lastError = null

    componentDidMount() {
      // the preview can exist before this component (the preview was hidden)
      if (this.props.preview) {
        this.updateContent(this.getParams(this.props))
      }
    }

    componentDidUpdate(prevProps) {
      const current = this.getParams(this.props)
      !isEqual(this.getParams(prevProps), current) && this.updateContent(current)
    }

    getParams = props => {
      const { engine, variables } = this.getProjectVariables(props)
      return { engine, variables, raw: props.preview ? props.preview.content : '' }
    }

    getProjectVariables = props => {
      const { templating, iframeBase } = props
      return find(templating, { projectPath: iframeBase }) || {}
    }

    updateContent = async params => {
      const id = ++this._compileId
      try {
        const content = await compile(params)
        if (id !== this._compileId) {
          return
        }
        this._lastError = null
        this.setState({ content })
      } catch (err) {
        if (id !== this._compileId || err.message === this._lastError) {
          return
        }
        this._lastError = err.message
        this.props.addAlert(`[Template Compiler Error] ${err.message}`, 'error')
      }
    }

    render() {
      const { preview, disablePointer, iframeBase, previewSize } = this.props
      const { content } = this.state

      return (
        <div className="FilesList--preview">
          {!preview && (
            <div className="FilesList--preview-empty">{'Select an MJML file to preview it'}</div>
          )}
          {disablePointer && <div className="FilesList--preview-overlay abs" />}
          <div className={cx('FilesList--preview-content', { isVisible: !!preview })}>
            {preview ? (
              preview.type === 'html' ? (
                <Iframe base={iframeBase} value={content} openLinks />
              ) : preview.type === 'image' ? (
                <img className="FileList--preview-image" src={pathToFileURL(preview.content)} />
              ) : null
            ) : null}
            {preview && preview.type === 'html' && (
              <div className="FilesList--preview-width">{`${previewSize.get('current')} px`}</div>
            )}
          </div>
        </div>
      )
    }
  },
)
