import { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import cx from 'classnames'

import api from 'helpers/api'
import { updateSettings } from 'actions/settings'
import { PROVIDERS, PROVIDER_IDS } from 'data/aiProviders'

import Button from 'components/Button'
import CheckBox from 'components/CheckBox'
import RadioGroup from 'components/RadioGroup'
import Radio from 'components/RadioGroup/Radio'

const LABEL_WIDTH = 150

function Row({ label, children }) {
  return (
    <div className="d-f ai-c">
      <div style={{ width: LABEL_WIDTH }} className="fs-0 t-small">
        {label}
      </div>
      <div className="fg-1 d-f ai-c">{children}</div>
    </div>
  )
}

function SecretInput({ name, label }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let alive = true
    setMessage(null)
    api.secrets.has(name).then(has => alive && setSaved(Boolean(has)))
    return () => {
      alive = false
    }
  }, [name])

  const save = async next => {
    const res = await api.secrets.set(name, next)
    if (res.error) {
      setMessage(res.error.message)
      return
    }
    setSaved(Boolean(next))
    setValue('')
    setMessage(next ? 'Saved' : 'Removed')
  }

  return (
    <Row label={label}>
      <input
        className="fg-1"
        type="password"
        value={value}
        placeholder={saved ? 'Saved (type to replace)' : 'Not set'}
        onChange={e => setValue(e.target.value.trim())}
      />
      <Button className="ml-5" ghost disabled={!value} onClick={() => save(value)}>
        {'Save'}
      </Button>
      {saved && (
        <Button className="ml-5" transparent onClick={() => save('')}>
          {'Remove'}
        </Button>
      )}
      {message && <span className="ml-5 t-small">{message}</span>}
    </Row>
  )
}

function TestConnection({ run }) {
  const [result, setResult] = useState(null)

  const test = async () => {
    setResult({ ok: true, message: 'Testing...' })
    setResult(await run())
  }

  return (
    <div className="d-f ai-c">
      <Button ghost onClick={test}>
        {'Test connection'}
      </Button>
      {result && (
        <span className={cx('ml-10 t-small', { 'c-red': !result.ok })}>{result.message}</span>
      )}
    </div>
  )
}

function AIFigmaSettings({ ai, figma, updateSettings }) {
  const [encryption, setEncryption] = useState(true)

  useEffect(() => {
    api.secrets.isAvailable().then(setEncryption)
  }, [])

  const provider = ai.get('provider')
  const info = PROVIDERS[provider] || PROVIDERS.anthropic
  const setValue = (group, key) => value => updateSettings(s => s.setIn([group, key], value))
  const onInput = (group, key) => e => setValue(group, key)(e.target.value.trim())

  return (
    <div className="flow-v-10">
      {!encryption && (
        <div className="t-small c-red">
          {'The system keychain is not available. The app cannot save API keys on this system.'}
        </div>
      )}

      <div className="mt-10">{'AI provider:'}</div>
      <Row label="Provider:">
        <select className="fg-1" value={provider} onChange={onInput('ai', 'provider')}>
          {PROVIDER_IDS.map(id => (
            <option key={id} value={id}>
              {PROVIDERS[id].label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Model:">
        <input
          className="fg-1"
          value={ai.get('model')}
          placeholder={info.defaultModel || 'for example llama3.2'}
          onChange={onInput('ai', 'model')}
        />
      </Row>
      {provider === 'openai-compatible' && (
        <>
          <Row label="Base URL:">
            <input
              className="fg-1"
              value={ai.get('baseURL')}
              placeholder="http://localhost:11434/v1"
              onChange={onInput('ai', 'baseURL')}
            />
          </Row>
          <div className="t-small" style={{ marginLeft: LABEL_WIDTH }}>
            {'Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1 · '}
            {'OpenRouter: https://openrouter.ai/api/v1'}
          </div>
        </>
      )}
      <SecretInput
        key={provider}
        name={`ai.${provider}`}
        label={info.needsKey ? 'API key:' : 'API key (optional):'}
      />
      {info.keyURL && (
        <div className="t-small" style={{ marginLeft: LABEL_WIDTH }}>
          <a
            href=""
            className="a c-blue"
            onClick={e => {
              e.preventDefault()
              api.shell.openExternal(info.keyURL)
            }}
          >
            {'Get an API key'}
          </a>
        </div>
      )}
      <CheckBox value={ai.get('visualCheck')} onChange={setValue('ai', 'visualCheck')}>
        {'Compare the result with the design and fix it (one more model call)'}
      </CheckBox>
      <TestConnection run={() => api.ai.testConnection(ai.toJS())} />

      <div className="mt-20">{'Figma source:'}</div>
      <RadioGroup value={figma.get('source')} onChange={setValue('figma', 'source')}>
        <Radio value="mcp">
          <div className="flow-v-10">
            <div>{'Figma desktop MCP server (open the file in the Figma desktop app)'}</div>
            {figma.get('source') === 'mcp' && (
              <input
                className="fg-1"
                value={figma.get('mcpURL')}
                onChange={onInput('figma', 'mcpURL')}
              />
            )}
          </div>
        </Radio>
        <Radio value="rest">{'Figma REST API (works on the free plan)'}</Radio>
      </RadioGroup>
      <SecretInput name="figma.token" label="Figma token:" />
      <div className="t-small" style={{ marginLeft: LABEL_WIDTH }}>
        <a
          href=""
          className="a c-blue"
          onClick={e => {
            e.preventDefault()
            api.shell.openExternal('https://www.figma.com/developers/api#access-tokens')
          }}
        >
          {'Create a personal access token'}
        </a>
        {' · The REST source and the "Try REST" fallback use it.'}
      </div>
      <TestConnection run={() => api.figma.testConnection(figma.toJS())} />
    </div>
  )
}

export default connect(
  state => ({
    ai: state.settings.get('ai'),
    figma: state.settings.get('figma'),
  }),
  { updateSettings },
)(AIFigmaSettings)
