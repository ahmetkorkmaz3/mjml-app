import { Component } from 'react'
import { connect } from 'react-redux'
import cx from 'classnames'
import { path as pathModule } from 'helpers/api'
import { SplitPane, Pane } from 'react-split-pane'
import { FaFigma } from 'react-icons/fa'
import {
  MdFolder as IconFolder,
  MdCode as IconMJML,
  MdHtml as IconHTML,
  MdImage as IconImage,
  MdInsertDriveFile as IconFile,
  MdNoteAdd as IconNewFile,
} from 'react-icons/md'

import { openModal } from 'reducers/modals'
import { addAlert } from 'reducers/alerts'

import api from 'helpers/api'
import { readDir, sortFiles, rename, copyFile } from 'helpers/fs'
import { duplicateName, fileKind, splitName } from 'helpers/files'
import { fitPreviewWidth } from 'helpers/layout'
import { showContextMenu } from 'helpers/contextMenu'
import { formatShortcut } from 'helpers/shortcut'
import { setPreview } from 'actions/preview'
import { updateSettings } from 'actions/settings'

import Button from 'components/Button'
import FileEditor from 'components/FileEditor'
import FilePreview from './FilePreview'
import OldSyntaxDetected from './OldSyntaxDetected'

import './styles.scss'

const FILE_ICONS = {
  folder: IconFolder,
  mjml: IconMJML,
  html: IconHTML,
  image: IconImage,
  other: IconFile,
}

const REVEAL_LABEL = api.platform === 'darwin' ? 'Reveal in Finder' : 'Show in File Manager'

function FileIcon({ file }) {
  const Icon = FILE_ICONS[fileKind(file.name, file.isFolder)]
  return <Icon className="FilesList--icon" size={15} />
}

function renameFile(path, oldName, newName, files) {
  if (oldName === newName) {
    return
  }
  const filesWithoutOld = files.filter(f => f.name !== oldName)
  const fileExists = filesWithoutOld.some(f => f.name === newName)
  if (fileExists) {
    throw new Error('File already exists')
  }
  const oldFullName = pathModule.join(path, oldName)
  const newFullName = pathModule.join(path, newName)
  return rename(oldFullName, newFullName)
}

export default connect(
  state => ({
    previewSize: state.settings.get('previewSize'),
  }),
  {
    setPreview,
    openModal,
    updateSettings,
    addAlert,
  },
)(
  class FilesList extends Component {
    state = {
      isAdding: false,
      files: [],
      isDragging: false,
      renamedFile: null,
      newName: '',
      isOldSyntaxDetected: false,
      mainWidth: 0,
    }

    _hasFocused = false

    componentDidMount() {
      this.refresh()
      this._unsubscribeFocus = api.on('browser-window-focus', this.refresh)
    }

    componentDidUpdate(prevProps, prevState) {
      if (prevProps.path !== this.props.path) {
        this.refresh()
      }
      if (!prevState.isAdding && this.state.isAdding) {
        this._inputName.focus()
      }
      if (this.state.files.length > prevState.files.length && this._lastCreated) {
        const node = this._refs[this._lastCreated]
        node && node.focus()
      }
      if (!prevState.renamedFile && this.state.renamedFile) {
        // select the name without the extension, like the Finder
        const { renamedFile } = this.state
        const end = renamedFile.isFolder
          ? renamedFile.name.length
          : splitName(renamedFile.name)[0].length
        this._renameInput.setSelectionRange(0, end)
      }
    }

    componentWillUnmount() {
      this._unmounted = true
      this._unsubscribeFocus()
      if (this._mainObserver) {
        this._mainObserver.disconnect()
      }
    }

    // the width of the editor and the preview, to keep room for the editor
    setMainRef = node => {
      if (this._mainObserver) {
        this._mainObserver.disconnect()
        this._mainObserver = null
      }
      if (!node) {
        return
      }
      this._mainObserver = new ResizeObserver(([entry]) => {
        const mainWidth = Math.round(entry.contentRect.width)
        if (!this._unmounted && mainWidth !== this.state.mainWidth) {
          this.setState({ mainWidth })
        }
      })
      this._mainObserver.observe(node)
    }

    handleDetectOldSyntax = val => this.setState({ isOldSyntaxDetected: val })

    handleSubmit = e => {
      e.preventDefault()
      const { path, onAddFile, onActiveFileChange } = this.props
      let name = this._inputName.value
      if (!name) {
        return
      }
      name = `${name}.mjml`
      const fileName = pathModule.join(path, name)
      onAddFile(fileName)
      onActiveFileChange({
        isFolder: false,
        name,
      })
      this._lastCreated = name
      this.toggleAdding()
    }

    handleClickFactory = f => () => {
      const p = pathModule.join(this.props.path, f.name)
      if (f.isFolder) {
        return this.props.onPathChange(p)
      }
      if (this.props.onFileClick) {
        this.props.onFileClick(p)
      }
      // preview will be set by the onChange on editor
      // no need to trigger it here
      if (!p.endsWith('.mjml')) {
        this.props.setPreview(p)
      }
      this.props.onActiveFileChange(f)
    }

    handleClickDirectFactory = (items, i) => () => {
      const sub = items.slice(0, i + 1)
      const relativePath = sub.join(pathModule.sep)
      const path = pathModule.join(this.props.rootPath, relativePath)
      this.props.onPathChange(path)
    }

    handleRemoveFileFactory = f => e => {
      if (e) {
        e.preventDefault()
      }
      const p = pathModule.join(this.props.path, f.name)
      this.props.onRemoveFile(p)
    }

    handleNavigateUp = () => {
      this.props.onPathChange(pathModule.dirname(this.props.path))
    }

    handlePreviewPanelStopDrag = sizes => {
      this.setCurrentSize(Math.round(sizes[1]))
      this.stopDrag()
    }

    handleChangeNewName = e => {
      this.setState({ newName: e.target.value })
    }

    handleCancelRename = () =>
      this.setState({
        renamedFile: null,
        newName: '',
      })

    handleRenameInputKeyDown = async e => {
      switch (e.key) {
        case 'Escape':
          this.handleCancelRename()
          break
        case 'Enter':
          try {
            const { path } = this.props
            const { newName, renamedFile, files } = this.state
            await renameFile(path, renamedFile.name, newName, files)
            const newFile = { name: newName, isFolder: renamedFile.isFolder }
            const newFiles = files.map(f => {
              if (f === renamedFile) {
                return newFile
              }
              return f
            })
            sortFiles(newFiles)
            this.setState({ files: newFiles })
            this.props.onActiveFileChange(newFile)
            this.handleCancelRename()
          } catch (e) {
            this.props.addAlert('A file with this name already exists', 'error')
          }
          break
        default:
          break
      }
    }

    startRename = f => this.setState({ renamedFile: f, newName: f.name })

    getFileOfRow = row => row && this.state.files.find(f => f.name === row.dataset.name)

    handleListKeyDown = e => {
      if (this.state.renamedFile) {
        return
      }
      const rows = [...e.currentTarget.querySelectorAll('.FilesList--file[data-name]')]
      const index = rows.indexOf(document.activeElement)
      const file = index > -1 ? this.getFileOfRow(rows[index]) : null
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        const next = rows[Math.min(rows.length - 1, Math.max(0, index + step))]
        if (next) {
          next.focus()
          // a folder opens only on Enter or a click
          const nextFile = this.getFileOfRow(next)
          if (nextFile && !nextFile.isFolder) {
            next.click()
          }
        }
      } else if (file && (e.key === 'F2' || (e.key === 'Enter' && api.platform === 'darwin'))) {
        e.preventDefault()
        this.startRename(file)
      } else if (file && e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        this.props.openModal('removeFile', file)
      }
    }

    handleContextMenuFactory = f => async e => {
      e.preventDefault()
      const id = await showContextMenu([
        { id: 'rename', label: 'Rename' },
        { id: 'duplicate', label: 'Duplicate', enabled: !f.isFolder },
        { id: 'reveal', label: REVEAL_LABEL },
        { type: 'separator' },
        { id: 'trash', label: 'Move to Trash' },
      ])
      const fullPath = pathModule.join(this.props.path, f.name)
      if (id === 'rename') this.startRename(f)
      if (id === 'reveal') api.shell.showItemInFolder(fullPath)
      if (id === 'trash') this.props.openModal('removeFile', f)
      if (id === 'duplicate') {
        const name = duplicateName(
          f.name,
          this.state.files.map(file => file.name),
        )
        try {
          await copyFile(fullPath, pathModule.join(this.props.path, name))
          this.refresh()
        } catch (err) {
          this.props.addAlert('Could not duplicate the file', 'error')
        }
      }
    }

    handleSidebarResizeEnd = sizes => {
      if (!this.props.sidebarCollapsed && sizes[0]) {
        const width = Math.round(sizes[0])
        this.props.updateSettings(s => s.setIn(['layout', 'sidebarWidth'], width))
      }
      this.stopDrag()
    }

    handleMigrate = () => {
      this._editor.migrateToMJML4()
      this.setState({ isOldSyntaxDetected: false })
    }

    setCurrentSize = size => {
      this.props.updateSettings(settings => {
        return settings.setIn(['previewSize', 'current'], size)
      })
    }

    refsFactory = () => {
      this._refs = {}
      return refName => node => {
        this._refs[refName] = node
      }
    }

    refresh = () => {
      const { path } = this.props
      readDir(path).then(files => {
        if (this._unmounted) {
          return
        }
        sortFiles(files)
        this.setState({
          files,
        })
        window.requestIdleCallback(() => {
          if (files.length && !this._hasFocused) {
            const indexOfIndexFile = files.findIndex(f => f.name === 'index.mjml')
            const indexOfFirstMJMLFile = files.findIndex(f => f.name.endsWith('.mjml'))
            const activeIndex =
              indexOfIndexFile > -1
                ? indexOfIndexFile
                : indexOfFirstMJMLFile > -1
                  ? indexOfFirstMJMLFile
                  : 0
            this.props.onActiveFileChange(files[activeIndex])
            this._hasFocused = true
          }
        })
      })
    }

    startDrag = () => this.setState({ isDragging: true })

    stopDrag = () => {
      this.setState({ isDragging: false })
      if (!this._editor) {
        return
      }
      this._editor.refresh()
      this._editor.focus()
    }

    toggleAdding = e => {
      if (e) {
        e.preventDefault()
      }
      this.setState(s => ({ isAdding: !s.isAdding }))
    }

    cancelAdd = e => {
      if (e) {
        e.preventDefault()
      }
      this.setState(
        s => ({ isAdding: !s.isAdding }),
        () => {
          this._addBtn.focus()
        },
      )
    }

    renderSidebar() {
      const { files, renamedFile, newName } = this.state
      const { activeFile, path, rootPath, onNewFile, onImportFigma } = this.props
      const setRef = this.refsFactory()
      const isInSubFolder = path !== rootPath

      return (
        <div className="sticky FilesList--sidebar">
          <div className="FilesList--header">
            <span className="FilesList--title">{'Files'}</span>
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="New file"
              data-tooltip={`New file (${formatShortcut('CmdOrCtrl+N', api.platform)})`}
              onClick={onNewFile}
            >
              <IconNewFile size={15} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Import from Figma"
              data-tooltip="Import from Figma"
              onClick={onImportFigma}
            >
              <FaFigma size={12} />
            </Button>
          </div>
          <div className="FilesList--list" onKeyDown={this.handleListKeyDown}>
            {isInSubFolder && (
              <button type="button" className="FilesList--file" onClick={this.handleNavigateUp}>
                <IconFolder className="FilesList--icon" size={15} />
                <span className="FilesList--item-name">{'..'}</span>
              </button>
            )}
            {files.map(f =>
              renamedFile === f ? (
                <div key={f.name} className="FilesList--file renaming active">
                  <FileIcon file={f} />
                  <input
                    ref={n => (this._renameInput = n)}
                    autoFocus
                    type="text"
                    value={newName}
                    onKeyDown={this.handleRenameInputKeyDown}
                    onChange={this.handleChangeNewName}
                    onBlur={this.handleCancelRename}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  ref={setRef(f.name)}
                  key={f.name}
                  data-name={f.name}
                  title={f.name}
                  className={cx('FilesList--file', {
                    active: activeFile && activeFile.name === f.name,
                  })}
                  onClick={this.handleClickFactory(f)}
                  onDoubleClick={() => !f.isFolder && this.startRename(f)}
                  onContextMenu={this.handleContextMenuFactory(f)}
                >
                  <FileIcon file={f} />
                  <span className="FilesList--item-name">{f.name}</span>
                </button>
              ),
            )}
          </div>
        </div>
      )
    }

    renderEditor() {
      const { isDragging, isOldSyntaxDetected } = this.state
      const { onEditorRef, activeFile, path } = this.props
      const fullActiveFile = pathModule.join(path, (activeFile && activeFile.name) || '')

      return (
        <div className="d-f fd-c sticky FilesList--editor">
          {isOldSyntaxDetected && <OldSyntaxDetected onMigrate={this.handleMigrate} />}
          {activeFile && activeFile.name.endsWith('.mjml') && (
            <FileEditor
              onRef={n => {
                this._editor = n
                onEditorRef(n)
              }}
              fileName={fullActiveFile}
              disablePointer={isDragging}
              onDetectOldSyntax={this.handleDetectOldSyntax}
            />
          )}
        </div>
      )
    }

    renderMain() {
      const { isDragging, mainWidth } = this.state
      const { path, previewSize, previewCollapsed } = this.props

      if (previewCollapsed) {
        return this.renderEditor()
      }
      const previewWidth = fitPreviewWidth(previewSize.get('current'), mainWidth, {
        min: previewSize.get('mobile'),
        editorMin: 320,
      })
      return (
        <div className="sticky" ref={this.setMainRef}>
          <SplitPane
            direction="horizontal"
            onResizeStart={this.startDrag}
            onResizeEnd={this.handlePreviewPanelStopDrag}
          >
            <Pane minSize={320}>{this.renderEditor()}</Pane>
            <Pane
              size={previewWidth}
              maxSize={previewSize.get('desktop')}
              minSize={previewSize.get('mobile')}
            >
              <div className="sticky fs-0 FilesList--preview-container">
                <FilePreview disablePointer={isDragging} iframeBase={path} />
              </div>
            </Pane>
          </SplitPane>
        </div>
      )
    }

    render() {
      const { onRef, sidebarCollapsed, sidebarWidth } = this.props

      onRef(this)

      return (
        <div className="fg-1 d-f fd-c">
          <div className="rel fg-1">
            {sidebarCollapsed ? (
              this.renderMain()
            ) : (
              <SplitPane
                direction="horizontal"
                onResizeStart={this.startDrag}
                onResizeEnd={this.handleSidebarResizeEnd}
              >
                <Pane defaultSize={sidebarWidth || 220} minSize={180} maxSize={360}>
                  {this.renderSidebar()}
                </Pane>
                <Pane>{this.renderMain()}</Pane>
              </SplitPane>
            )}
          </div>
        </div>
      )
    }
  },
)
