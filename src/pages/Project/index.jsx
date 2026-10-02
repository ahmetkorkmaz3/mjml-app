import { Component, Fragment } from 'react'
import { path as pathModule } from 'helpers/api'
import { connect } from 'react-redux'
import {
  MdChevronLeft as IconBack,
  MdDesktopWindows as IconDesktop,
  MdPhoneIphone as IconMobile,
  MdSend as IconEmail,
  MdIosShare as IconExport,
  MdKeyboardArrowDown as IconDown,
  MdMoreHoriz as IconMore,
  MdSettings as IconSettings,
} from 'react-icons/md'

import { useSearchParams } from 'react-router'
import beautifyJS from 'js-beautify'

import defaultMJML from 'data/defaultMJML'

import { openModal } from 'reducers/modals'
import { addAlert } from 'reducers/alerts'
import { setPreview } from 'actions/preview'
import { updateSettings } from 'actions/settings'

import api from 'helpers/api'
import { saveDialog, writeFile, fileExists } from 'helpers/fs'
import { runCommand } from 'helpers/commands'
import { showContextMenu } from 'helpers/contextMenu'
import { formatShortcut } from 'helpers/shortcut'

import Button from 'components/Button'
import FilesList from 'components/FilesList'
import TitleBar from 'components/TitleBar'
import SegmentedControl from 'components/SegmentedControl'
import PageCommands from 'components/PageCommands'
import StatusBar from 'components/StatusBar'
import router from 'router'

import SendModal from './SendModal'
import AddFileModal from './AddFileModal'
import FigmaImportModal from './FigmaImportModal'
import RefineModal from './RefineModal'
import RemoveFileModal from './RemoveFileModal'
import PreviewSettings from './PreviewSettings'

import './style.scss'

const shortcut = accelerator => formatShortcut(accelerator, api.platform)

function Breadcrumb({ projectName, folders, fileName, isDirty, onNavigate }) {
  return (
    <div className="Breadcrumb">
      <button
        type="button"
        className="Breadcrumb--item Breadcrumb--project"
        title={projectName}
        onClick={() => onNavigate(0)}
      >
        {projectName}
      </button>
      {folders.map((folder, i) => (
        <Fragment key={i}>
          <span className="Breadcrumb--sep">{'/'}</span>
          <button type="button" className="Breadcrumb--item" onClick={() => onNavigate(i + 1)}>
            {folder}
          </button>
        </Fragment>
      ))}
      {fileName && (
        <>
          <span className="Breadcrumb--sep">{'/'}</span>
          <span className="Breadcrumb--file" title={fileName}>
            {fileName}
          </span>
          {isDirty && <span className="Breadcrumb--dirty" aria-label="Unsaved changes" />}
        </>
      )}
    </div>
  )
}

const ConnectedProjectPage = connect(
  state => ({
    preview: state.preview,
    previewSize: state.settings.get('previewSize'),
    beautifyOutput: state.settings.getIn(['mjml', 'beautify']),
    checkForRelativePaths: state.settings.getIn(['mjml', 'checkForRelativePaths']),
    preventAutoSave: state.settings.getIn(['editor', 'preventAutoSave']),
    isDirty: state.editorStatus.isDirty,
    layout: state.settings.get('layout'),
  }),
  {
    openModal,
    addAlert,
    setPreview,
    updateSettings,
  },
)(
  class ProjectPageContent extends Component {
    state = {
      path: this.props.rootPath,
      activeFile: null,
      showSettings: false,
    }

    componentDidMount() {
      this._page.focus()
    }

    componentWillUnmount() {
      this.props.setPreview(null)
    }

    hasHTMLPreview() {
      return !!this.props.preview && this.props.preview.type === 'html'
    }

    isMJMLFile() {
      const { activeFile } = this.state
      return !!activeFile && activeFile.name.endsWith('.mjml')
    }

    // the menu disables the items that do not apply, the checks keep a stale menu safe
    commands = {
      'new-file': () => this.openAddFileModal(),
      'import-figma': () => this.openFigmaImportModal(),
      save: () => this.props.preventAutoSave && this._editor && this._editor.handleSave(),
      'export-html': () => this.hasHTMLPreview() && this.handleExportToHTML(),
      'copy-html': () => this.hasHTMLPreview() && this.handleCopyHTML(),
      screenshots: () => this.hasHTMLPreview() && this.isMJMLFile() && this.handleScreenshot(),
      send: () => this.hasHTMLPreview() && this.openSendModal(),
      'close-project': () => router.navigate('/'),
      find: () => this._editor && this._editor.openSearch(),
      beautify: () => this.isMJMLFile() && this._editor && this.handleBeautify(),
      refine: () => this.isMJMLFile() && this.openRefineModal(),
      templating: () => this.handleOpenSettings(),
      'toggle-sidebar': () =>
        this.props.updateSettings(s => s.updateIn(['layout', 'sidebarCollapsed'], v => !v)),
      'toggle-preview': () =>
        this.props.updateSettings(s => s.updateIn(['layout', 'previewCollapsed'], v => !v)),
      'preview-desktop': () => this.setPreviewSize('desktop'),
      'preview-mobile': () => this.setPreviewSize('mobile'),
    }

    setPreviewSize = which => {
      const size = this.props.previewSize.get(which)
      this.props.updateSettings(s => s.setIn(['previewSize', 'current'], size))
    }

    handleExportMenu = async () => {
      const id = await showContextMenu([
        { id: 'copy-html', label: 'Copy HTML', accelerator: 'CmdOrCtrl+Shift+C' },
        { id: 'export-html', label: 'Export HTML File…', accelerator: 'CmdOrCtrl+E' },
        { type: 'separator' },
        {
          id: 'screenshots',
          label: 'Save Screenshots (Mobile and Desktop)',
          enabled: this.isMJMLFile(),
        },
      ])
      if (id) runCommand(id)
    }

    handleMoreMenu = async () => {
      const isMJML = this.isMJMLFile()
      const id = await showContextMenu([
        { id: 'beautify', label: 'Beautify', enabled: isMJML, accelerator: 'CmdOrCtrl+Shift+B' },
        { id: 'refine', label: 'Refine with AI…', enabled: isMJML },
        { type: 'separator' },
        { id: 'import-figma', label: 'Import from Figma…' },
        { id: 'templating', label: 'Templating…' },
        { type: 'separator' },
        {
          id: 'reveal',
          label: api.platform === 'darwin' ? 'Reveal in Finder' : 'Show in File Manager',
        },
      ])
      if (id === 'reveal') this.handleOpenInBrowser()
      else if (id) runCommand(id)
    }

    handleBeautify = () => this._editor.beautify()

    handlePathChange = path => this.setState({ path, activeFile: null })

    handleAddFile = async fileName => {
      try {
        await writeFile(fileName, defaultMJML)
      } catch (err) {
        this.props.addAlert('Error creating file', 'error')
        return
      }
      this._filelist.refresh()
    }

    handleRemoveFile = async fileName => {
      try {
        await api.shell.trashItem(fileName)
        const stillExists = await fileExists(fileName)

        if (stillExists) {
          throw new Error('File still exists')
        }

        this.props.addAlert('File successfully removed', 'success')
      } catch (e) {
        this.props.addAlert('Could not delete file', 'error')
        return
      }

      this._filelist.refresh()
      this.setState({ activeFile: null })
    }

    handleOpenInBrowser = () => {
      if (api.platform === 'darwin') {
        api.shell.showItemInFolder(this.state.path)
      } else {
        api.shell.openPath(this.state.path)
      }
    }

    handleActiveFileChange = activeFile => this.setState({ activeFile })

    handleCopyHTML = () => {
      const htmlContent = this.getHTMLOutput()
      api.clipboard.writeText(htmlContent)
      this.props.addAlert('Copied!', 'success')
    }

    handleExportToHTML = async () => {
      if (this.props.checkForRelativePaths) this.checkForRelativePaths()
      const p = await saveDialog({
        title: 'Export to HTML file',
        defaultPath: this.state.path,
        filters: [{ name: 'All Files', extensions: ['html'] }],
      })
      if (!p) {
        return
      }

      const { addAlert } = this.props

      const htmlContent = this.getHTMLOutput()

      await writeFile(p, htmlContent)
      addAlert('Successfully exported HTML', 'success')
      this._filelist.refresh()
    }

    handleScreenshot = async () => {
      const { preview, previewSize, addAlert, rootPath } = this.props

      const filename = pathModule.basename(this.state.activeFile.name, '.mjml')

      const [mobileWidth, desktopWidth] = [previewSize.get('mobile'), previewSize.get('desktop')]

      try {
        const [mobileScreenshot, desktopScreenshot] = await Promise.all([
          api.screenshot.take(preview.content, mobileWidth, this.state.path),
          api.screenshot.take(preview.content, desktopWidth, this.state.path),
        ])

        await api.screenshot.cleanUp(this.state.path)

        await Promise.all([
          writeFile(pathModule.join(rootPath, `${filename}-mobile.png`), mobileScreenshot),
          writeFile(pathModule.join(rootPath, `${filename}-desktop.png`), desktopScreenshot),
        ])
      } catch (err) {
        addAlert('Could not take the screenshots', 'error')
        return
      }

      addAlert('Successfully saved mobile and desktop screenshots', 'success')
      this._filelist.refresh()
    }

    openSettingsModal = () => this.props.openModal('settings')

    openSendModal = () => this.props.openModal('send')

    openAddFileModal = () => this.props.openModal('addFile')

    openFigmaImportModal = () => this.props.openModal('figmaImport')

    openRefineModal = () => this.props.openModal('refine')

    handleFigmaImported = ({ filePath, warnings, usage }) => {
      const { addAlert } = this.props
      this._filelist.refresh()
      this.setState({ activeFile: { isFolder: false, name: pathModule.basename(filePath) } })
      addAlert(
        `Done: ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens, ${usage.calls} model calls`,
        'success',
      )
      if (warnings.length) {
        addAlert(['Import warnings:', ...warnings.map(w => `■ ${w}`)], 'info', { autoHide: false })
      }
    }

    handleOpenSettings = () => this.setState({ showSettings: true })
    handleCloseSettings = () => this.setState({ showSettings: false })

    checkForRelativePaths() {
      const { preview } = this.props
      const relativePathsRegex = new RegExp(/(?:href|src)=(["'])(?!mailto|https|http|data:).*?\1/g)
      let matches = preview.content.match(relativePathsRegex)
      if (matches) {
        matches = matches.map(match => `■ ${match}`)
        this.props.addAlert(['Found possible non-absolute paths:', ...matches], 'error', {
          autoHide: false,
        })
      }
    }

    getHTMLOutput() {
      const { preview, beautifyOutput } = this.props
      return beautifyOutput
        ? beautifyJS.html(preview.content, {
            indent_size: 2,
            wrap_attributes_indent_size: 2,
            max_preserve_newline: 0,
            preserve_newlines: false,
          })
        : preview.content
    }

    render() {
      const { preventAutoSave, previewSize, isDirty, rootPath, layout } = this.props
      const { path, activeFile, showSettings } = this.state

      const projectName = pathModule.basename(rootPath)
      const isMJMLFile = activeFile && activeFile.name.endsWith('.mjml')
      const hasPreview = this.hasHTMLPreview()
      const folders = pathModule.relative(rootPath, path).split(pathModule.sep).filter(Boolean)
      const currentSize = previewSize.get('current')
      const sizeName =
        currentSize === previewSize.get('desktop')
          ? 'desktop'
          : currentSize === previewSize.get('mobile')
            ? 'mobile'
            : null

      return (
        <div className="ProjectPage" tabIndex={-1} ref={n => (this._page = n)}>
          <PageCommands
            commands={this.commands}
            context={{
              page: 'project',
              hasMjmlFile: !!isMJMLFile,
              hasPreview: this.hasHTMLPreview(),
              preventAutoSave: !!preventAutoSave,
            }}
          />
          <TitleBar
            left={
              <>
                <Button
                  variant="ghost"
                  icon
                  link
                  to="/"
                  aria-label="Back to projects"
                  data-tooltip={`Back to projects (${shortcut('CmdOrCtrl+W')})`}
                >
                  <IconBack size={20} />
                </Button>
                <Breadcrumb
                  projectName={projectName}
                  folders={folders}
                  fileName={activeFile && !activeFile.isFolder ? activeFile.name : null}
                  isDirty={isDirty}
                  onNavigate={depth =>
                    this.handlePathChange(pathModule.join(rootPath, ...folders.slice(0, depth)))
                  }
                />
              </>
            }
            right={
              <>
                {preventAutoSave && (
                  <Button
                    variant={isDirty ? 'primary' : 'secondary'}
                    data-tooltip={`Save (${shortcut('CmdOrCtrl+S')})`}
                    onClick={() => this._editor && this._editor.handleSave()}
                  >
                    {'Save'}
                  </Button>
                )}
                <SegmentedControl
                  disabled={!hasPreview}
                  value={sizeName}
                  onChange={this.setPreviewSize}
                  options={[
                    {
                      value: 'desktop',
                      icon: <IconDesktop size={14} />,
                      tooltip: `Desktop preview (${shortcut('CmdOrCtrl+1')})`,
                    },
                    {
                      value: 'mobile',
                      icon: <IconMobile size={14} />,
                      tooltip: `Mobile preview (${shortcut('CmdOrCtrl+2')})`,
                    },
                  ]}
                />
                <Button
                  variant="ghost"
                  disabled={!hasPreview}
                  onClick={this.openSendModal}
                  data-tooltip={`Send a test email (${shortcut('CmdOrCtrl+Shift+E')})`}
                >
                  <IconEmail size={15} />
                  {'Send'}
                </Button>
                <Button variant="ghost" disabled={!hasPreview} onClick={this.handleExportMenu}>
                  <IconExport size={15} />
                  {'Export'}
                  <IconDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  icon
                  aria-label="More actions"
                  data-tooltip="More actions"
                  onClick={this.handleMoreMenu}
                >
                  <IconMore size={18} />
                </Button>
                <Button
                  variant="ghost"
                  icon
                  aria-label="Settings"
                  data-tooltip={`Settings (${shortcut('CmdOrCtrl+,')})`}
                  onClick={this.openSettingsModal}
                >
                  <IconSettings size={16} />
                </Button>
              </>
            }
          />

          <div className="fg-1 d-f fd-c r" style={{ zIndex: 1 }}>
            <FilesList
              onRef={n => (this._filelist = n)}
              onEditorRef={n => (this._editor = n)}
              withPreview
              withHome
              rootPath={rootPath}
              path={path}
              activeFile={activeFile}
              onActiveFileChange={this.handleActiveFileChange}
              onPathChange={this.handlePathChange}
              onAddFile={this.handleAddFile}
              onRemoveFile={this.handleRemoveFile}
              onNewFile={this.openAddFileModal}
              onImportFigma={this.openFigmaImportModal}
              sidebarCollapsed={!!layout.get('sidebarCollapsed')}
              previewCollapsed={!!layout.get('previewCollapsed')}
              sidebarWidth={layout.get('sidebarWidth')}
              focusHome
            />
          </div>

          <StatusBar
            projectPath={path}
            isMJML={!!isMJMLFile}
            onGoToLine={line => this._editor && this._editor.goToLine(line)}
          />

          <SendModal currentProjectPath={path} />
          <AddFileModal rootPath={path} onAdd={this.handleAddFile} />
          <FigmaImportModal rootPath={path} onImported={this.handleFigmaImported} />
          <RefineModal
            filePath={isMJMLFile ? pathModule.join(path, activeFile.name) : null}
            getEditor={() => this._editor}
          />
          <RemoveFileModal rootPath={path} onRemove={this.handleRemoveFile} />
          <PreviewSettings
            currentProjectPath={path}
            isOpened={showSettings}
            onClose={this.handleCloseSettings}
          />
        </div>
      )
    }
  },
)

export default function ProjectPage() {
  const [searchParams] = useSearchParams()
  const rootPath = searchParams.get('path')
  // a new project path mounts a new page, so the state starts again
  return <ConnectedProjectPage key={rootPath} rootPath={rootPath} />
}
