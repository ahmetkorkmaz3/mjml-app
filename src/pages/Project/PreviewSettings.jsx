import { Component } from 'react'
import { connect } from 'react-redux'
import debounce from 'lodash/debounce'
import find from 'lodash/find'
import * as yaml from 'js-yaml'

import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { yaml as yamlLanguage } from '@codemirror/lang-yaml'

import { editorTheme } from 'helpers/codemirror/theme'

import Modal from 'components/Modal'

import { updateSettings } from 'actions/settings'
import { addAlert } from 'reducers/alerts'

const defaultTemplatingSettings = projectPath => ({
  variables: {},
  engine: 'html',
  editorMode: 'json',
  projectPath,
})

function languageFor(editorMode) {
  return editorMode === 'yaml' ? yamlLanguage() : json()
}

export default connect(
  state => ({
    templating: state.settings.get('templating'),
    isDark: state.theme === 'dark',
  }),
  {
    addAlert,
    updateSettings,
  },
)(
  class PreviewSettings extends Component {
    state = {
      variables: defaultTemplatingSettings().variables,
      engine: defaultTemplatingSettings().engine,
      editorMode: defaultTemplatingSettings().editorMode,
      valid: true,
    }

    componentDidUpdate(prevProps) {
      if (!prevProps.isOpened && this.props.isOpened) {
        this.initEditor()
      }

      if (
        prevProps.templating !== this.props.templating ||
        (!prevProps.isOpened && this.props.isOpened)
      ) {
        this.setState({
          ...defaultTemplatingSettings(this.props.currentProjectPath),
          ...this.currentProjectTemplating(),
        })
      }
    }

    currentProjectTemplating() {
      const { currentProjectPath, templating } = this.props
      const projectTemplating = find(templating, { projectPath: currentProjectPath })

      return projectTemplating || defaultTemplatingSettings(currentProjectPath)
    }

    handleChangeEngine = event => {
      this.setState({
        engine: event.target.value,
      })
    }

    handleEditorMode = event => {
      const { value } = event.target
      this.setState({
        editorMode: value,
      })
      if (this._view) {
        this._view.dispatch({
          effects: this._language.reconfigure(languageFor(value)),
        })
      }
      this.handleChangeVars()
    }

    handleChangeVars = debounce(() => {
      if (!this._view) {
        return
      }
      const raw = this._view.state.doc.toString()
      try {
        switch (this.state.editorMode) {
          case 'yaml':
            this.setState({ variables: yaml.load(raw) || {}, valid: true })
            break
          case 'json':
            this.setState({ variables: JSON.parse(raw) || {}, valid: true })
            break
          default:
            this.setState({ variables: raw || {}, valid: true })
            break
        }
      } catch (err) {
        this.setState({ valid: false })
      }
    }, 200)

    saveVars = () => {
      if (!this.state.valid) {
        this.props.addAlert('Invalid variables syntax, couldn’t be saved', 'error')
        return
      }

      const { templating, currentProjectPath } = this.props
      const otherProjectVariables = templating.filter(v => v.projectPath !== currentProjectPath)
      const updatedVariables = [
        ...otherProjectVariables,
        {
          projectPath: currentProjectPath,
          variables: this.state.variables,
          engine: this.state.engine,
          editorMode: this.state.editorMode,
        },
      ]

      this.props.updateSettings(settings => {
        return settings.set('templating', updatedVariables)
      })
    }

    componentWillUnmount() {
      this.handleChangeVars.cancel()
      this.destroyEditor()
    }

    destroyEditor() {
      if (this._view) {
        this._view.destroy()
        this._view = null
      }
    }

    initEditor() {
      if (!this._container) return

      const { isDark } = this.props
      const { variables, editorMode } = this.currentProjectTemplating()

      this.destroyEditor()

      let content = ''

      try {
        if (Object.keys(variables).length > 0) {
          if (editorMode === 'yaml') content = yaml.dump(variables)
          if (editorMode === 'json') content = JSON.stringify(variables, null, 2)
        }

        this.setState({ variables, valid: true })
      } catch (err) {
        this.props.addAlert('Initial variables cannot be serialized', 'error')
      }

      this._language = new Compartment()

      this._view = new EditorView({
        parent: this._container,
        state: EditorState.create({
          doc: content,
          extensions: [
            history(),
            keymap.of([...historyKeymap, ...defaultKeymap]),
            EditorState.tabSize.of(2),
            this._language.of(languageFor(editorMode)),
            editorTheme(isDark),
            EditorView.updateListener.of(update => {
              if (update.docChanged) {
                this.handleChangeVars()
              }
            }),
          ],
        }),
      })
    }

    handleClose() {
      this.saveVars()
      this.props.onClose()
    }

    render() {
      const { isOpened } = this.props
      const { valid, engine, editorMode } = this.state

      return (
        <Modal
          isOpened={isOpened}
          onClose={() => this.handleClose()}
          className="FilePreview--settings-modal p-10 d-f fd-c"
        >
          <div className="Modal--label">{'Preview settings'}</div>

          <div className="mb-10">Define templating variables for this project :</div>
          <div className="mb-10">
            {'Treat MJML output as '}

            <select value={engine} className="bordered" onChange={this.handleChangeEngine}>
              <option value="html">HTML</option>
              <option value="erb">ERB template</option>
              <option value="handlebars">Handlebars template</option>
            </select>
          </div>

          <div className="">
            {'Define variables using '}

            <select value={editorMode} className="bordered" onChange={this.handleEditorMode}>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
          </div>

          <div className="mt-10 d-f jc-sb">
            <div>{`Template variables (${editorMode}):`}</div>
            <div className="yaml-invalid">{!valid && `× Invalid ${editorMode}`}</div>
          </div>
          <div className="bordered mt-5">
            <div className="PreviewSettings--editor" ref={r => (this._container = r)} />
          </div>
        </Modal>
      )
    }
  },
)
