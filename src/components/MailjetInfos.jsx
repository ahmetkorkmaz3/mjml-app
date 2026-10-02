import { Component, useState } from 'react'
import { Collapse } from 'react-collapse'

import { MdInfo as IconInfo } from 'react-icons/md'
import api from 'helpers/api'
import Button from 'components/Button'
import LogoMailjet from 'components/icons/logo-mailjet'

// The keys are encrypted by the main process (secrets.js). The renderer can
// save or remove a key and ask if it is saved, it cannot read it.
const KEYS = [
  { name: 'mailjet.apiKey', label: 'Mailjet API Key:' },
  { name: 'mailjet.apiSecret', label: 'Mailjet API Secret:' },
]

function SecretField({ name, label, saved, onSaved }) {
  const [value, setValue] = useState('')
  const [message, setMessage] = useState(null)

  const save = async next => {
    const res = await api.secrets.set(name, next)
    if (res && res.error) {
      setMessage(res.error.message)
      return
    }
    setValue('')
    setMessage(next ? 'Saved' : 'Removed')
    onSaved(name, Boolean(next))
  }

  return (
    <div className="d-f ai-b">
      <div style={{ width: 150 }} className="fs-0 t-small">
        {!saved && <span className="red-star">{'*'}</span>}
        {label}
      </div>
      <div className="fg-1 d-f ai-c">
        <input
          className="fg-1"
          type="password"
          value={value}
          placeholder={saved ? 'Saved (type to replace)' : 'Not set'}
          onChange={e => setValue(e.target.value.trim())}
          onKeyDown={e => {
            // Enter saves the key, it does not send the email
            if (e.key === 'Enter') {
              e.preventDefault()
              if (value) save(value)
            }
          }}
        />
        <Button className="ml-5" variant="secondary" disabled={!value} onClick={() => save(value)}>
          {'Save'}
        </Button>
        {saved && (
          <Button className="ml-5" variant="ghost" onClick={() => save('')}>
            {'Remove'}
          </Button>
        )}
        {message && <span className="ml-5 t-small">{message}</span>}
      </div>
    </div>
  )
}

class MailjetInfos extends Component {
  state = {
    isOpened: !this.props.SenderName || !this.props.SenderEmail,
    // true for each saved key (the main process answers after the mount)
    saved: {},
  }

  componentDidMount() {
    this._unmounted = false
    Promise.all(KEYS.map(({ name }) => api.secrets.has(name))).then(values => {
      if (this._unmounted) {
        return
      }
      const saved = Object.fromEntries(KEYS.map(({ name }, i) => [name, Boolean(values[i])]))
      this.setSaved(saved)
      if (!values.every(Boolean)) {
        this.setState({ isOpened: true })
      }
    })
  }

  componentWillUnmount() {
    this._unmounted = true
  }

  setSaved(saved) {
    this.setState({ saved })
    this.props.onKeysChange(KEYS.every(({ name }) => saved[name]))
  }

  handleKeySaved = (name, isSaved) => this.setSaved({ ...this.state.saved, [name]: isSaved })

  handleOpenInfos = e => {
    e.preventDefault()
    e.stopPropagation()
    this.setState({ isOpened: true })
  }

  handleChangeInput = key => e => {
    this.props.onChange(key, e.target.value.trim())
  }

  handleGoToMailjet = e => {
    e.preventDefault()
    e.stopPropagation()
    api.shell.openExternal('https://app.mailjet.com/signup')
  }

  render() {
    const { SenderName, SenderEmail } = this.props

    const { isOpened, saved } = this.state

    return (
      <div className="brand">
        <Collapse isOpened={!isOpened}>
          <div className="d-f ai-c p-20">
            <div
              className="d-f ai-c jc-c"
              style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}
            >
              <LogoMailjet height={30} className="mr-20" />
              <div className="mr-10 t-small" style={{ lineHeight: '18px' }}>
                <span>
                  {'Sending from '}
                  <b className="us-t ff-m">{SenderEmail}</b>
                </span>
                <br />
                <span>{'Using the saved API key'}</span>
                <br />
                <a href="" className="a c-blue t-small" onClick={this.handleOpenInfos}>
                  {'Edit informations'}
                </a>
              </div>
            </div>
          </div>
        </Collapse>

        <Collapse isOpened={isOpened}>
          <div className="p-20">
            <div className="mb-20 d-f ai-c">
              <LogoMailjet height={20} className="mr-20 anim-mailjet" />
              <div className="t-small" style={{ lineHeight: '18px' }}>
                <span>{'MJML App uses the Mailjet API to send emails. '}</span>
                <a href="" onClick={this.handleGoToMailjet} className="a white">
                  {'Create your account'}
                </a>
              </div>
            </div>
            <div className="flow-v-20">
              {KEYS.map(({ name, label }) => (
                <SecretField
                  key={name}
                  name={name}
                  label={label}
                  saved={!!saved[name]}
                  onSaved={this.handleKeySaved}
                />
              ))}

              <div className="d-f ai-b">
                <div style={{ width: 150 }} className="fs-0 t-small">
                  {!SenderName && <span className="red-star">{'*'}</span>}
                  {'Sender Name:'}
                </div>
                <input
                  className="fg-1"
                  value={SenderName}
                  onChange={e => this.props.onChange('SenderName', e.target.value)}
                  placeholder="Sender Name"
                  type="text"
                />
              </div>

              <div className="d-f ai-b">
                <div style={{ width: 150 }} className="fs-0 t-small">
                  {!SenderEmail && <span className="red-star">{'*'}</span>}
                  {'Sender Email:'}
                </div>
                <div className="d-f fd-c fg-1">
                  <input
                    value={SenderEmail}
                    onChange={this.handleChangeInput('SenderEmail')}
                    placeholder="Sender Email"
                    type="text"
                  />
                  <div className="t-small mt-10 ta-r d-f ai-c flow-h-5">
                    <IconInfo />
                    <div>{'Must be a verified sender. '}</div>
                    <div
                      className="a white"
                      onClick={() =>
                        api.shell.openExternal('https://app.mailjet.com/account/sender')
                      }
                    >
                      {'Learn more'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Collapse>
      </div>
    )
  }
}

export default MailjetInfos
