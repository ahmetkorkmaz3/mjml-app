import { connect } from 'react-redux'
import find from 'lodash/find'
import { MdCheckCircle as IconOk, MdError as IconError } from 'react-icons/md'

import './style.scss'

const TEMPLATING_LABELS = { handlebars: 'Handlebars', erb: 'ERB' }

function StatusBar({ status, errors, engine, templating, preventAutoSave, isMJML, onGoToLine }) {
  const firstError = errors.find(e => e.line > 0)
  return (
    <div className="StatusBar">
      <div className="StatusBar--group">
        {isMJML &&
          (errors.length ? (
            <button
              type="button"
              className="StatusBar--item StatusBar--errors"
              onClick={() => firstError && onGoToLine(firstError.line)}
            >
              <IconError size={13} />
              {errors.length === 1 ? '1 error' : `${errors.length} errors`}
            </button>
          ) : (
            <span className="StatusBar--item StatusBar--ok">
              <IconOk size={13} />
              {'No errors'}
            </span>
          ))}
        {isMJML && (
          <span className="StatusBar--item">
            {status.isRendering
              ? 'Rendering…'
              : status.renderMs !== null
                ? `Rendered in ${status.renderMs} ms`
                : ''}
          </span>
        )}
      </div>
      <div className="StatusBar--group">
        {preventAutoSave && <span className="StatusBar--item">{'Auto-save off'}</span>}
        {TEMPLATING_LABELS[templating] && (
          <span className="StatusBar--item">{TEMPLATING_LABELS[templating]}</span>
        )}
        <span className="StatusBar--item">
          {engine === 'manual' ? 'MJML (local binary)' : `MJML ${__MJML_VERSION__}`}
        </span>
        {isMJML && (
          <span className="StatusBar--item">{`Ln ${status.line}, Col ${status.col}`}</span>
        )}
      </div>
    </div>
  )
}

export default connect((state, { projectPath }) => ({
  status: state.editorStatus,
  errors: (state.preview && state.preview.errors) || [],
  engine: state.settings.getIn(['mjml', 'engine'], 'auto'),
  templating: (find(state.settings.get('templating'), { projectPath }) || {}).engine,
  preventAutoSave: state.settings.getIn(['editor', 'preventAutoSave'], false),
}))(StatusBar)
