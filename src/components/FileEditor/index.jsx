import { Component } from 'react'
import { connect } from 'react-redux'
import debounce from 'lodash/debounce'
import get from 'lodash/get'

import beautifyJS from 'js-beautify'

import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { copyLineDown, defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language'
import { xml } from '@codemirror/lang-xml'
import { lintGutter, setDiagnostics } from '@codemirror/lint'
import { highlightSelectionMatches, openSearchPanel, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'

import { addAlert } from 'reducers/alerts'
import { setEditorStatus, resetEditorStatus } from 'reducers/editorStatus'

import isOldSyntax from 'helpers/detectOldMJMLSyntax'
import { elements as mjmlElements } from 'helpers/codemirror/mjml-schema'
import { matchingTags } from 'helpers/codemirror/matching-tags'
import { expandSnippetOrIndent } from 'helpers/codemirror/snippets'
import { editorTheme } from 'helpers/codemirror/theme'
import foldByLevel from 'helpers/codemirror/fold-by-level'
import { migrateToMJML4 } from 'helpers/mjml'
import { readFile, writeFile } from 'helpers/fs'
import { setPreview } from 'actions/preview'
import { updateProjectMtime } from 'actions/projects'
import { path } from 'helpers/api'

import './styles.scss'

// uses the indent settings of the editor
function beautify(content, { useTab, indentSize }) {
  const size = useTab ? 1 : indentSize
  return beautifyJS.html(content, {
    indent_size: size,
    indent_char: useTab ? '\t' : ' ',
    indent_with_tabs: !!useTab,
    wrap_attributes_indent_size: size,
    max_preserve_newline: 0,
    preserve_newlines: false,
  })
}

export default connect(
  state => {
    const { settings, preview } = state
    return {
      mjmlEngine: settings.getIn(['mjml', 'engine'], 'auto'),
      mjmlPath: settings.getIn(['mjml', 'path']),
      minify: settings.getIn(['mjml', 'minify'], false),
      keepComments: settings.getIn(['mjml', 'keepComments'], true),
      useMjmlConfig: settings.getIn(['mjml', 'useMjmlConfig'], false),
      mjmlConfigPath: settings.getIn(['mjml', 'mjmlConfigPath']),
      wrapLines: settings.getIn(['editor', 'wrapLines'], true),
      autoFold: settings.getIn(['editor', 'autoFold']),
      foldLevel: settings.getIn(['editor', 'foldLevel']),
      highlightTag: settings.getIn(['editor', 'highlightTag']),
      isDark: state.theme === 'dark',
      errors: get(preview, 'errors', []),
      snippets: settings.get('snippets'),
      useTab: settings.getIn(['editor', 'useTab'], false),
      tabSize: settings.getIn(['editor', 'tabSize'], 2),
      indentSize: settings.getIn(['editor', 'indentSize'], 2),
      fontSize: settings.getIn(['editor', 'fontSize'], 13),
      preventAutoSave: settings.getIn(['editor', 'preventAutoSave'], false),
    }
  },
  {
    setPreview,
    addAlert,
    setEditorStatus,
    resetEditorStatus,
    updateProjectMtime,
  },
)(
  class FileEditor extends Component {
    state = {
      isLoading: true,
    }

    // `states`: the editor state (with its history) of each file, to restore
    // it when the user comes back to the file. It keeps the unsaved changes
    // when auto-save is off. `lastWritten`: the last content on the disk, for
    // each file. The files list gives the cache, so it stays while the project
    // is open (the editor unmounts when a folder or an image is selected).
    _cache = this.props.cache || { states: {}, lastWritten: {}, pendingWrites: {} }
    _stateCache = this._cache.states
    _lastWritten = this._cache.lastWritten

    // the writes in progress, for each file
    _pendingWrites = this._cache.pendingWrites

    // the file of the content that is in the editor (it can be different
    // from the `fileName` prop while the new file loads)
    _contentFileName = null

    // the configurable parts of the editor
    _compartments = {
      theme: new Compartment(),
      lineWrapping: new Compartment(),
      matchingTags: new Compartment(),
      tabSize: new Compartment(),
      indentUnit: new Compartment(),
    }

    componentDidMount() {
      window.requestIdleCallback(() => {
        this.initEditor()
        this.loadContent()
      })
    }

    componentDidUpdate(prevProps) {
      if (prevProps.fileName !== this.props.fileName) {
        this.leaveFile()
        this.loadContent()
      }
      // the settings that change the output: render again
      if (
        prevProps.mjmlEngine !== this.props.mjmlEngine ||
        prevProps.mjmlPath !== this.props.mjmlPath ||
        prevProps.minify !== this.props.minify ||
        prevProps.keepComments !== this.props.keepComments ||
        prevProps.useMjmlConfig !== this.props.useMjmlConfig ||
        prevProps.mjmlConfigPath !== this.props.mjmlConfigPath ||
        prevProps.preventAutoSave !== this.props.preventAutoSave
      ) {
        this.handleChange()
      }
      if (!this._view) {
        return
      }
      if (
        prevProps.wrapLines !== this.props.wrapLines ||
        prevProps.highlightTag !== this.props.highlightTag ||
        prevProps.isDark !== this.props.isDark ||
        prevProps.fontSize !== this.props.fontSize ||
        prevProps.useTab !== this.props.useTab ||
        prevProps.tabSize !== this.props.tabSize ||
        prevProps.indentSize !== this.props.indentSize
      ) {
        this.reconfigure()
      }
      if (
        (!prevProps.autoFold && this.props.autoFold) ||
        (this.props.autoFold && this.props.foldLevel !== prevProps.foldLevel)
      ) {
        foldByLevel(this._view, this.props.foldLevel)
      }
      if (prevProps.errors !== this.props.errors) {
        this.updateDiagnostics()
      }
    }

    componentWillUnmount() {
      cancelAnimationFrame(this._cursorFrame)
      this.props.resetEditorStatus()
      this.leaveFile()
      if (this._view) {
        this._view.destroy()
        this._view = null
      }
    }

    // Keeps the state of the file that leaves the editor and writes its last
    // change now: the debounced functions would use the next file.
    leaveFile() {
      const fileName = this._contentFileName
      this.handleChange.cancel()
      if (!this._view || !fileName) {
        return
      }
      this._stateCache[fileName] = this._view.state
      if (!this.props.preventAutoSave) {
        this.debounceWrite(fileName, this.getContent())
      }
      this.debounceWrite.flush()
      // no change goes to this file until the next file is loaded
      this._contentFileName = null
    }

    detectOldSyntax = () => {
      if (!this._view) {
        return
      }
      this.props.onDetectOldSyntax(isOldSyntax(this.getContent()))
    }

    getConfigurableExtensions() {
      const { wrapLines, highlightTag, isDark, fontSize, useTab, tabSize, indentSize } = this.props
      return {
        theme: editorTheme(isDark, fontSize),
        lineWrapping: wrapLines ? EditorView.lineWrapping : [],
        matchingTags: highlightTag ? matchingTags : [],
        tabSize: EditorState.tabSize.of(tabSize),
        indentUnit: indentUnit.of(useTab ? '\t' : ' '.repeat(indentSize)),
      }
    }

    createState(doc) {
      const conf = this.getConfigurableExtensions()
      const c = this._compartments

      return EditorState.create({
        doc,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          autocompletion(),
          highlightActiveLine(),
          highlightSelectionMatches({ wholeWords: true }),
          lintGutter(),
          xml({ elements: mjmlElements }),
          keymap.of([
            { key: 'Tab', run: view => expandSnippetOrIndent(view, this.props.snippets) },
            { key: 'Mod-Shift-d', run: copyLineDown, preventDefault: true },
            ...completionKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...defaultKeymap,
          ]),
          EditorView.updateListener.of(update => {
            if (update.docChanged && !this._isSettingContent) {
              this.handleChange()
            }
            if (update.selectionSet || update.docChanged) {
              this.scheduleCursorStatus()
            }
          }),
          c.theme.of(conf.theme),
          c.lineWrapping.of(conf.lineWrapping),
          c.matchingTags.of(conf.matchingTags),
          c.tabSize.of(conf.tabSize),
          c.indentUnit.of(conf.indentUnit),
        ],
      })
    }

    reconfigure() {
      const conf = this.getConfigurableExtensions()
      const c = this._compartments
      this._view.dispatch({
        effects: [
          c.theme.reconfigure(conf.theme),
          c.lineWrapping.reconfigure(conf.lineWrapping),
          c.matchingTags.reconfigure(conf.matchingTags),
          c.tabSize.reconfigure(conf.tabSize),
          c.indentUnit.reconfigure(conf.indentUnit),
        ],
      })
    }

    initEditor() {
      if (!this._container || this._view) {
        return
      }

      this._view = new EditorView({
        state: this.createState(''),
        parent: this._container,
      })
    }

    async loadContent() {
      const { fileName } = this.props

      if (!this.state.isLoading) {
        this.setState({ isLoading: true })
      }

      try {
        // a write of the file can still run (the file was left just before)
        await Promise.resolve(this._pendingWrites[fileName]).catch(() => {})
        const content = await readFile(fileName)
        // the file changed during the read
        if (!this._view || fileName !== this.props.fileName) {
          return
        }

        // load the previous state of the file if it exists, else, start a new one
        const cached = this._stateCache[fileName]
        const cachedDoc = cached && cached.doc.toString()
        // the unsaved changes stay while the file on the disk does not change
        const hasUnsavedChanges =
          !!cached &&
          cachedDoc !== this._lastWritten[fileName] &&
          this._lastWritten[fileName] === content
        this._isSettingContent = true
        if (cached && (cachedDoc === content || hasUnsavedChanges)) {
          this._view.setState(cached)
          this.reconfigure()
        } else {
          this._view.setState(this.createState(content))
        }
        this._isSettingContent = false
        this._contentFileName = fileName
        this._lastWritten[fileName] = content
        this.updateDirty()
        this.scheduleCursorStatus()

        // fold lines on mjml files, based on settings
        const { autoFold, foldLevel } = this.props
        if (autoFold && fileName.endsWith('.mjml')) {
          foldByLevel(this._view, foldLevel)
        }
        this.setState({ isLoading: false })
        // the preview is created from the editor content
        this.handleChange()
      } catch (e) {
        this._isSettingContent = false
        if (fileName === this.props.fileName) {
          this.setState({ isLoading: false })
          this.props.addAlert(`Could not open ${path.basename(fileName)}`, 'error')
        }
      }
    }

    updateDiagnostics() {
      const { errors } = this.props
      const { state } = this._view
      const diagnostics = (errors || [])
        .filter(err => err.line > 0 && err.line <= state.doc.lines)
        .map(err => {
          const line = state.doc.line(err.line)
          return {
            from: line.from,
            to: line.to,
            severity: 'error',
            message: err.message,
          }
        })
      this._view.dispatch(setDiagnostics(state, diagnostics))
    }

    async handleSave() {
      const { addAlert } = this.props
      const fileName = this._contentFileName
      if (!this._view || !fileName) {
        return
      }
      const mjml = this.getContent()

      try {
        await writeFile(fileName, mjml)
        this._lastWritten[fileName] = mjml
        this.updateDirty()
        this.handleWritten(fileName)
        addAlert('File successfully saved', 'success')
      } catch (e) {
        addAlert('Could not save file', 'error')
        console.log(e)
      }
    }

    handleChange = debounce(async () => {
      const fileName = this._contentFileName
      if (!this._view || !fileName) {
        return
      }
      const { setPreview, mjmlEngine, preventAutoSave, rootPath } = this.props
      const mjml = this.getContent()
      if (mjmlEngine === 'auto') {
        setPreview(fileName, mjml, { rootPath })

        if (!preventAutoSave) this.debounceWrite(fileName, mjml)
      } else {
        // the local binary reads the saved file
        if (!preventAutoSave) {
          try {
            await this.write(fileName, mjml)
          } catch (err) {
            this.handleWriteError(fileName, err)
          }
        }

        setPreview(fileName, mjml, { rootPath })
      }

      this.updateDirty()
      window.requestIdleCallback(this.detectOldSyntax)
    }, 200)

    // one dispatch for each frame at most
    scheduleCursorStatus = () => {
      if (this._cursorFrame) {
        return
      }
      this._cursorFrame = requestAnimationFrame(() => {
        this._cursorFrame = null
        if (!this._view) {
          return
        }
        const { state } = this._view
        const head = state.selection.main.head
        const line = state.doc.lineAt(head)
        this.props.setEditorStatus({ line: line.number, col: head - line.from + 1 })
      })
    }

    // the file has changes that are not on the disk (only without auto-save)
    updateDirty = () => {
      const fileName = this._contentFileName
      if (!this._view || !fileName) {
        return
      }
      const isDirty =
        !!this.props.preventAutoSave && this.getContent() !== this._lastWritten[fileName]
      if (isDirty !== this._isDirty) {
        this._isDirty = isDirty
        this.props.setEditorStatus({ isDirty })
      }
    }

    goToLine = lineNumber => {
      if (!this._view) {
        return
      }
      const { doc } = this._view.state
      const line = doc.line(Math.min(Math.max(1, lineNumber), doc.lines))
      this._view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
      this._view.focus()
    }

    getContent = () => {
      return this._view.state.doc.toString()
    }

    setContent = content => {
      const { scrollTop } = this._view.scrollDOM
      this._view.dispatch({
        changes: { from: 0, to: this._view.state.doc.length, insert: content },
      })
      this._view.scrollDOM.scrollTop = scrollTop
    }

    beautify = () => {
      const value = this.getContent()
      const beautified = beautify(value, this.props)
      this.setContent(beautified)
    }

    migrateToMJML4 = async () => {
      try {
        const content = this.getContent()
        const migratedContent = await migrateToMJML4(content)
        const beautified = beautify(migratedContent, this.props)
        this.setContent(beautified)
      } catch (err) {
        console.error(err)
      }
    }

    async write(fileName, mjml) {
      // do not write the file when the content did not change
      if (mjml === this._lastWritten[fileName]) {
        return
      }
      const writing = writeFile(fileName, mjml)
      this._pendingWrites[fileName] = writing
      try {
        await writing
      } finally {
        if (this._pendingWrites[fileName] === writing) {
          delete this._pendingWrites[fileName]
        }
      }
      this._lastWritten[fileName] = mjml
      this.updateDirty()
      this.handleWritten(fileName)
    }

    // the card of the project shows the modification time of its index file
    handleWritten(fileName) {
      if (path.basename(fileName) === 'index.mjml') {
        this.props.updateProjectMtime(path.dirname(fileName), Date.now())
      }
    }

    handleWriteError(fileName, err) {
      this.props.addAlert(`Could not save ${path.basename(fileName)}: ${err.message}`, 'error')
    }

    debounceWrite = debounce((fileName, mjml) => {
      this.write(fileName, mjml).catch(err => this.handleWriteError(fileName, err))
    }, 500)

    refresh = () => {
      this._view && this._view.requestMeasure()
    }

    openSearch = () => {
      if (this._view) {
        this._view.focus()
        openSearchPanel(this._view)
      }
    }

    focus = () => {
      this._view && this._view.focus()
    }

    render() {
      const { disablePointer, onRef } = this.props
      const { isLoading } = this.state

      onRef(this)

      return (
        <div
          className="FileEditor"
          style={{
            pointerEvents: disablePointer ? 'none' : 'auto',
          }}
        >
          {isLoading && <div className="sticky z FileEditor--loader">{'...'}</div>}
          <div className="FileEditor--editor" ref={n => (this._container = n)} />
        </div>
      )
    }
  },
)
