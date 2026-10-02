import { useEffect, useRef, useState } from 'react'
import { connect } from 'react-redux'
import { MdAutorenew as IconChecking, MdError as IconError } from 'react-icons/md'

import api, { path } from 'helpers/api'
import { fileExists } from 'helpers/fs'
import { isModalOpened, closeModal, openModal } from 'reducers/modals'

import Modal from 'components/Modal'
import Button from 'components/Button'

export const STEP_LABELS = {
  parse: 'Checking the settings',
  figma: 'Reading the Figma design',
  assets: 'Downloading the images',
  generate: 'Writing MJML with AI',
  validate: 'Fixing MJML errors',
  'visual-check': 'Comparing the result with the design',
  write: 'Saving the file',
}

export const SETTINGS_CODES = [
  'AI_KEY_MISSING',
  'AI_UNAUTHORIZED',
  'AI_MODEL_MISSING',
  'AI_BASE_URL_MISSING',
  'AI_PROVIDER_UNKNOWN',
  'FIGMA_TOKEN_MISSING',
  'FIGMA_FORBIDDEN',
  'ENCRYPTION_UNAVAILABLE',
]
const REST_FALLBACK_CODES = ['FIGMA_MCP_UNAVAILABLE', 'FIGMA_MCP_LIMIT']
const NAME_RE = /^[\w.-]+$/

function FigmaImportModal({ isOpened, rootPath, ai, figma, closeModal, openModal, onImported }) {
  const [link, setLink] = useState('')
  const [fileName, setFileName] = useState('figma')
  const [exists, setExists] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const isRunning = useRef(false)

  useEffect(() => {
    if (isOpened) {
      api.secrets.has('figma.token').then(setHasToken)
    }
  }, [isOpened])

  useEffect(() => api.on('figma-import-progress', p => isRunning.current && setProgress(p)), [])

  useEffect(() => {
    let alive = true
    if (!NAME_RE.test(fileName)) {
      setExists(false)
      return
    }
    fileExists(path.join(rootPath, `${fileName}.mjml`)).then(v => alive && setExists(v))
    return () => {
      alive = false
    }
  }, [isOpened, rootPath, fileName])

  const isNameValid = NAME_RE.test(fileName) && !exists
  const canSubmit = Boolean(link.trim()) && isNameValid && !progress

  const run = async source => {
    setError(null)
    setProgress({ step: 'parse' })
    isRunning.current = true
    let res
    try {
      res = await api.figma.import({
        link: link.trim(),
        projectPath: rootPath,
        fileName: `${fileName}.mjml`,
        ai: ai.toJS(),
        figma: { ...figma.toJS(), source },
      })
    } catch (err) {
      res = { error: { code: 'UNKNOWN', message: err.message } }
    } finally {
      isRunning.current = false
      setProgress(null)
    }

    if (res.error) {
      if (res.error.code !== 'CANCELLED') {
        setError(res.error)
      }
      return
    }
    closeModal('figmaImport')
    setLink('')
    onImported(res)
  }

  const handleSubmit = e => {
    e.preventDefault()
    if (canSubmit) {
      run(figma.get('source'))
    }
  }

  const handleClose = () => {
    if (progress) {
      api.figma.cancel()
    }
    setError(null)
    closeModal('figmaImport')
  }

  const openSettings = () => {
    closeModal('figmaImport')
    openModal('settings')
  }

  return (
    <Modal isOpened={isOpened} onClose={progress ? () => {} : handleClose}>
      <div className="Modal--label">{'Import from Figma'}</div>

      <form className="flow-v-20" onSubmit={handleSubmit}>
        <div className="d-f ai-b">
          <div style={{ width: 150 }} className="fs-0">
            {'Figma link:'}
          </div>
          <input
            className="fg-1"
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="https://www.figma.com/design/...?node-id=..."
            disabled={Boolean(progress)}
            autoFocus
          />
        </div>
        <div className="d-f ai-b">
          <div style={{ width: 150 }} className="fs-0">
            {'File name:'}
          </div>
          <div className="fg-1">
            <div className="d-f ai-c">
              <input
                className="fg-1"
                value={fileName}
                onChange={e => setFileName(e.target.value.trim())}
                disabled={Boolean(progress)}
              />
              <div className="ml-5">{'.mjml'}</div>
            </div>
            {exists && (
              <div className="t-small mt-10 c-red">
                <b className="mr-5">{`${fileName}.mjml`}</b>
                {'already exists'}
              </div>
            )}
          </div>
        </div>
        <div className="t-small">
          {`Source: ${figma.get('source') === 'rest' ? 'Figma REST API' : 'Figma desktop MCP'} · `}
          {`AI: ${ai.get('provider')}${ai.get('model') ? ` (${ai.get('model')})` : ''}`}
        </div>
        {figma.get('source') !== 'rest' && (
          <div className="t-small">
            {'The file in the link must be the active tab in the Figma desktop app.'}
          </div>
        )}

        {progress && (
          <div className="t-small">
            <IconChecking className="rotating mr-5" />
            {STEP_LABELS[progress.step] || progress.step}
            {progress.detail ? ` (${progress.detail})` : ''}
          </div>
        )}

        {error && (
          <div className="t-small c-red flow-v-10">
            <div>
              <IconError className="mr-5 mb-5" />
              {error.message}
            </div>
            <div className="d-f flow-h-10">
              {SETTINGS_CODES.includes(error.code) && (
                <Button ghost onClick={openSettings}>
                  {'Open settings'}
                </Button>
              )}
              {REST_FALLBACK_CODES.includes(error.code) && hasToken && (
                <Button ghost onClick={() => run('rest')}>
                  {'Try REST'}
                </Button>
              )}
            </div>
          </div>
        )}
      </form>

      <div className="ModalFooter">
        <Button primary onClick={handleSubmit} disabled={!canSubmit}>
          {'Import'}
        </Button>
        <Button transparent onClick={progress ? () => api.figma.cancel() : handleClose}>
          {progress ? 'Stop' : 'Cancel'}
        </Button>
      </div>
    </Modal>
  )
}

export default connect(
  state => ({
    isOpened: isModalOpened(state, 'figmaImport'),
    ai: state.settings.get('ai'),
    figma: state.settings.get('figma'),
  }),
  { closeModal, openModal },
)(FigmaImportModal)
