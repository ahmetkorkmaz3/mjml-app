import { Component } from 'react'
import debounce from 'lodash/debounce'
import { connect } from 'react-redux'
import {
  MdPalette as IconAppearance,
  MdClose as IconClose,
  MdSettingsApplications as IconMJMLEngine,
  MdFormatAlignLeft as IconEditor,
  MdImportantDevices as IconPreview,
  MdCode as IconCode,
} from 'react-icons/md'

import { isModalOpened, closeModal } from 'reducers/modals'
import { updateSettings } from 'actions/settings'

import Modal from 'components/Modal'
import Button from 'components/Button'
import CheckBox from 'components/CheckBox'
import TabsVertical, { TabItem } from 'components/TabsVertical'
import SnippetForm from 'components/SnippetForm'
import SnippetImports from 'components/SnippetImports'
import SnippetsList from 'components/SnippetsList'
import SegmentedControl from 'components/SegmentedControl'

import { FaFigma } from 'react-icons/fa'
import AIFigmaSettings from './AIFigmaSettings'
import MJMLEngine from 'components/MJMLEngine'
import MjmlConfigPath from 'components/MjmlConfigPath'
import SettingRow from './SettingRow'

import './style.scss'

export default connect(
  state => ({
    isOpened: isModalOpened(state, 'settings'),
    mobileSize: state.settings.getIn(['previewSize', 'mobile']),
    desktopSize: state.settings.getIn(['previewSize', 'desktop']),
    settings: state.settings,
  }),
  {
    closeModal,
    updateSettings,
  },
)(
  class SettingsModal extends Component {
    state = {
      sizes: {
        mobile: this.props.mobileSize,
        desktop: this.props.desktopSize,
      },
    }

    handleClose = () => this.props.closeModal('settings')

    handleChangeSize = (key, val) => {
      this.setState(state => ({
        ...state,
        sizes: {
          ...state.sizes,
          [key]: Number(val),
        },
      }))
      this.debounceChangeSizes()
    }

    debounceChangeSizes = debounce(() => {
      const { sizes } = this.state
      this.props.updateSettings(settings => {
        return settings
          .setIn(['previewSize', 'mobile'], sizes.mobile)
          .setIn(['previewSize', 'desktop'], sizes.desktop)
      })
    }, 250)

    changeEditorSetting = key => val => {
      this.props.updateSettings(settings => settings.setIn(['editor', key], val))
    }

    changeMJMLSetting = key => val => {
      this.props.updateSettings(settings => {
        settings = settings.setIn(['mjml', key], val)
        if (key === 'minify' && val === true) {
          settings = settings.setIn(['mjml', 'beautify'], false)
        }
        if (key === 'beautify' && val === true) {
          settings = settings.setIn(['mjml', 'minify'], false)
        }
        return settings
      })
    }

    numberInput(value, onChange, min = 1) {
      return (
        <input
          type="number"
          min={min}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
      )
    }

    render() {
      const { isOpened, settings, updateSettings } = this.props

      const { sizes } = this.state

      const editor = key => settings.getIn(['editor', key])
      const theme = settings.getIn(['appearance', 'theme'], 'system')
      const fontSize = settings.getIn(['editor', 'fontSize'], 13)
      const minifyOutput = settings.getIn(['mjml', 'minify'], false)
      const beautifyOutput = settings.getIn(['mjml', 'beautify'], false)
      const keepCommentsOutput = settings.getIn(['mjml', 'keepComments'], true)
      const checkForRelativePaths = settings.getIn(['mjml', 'checkForRelativePaths'], false)

      return (
        <Modal size="lg" isOpened={isOpened} onClose={this.handleClose} className="SettingsModal">
          <div className="Modal--label SettingsModal--header">
            {'Settings'}
            <Button variant="ghost" size="sm" icon aria-label="Close" onClick={this.handleClose}>
              <IconClose size={16} />
            </Button>
          </div>

          <div className="SettingsModal--sections">
            <TabsVertical>
              <TabItem title="Appearance" icon={IconAppearance}>
                <div className="SettingsSection--title">{'Appearance'}</div>
                <SettingRow label="Theme" help="System follows the appearance of your computer.">
                  <SegmentedControl
                    value={theme}
                    onChange={v => updateSettings(st => st.setIn(['appearance', 'theme'], v))}
                    options={[
                      { value: 'system', label: 'System' },
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Editor font size">
                  <select
                    value={fontSize}
                    onChange={e => this.changeEditorSetting('fontSize')(Number(e.target.value))}
                  >
                    {[12, 13, 14, 15, 16, 18].map(size => (
                      <option key={size} value={size}>{`${size} px`}</option>
                    ))}
                  </select>
                </SettingRow>
              </TabItem>

              <TabItem title="Editor" icon={IconEditor}>
                <div className="SettingsSection--title">{'Editor'}</div>
                <SettingRow label="Wrap lines">
                  <CheckBox
                    value={editor('wrapLines') !== false}
                    onChange={this.changeEditorSetting('wrapLines')}
                  />
                </SettingRow>
                <SettingRow label="Highlight the matching tag">
                  <CheckBox
                    value={!!editor('highlightTag')}
                    onChange={this.changeEditorSetting('highlightTag')}
                  />
                </SettingRow>
                <SettingRow
                  label="Fold lines when a file opens"
                  help="The editor folds the tags deeper than the fold level."
                >
                  {this.numberInput(
                    editor('foldLevel') || 1,
                    this.changeEditorSetting('foldLevel'),
                  )}
                  <CheckBox
                    value={!!editor('autoFold')}
                    onChange={this.changeEditorSetting('autoFold')}
                  />
                </SettingRow>
                <SettingRow label="Indent with tabs" help="The tab size sets the width of a tab.">
                  {this.numberInput(editor('tabSize') || 2, this.changeEditorSetting('tabSize'))}
                  <CheckBox
                    value={!!editor('useTab')}
                    onChange={this.changeEditorSetting('useTab')}
                  />
                </SettingRow>
                <SettingRow label="Indent size">
                  {this.numberInput(
                    editor('indentSize') || 2,
                    this.changeEditorSetting('indentSize'),
                  )}
                </SettingRow>
                <SettingRow
                  label="Save automatically"
                  help="When this is off, use File › Save to write the file."
                >
                  <CheckBox
                    value={!editor('preventAutoSave')}
                    onChange={v => this.changeEditorSetting('preventAutoSave')(!v)}
                  />
                </SettingRow>
              </TabItem>

              <TabItem title="MJML" icon={IconMJMLEngine}>
                <div className="SettingsSection--title">{'MJML'}</div>
                <MJMLEngine />
                <div className="SettingsSection--subtitle">{'HTML output'}</div>
                <SettingRow label="Minify the HTML">
                  <CheckBox value={minifyOutput} onChange={this.changeMJMLSetting('minify')} />
                </SettingRow>
                <SettingRow label="Beautify the HTML">
                  <CheckBox value={beautifyOutput} onChange={this.changeMJMLSetting('beautify')} />
                </SettingRow>
                <SettingRow label="Keep the HTML comments">
                  <CheckBox
                    value={keepCommentsOutput}
                    onChange={this.changeMJMLSetting('keepComments')}
                  />
                </SettingRow>
                <SettingRow
                  label="Warn about relative paths on export"
                  help="Email clients do not load relative paths like /image.jpg."
                >
                  <CheckBox
                    value={checkForRelativePaths}
                    onChange={this.changeMJMLSetting('checkForRelativePaths')}
                  />
                </SettingRow>
                <div className="SettingsSection--subtitle">{'Configuration'}</div>
                <MjmlConfigPath />
              </TabItem>

              <TabItem title="Preview" icon={IconPreview}>
                <div className="SettingsSection--title">{'Preview'}</div>
                <SettingRow label="Desktop width" help="In pixels.">
                  {this.numberInput(sizes.desktop, v => this.handleChangeSize('desktop', v), 200)}
                </SettingRow>
                <SettingRow label="Mobile width" help="In pixels.">
                  {this.numberInput(sizes.mobile, v => this.handleChangeSize('mobile', v), 200)}
                </SettingRow>
              </TabItem>

              <TabItem title="AI & Figma" className="flow-v-10" icon={FaFigma}>
                <div className="SettingsSection--title">{'AI & Figma'}</div>
                <AIFigmaSettings />
              </TabItem>

              <TabItem title="Snippets" className="d-b" icon={IconCode}>
                <div className="SettingsSection--title">{'Snippets'}</div>
                <p className="t-small">
                  {'Type a trigger and press Tab to expand it in the editor.'}
                </p>
                <div className="Snippets d-f mt-10">
                  <div className="fg-1">
                    <SnippetForm />
                    <SnippetImports />
                  </div>
                  <div className="SnippetsList d-f flow-h-5 fg-1">
                    <SnippetsList />
                  </div>
                </div>
              </TabItem>
            </TabsVertical>
          </div>
        </Modal>
      )
    }
  },
)
