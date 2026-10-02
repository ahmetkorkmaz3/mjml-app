import { Component } from 'react'
import get from 'lodash/get'
import { connect } from 'react-redux'
import debounce from 'lodash/debounce'
import find from 'lodash/find'
import CreatableSelect from 'react-select/creatable'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'

import { MdAdd as IconAdd } from 'react-icons/md'

import api from 'helpers/api'
import { compile } from 'helpers/preview-content'

import { isModalOpened, closeModal } from 'reducers/modals'
import { addAlert } from 'reducers/alerts'
import { updateSettings, addToLastUsedEmails, removeFromLastUsedEmails } from 'actions/settings'

import MailjetInfos from 'components/MailjetInfos'
import Modal from 'components/Modal'
import Button from 'components/Button'

// the Mailjet keys are secrets of the main process (see MailjetInfos)
function getAPIState(props) {
  return {
    Subject: props.Subject,
    SenderName: props.SenderName,
    SenderEmail: props.SenderEmail,
    TargetEmails: props.TargetEmails,
  }
}

export default connect(
  state => {
    const SenderName = state.settings.getIn(['api', 'SenderName'], '')
    const SenderEmail = state.settings.getIn(['api', 'SenderEmail'], '')
    const TargetEmails = state.settings.getIn(['api', 'TargetEmails'], [])
    const LastEmails = state.settings.getIn(['api', 'LastEmails'], [])
    const Subject = state.settings.getIn(['api', 'Subject'], '')

    return {
      content: get(state, 'preview.content', ''),
      isOpened: isModalOpened(state, 'send'),
      Subject,
      SenderName,
      SenderEmail,
      TargetEmails,
      emails: uniq([...(SenderEmail ? [SenderEmail] : []), ...TargetEmails, ...LastEmails]).map(
        email => ({ label: email, value: email }),
      ),
      templating: state.settings.get('templating'),
    }
  },
  {
    addAlert,
    closeModal,
    updateSettings,
    addToLastUsedEmails,
    removeFromLastUsedEmails,
  },
)(
  class SendModal extends Component {
    state = {
      emails: this.props.emails,
      // the API key and the API secret are saved
      hasKeys: false,
      isSending: false,
      ...getAPIState(this.props),
    }

    componentDidUpdate(prevProps) {
      const didOpened = !prevProps.isOpened && this.props.isOpened
      if (didOpened) {
        this.setState(getAPIState(this.props))
      }
    }

    handleKeysChange = hasKeys => this.setState({ hasKeys })

    handleClose = () => this.props.closeModal('send')

    handleChangeInfo = (key, val) => {
      this.setState({ [key]: val })
      this.debounceSaveInConfig()
    }

    handleChangeTargetEmails = value => {
      const emails = (value || []).map(v => v.value)
      this.props.addToLastUsedEmails(emails)
      this.setState({ TargetEmails: emails })
      this.debounceSaveInConfig()
    }

    handleAddMultipleEmails = emailsToAdd => {
      const { emails } = this.state
      emailsToAdd = emailsToAdd.map(v => ({ label: v, value: v }))
      this.setState({
        emails: uniqBy([...emails, ...emailsToAdd], e => e.value),
      })
      this.handleChangeTargetEmails(emailsToAdd)
    }

    handleSubmit = async e => {
      e.stopPropagation()
      e.preventDefault()

      const { addAlert, content: raw, templating, currentProjectPath } = this.props
      const { Subject, SenderName, SenderEmail, TargetEmails } = this.state
      // the state changes after the render, so a double click needs this flag
      if (this._sending || !this.isValid()) {
        return
      }
      this.setSending(true)
      const projectTemplating = find(templating, { projectPath: currentProjectPath }) || {}

      let content

      try {
        content = await compile({
          raw,
          engine: projectTemplating.engine,
          variables: projectTemplating.variables,
        })
      } catch (err) {
        this.setSending(false)
        this.props.addAlert(`[Template Compiler Error] ${err.message}`, 'error')
        return
      }

      let res
      try {
        res = await api.sendEmail({ content, Subject, SenderName, SenderEmail, TargetEmails })
      } catch (err) {
        res = { error: { message: err.message } }
      }
      this.setSending(false)

      if (res && res.error) {
        addAlert(`Could not send the email: ${res.error.message}`, 'error')
        return
      }
      window.requestIdleCallback(() => addAlert('Mail has been sent', 'success'))
      window.requestIdleCallback(this.handleClose)
    }

    setSending(isSending) {
      this._sending = isSending
      this.setState({ isSending })
    }

    isValid() {
      const { hasKeys, Subject, SenderName, SenderEmail, TargetEmails } = this.state
      return hasKeys && !!SenderName && !!SenderEmail && !!TargetEmails.length && !!Subject
    }

    handleRemoveLastEmail = email => {
      this.props.removeFromLastUsedEmails(email)
      this.setState({
        emails: this.state.emails.filter(e => e.value !== email),
        TargetEmails: this.state.TargetEmails.filter(e => e !== email),
      })
    }

    debounceSaveInConfig = debounce(() => {
      this.props.updateSettings(settings => {
        return settings
          .setIn(['api', 'Subject'], this.state.Subject)
          .setIn(['api', 'SenderName'], this.state.SenderName)
          .setIn(['api', 'SenderEmail'], this.state.SenderEmail)
          .setIn(['api', 'TargetEmails'], this.state.TargetEmails)
      })
    }, 1e3)

    handlePaste = e => {
      const clipboard = e.clipboardData.getData('Text')
      if (!clipboard) {
        return
      }
      e.preventDefault()
      const pasted = clipboard
        .split(/[\s,;]+/)
        .map(v => v.trim())
        .filter(v => v)
      const values = uniq([...this.state.TargetEmails, ...pasted])
      this.handleAddMultipleEmails(values)
    }

    renderOption = (option, { context }) => {
      // the "Add ..." option of the creatable select
      if (option.__isNew__ || context !== 'menu') {
        return option.label
      }
      const { value } = option
      const isInEmails = this.state.emails.find(e => e.value === value)
      const isRemovable = isInEmails && value !== this.props.SenderEmail
      return (
        <div className="d-f ai-c">
          {value}
          {isRemovable && (
            <div
              className="ml-auto"
              onMouseDown={e => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                this.handleRemoveLastEmail(value)
              }}
            >
              {'remove'}
            </div>
          )}
        </div>
      )
    }

    render() {
      const { isOpened } = this.props

      const { emails, Subject, SenderName, SenderEmail, TargetEmails, isSending } = this.state

      return (
        <Modal isOpened={isOpened} onClose={this.handleClose}>
          <div className="Modal--label">{'Send'}</div>

          <form onSubmit={this.handleSubmit} className="flow-v-20">
            <MailjetInfos
              onKeysChange={this.handleKeysChange}
              SenderName={SenderName}
              SenderEmail={SenderEmail}
              onChange={this.handleChangeInfo}
            />

            <div className="flow-v-10">
              <div className="t-small">{'Subject'}</div>
              <input
                style={{ width: '100%' }}
                value={Subject}
                onChange={e => this.handleChangeInfo('Subject', e.target.value)}
                placeholder="Subject"
                type="text"
              />
            </div>

            <div className="flow-v-10">
              <div className="t-small">
                {'Target Emails'}
                {!!TargetEmails.length && ` (${TargetEmails.length})`}
                {':'}
              </div>
              <div onPaste={this.handlePaste}>
                <CreatableSelect
                  unstyled
                  className="SelectDark"
                  classNamePrefix="Select"
                  isMulti
                  value={TargetEmails.map(email => ({ label: email, value: email }))}
                  options={emails}
                  formatOptionLabel={this.renderOption}
                  onChange={this.handleChangeTargetEmails}
                  formatCreateLabel={inputValue => (
                    <span>
                      <IconAdd className="mr-5" />
                      {'Add '}
                      <b>{inputValue}</b>
                    </span>
                  )}
                />
              </div>
            </div>

            <input type="submit" style={{ display: 'none' }} />
          </form>

          <div className="ModalFooter">
            <Button primary onClick={this.handleSubmit} disabled={!this.isValid() || isSending}>
              {isSending ? 'Sending…' : 'Send'}
            </Button>
            <Button variant="secondary" onClick={this.handleClose}>
              {'Cancel'}
            </Button>
          </div>
        </Modal>
      )
    }
  },
)
