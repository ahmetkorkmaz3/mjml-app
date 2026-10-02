import { Component } from 'react'
import { path as pathModule } from 'helpers/api'
import { connect } from 'react-redux'
import { FaCog, FaFolderOpen } from 'react-icons/fa'
import {
  MdContentCopy as IconCopy,
  MdCode as IconCode,
  MdCameraAlt as IconCamera,
  MdEmail as IconEmail,
  MdNoteAdd as IconAdd,
  MdAutorenew as IconBeautify,
  MdSave as IconSave,
  MdBuild as IconBuild,
} from 'react-icons/md'

import { useSearchParams } from 'react-router'
import beautifyJS from 'js-beautify'

import defaultMJML from 'data/defaultMJML'

import { openModal } from 'reducers/modals'
import { addAlert } from 'reducers/alerts'
import { setPreview } from 'actions/preview'

import api from 'helpers/api'
import { saveDialog, writeFile, fileExists } from 'helpers/fs'

import Button from 'components/Button'
import ButtonDropdown from 'components/Button/ButtonDropdown'
import FilesList from 'components/FilesList'

import BackButton from './BackButton'
import SendModal from './SendModal'
import AddFileModal from './AddFileModal'
import RemoveFileModal from './RemoveFileModal'
import PreviewSettings from './PreviewSettings'

const ConnectedProjectPage = connect(
  state => ({
    preview: state.preview,
    previewSize: state.settings.get('previewSize'),
    beautifyOutput: state.settings.getIn(['mjml', 'beautify']),
    checkForRelativePaths: state.settings.getIn(['mjml', 'checkForRelativePaths']),
    preventAutoSave: state.settings.getIn(['editor', 'preventAutoSave']),
  }),
  {
    openModal,
    addAlert,
    setPreview,
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
      const { preview, preventAutoSave } = this.props
      const { path, activeFile, showSettings } = this.state

      const { rootPath } = this.props
      const projectName = pathModule.basename(rootPath)
      const isMJMLFile = activeFile && activeFile.name.endsWith('.mjml')

      return (
        <div className="fg-1 d-f fd-c o-n" tabIndex={0} ref={n => (this._page = n)}>
          <div className="d-f p-10 r" style={{ zIndex: 2 }}>
            <div className="fg-1 flow-h-10">
              <BackButton projectName={projectName} />
              <Button ghost onClick={this.openAddFileModal}>
                <IconAdd className="mr-5" />
                {'New file'}
              </Button>
            </div>
            <div className="d-f flow-h-10">
              {preventAutoSave && [
                <Button key="save" transparent onClick={() => this._editor.handleSave()}>
                  <IconSave style={{ marginRight: 5 }} />
                  {'Save'}
                </Button>,
              ]}
              {isMJMLFile && [
                <Button key="beautify" transparent onClick={this.handleBeautify}>
                  <IconBeautify style={{ marginRight: 5 }} />
                  {'Beautify'}
                </Button>,
              ]}
              <Button transparent onClick={this.handleOpenSettings}>
                <IconBuild style={{ marginRight: 5 }} />
                {'Templating'}
              </Button>
              <Button transparent onClick={this.handleOpenInBrowser}>
                <FaFolderOpen style={{ marginRight: 5 }} />
                {'Open'}
              </Button>
              {preview &&
                preview.type === 'html' && [
                  <Button key={'send'} transparent onClick={this.openSendModal}>
                    <IconEmail style={{ marginRight: 5 }} />
                    {'Send'}
                  </Button>,
                  <ButtonDropdown
                    ghost
                    key={'export'}
                    dropdownWidth={300}
                    actions={[
                      {
                        icon: <IconCopy />,
                        label: 'Copy HTML',
                        desc: 'Copy the result HTML to clipboard',
                        onClick: this.handleCopyHTML,
                      },
                      {
                        icon: <IconCode />,
                        label: 'Export to HTML file',
                        desc: 'Save the result HTML file to disk',
                        onClick: this.handleExportToHTML,
                      },
                      {
                        icon: <IconCamera />,
                        label: 'Screenshot',
                        desc: 'Save a screenshot of mobile & desktop result',
                        onClick: this.handleScreenshot,
                      },
                    ]}
                  />,
                ]}
            </div>
            <Button
              className="ml-10"
              ghost
              onClick={this.openSettingsModal}
              ref={n => (this._btnSettings = n)}
            >
              <FaCog />
            </Button>
          </div>

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
              focusHome
            />
          </div>

          <SendModal currentProjectPath={path} />
          <AddFileModal rootPath={path} onAdd={this.handleAddFile} />
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
