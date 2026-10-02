import { useEffect, useRef, useState } from 'react'
import { connect } from 'react-redux'
import { MdAutorenew as IconChecking, MdError as IconError } from 'react-icons/md'

import api from 'helpers/api'
import { addAlert } from 'reducers/alerts'
import { isModalOpened, closeModal, openModal } from 'reducers/modals'

import Modal from 'components/Modal'
import Button from 'components/Button'

import { SETTINGS_CODES, STEP_LABELS } from './FigmaImportModal'

function RefineModal({
  isOpened,
  filePath,
  rootPath,
  getEditor,
  ai,
  closeModal,
  openModal,
  addAlert,
}) {
  const [instruction, setInstruction] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const isRunning = useRef(false)

  useEffect(() => api.on('figma-import-progress', p => isRunning.current && setProgress(p)), [])

  const canSubmit = Boolean(instruction.trim()) && Boolean(filePath) && !progress

  const handleSubmit = async e => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }
    const editor = getEditor()
    if (!editor) {
      setError({
        code: 'UNKNOWN',
        message: 'The editor is not ready. Open the file and try again.',
      })
      return
    }
    setError(null)
    setProgress({ step: 'generate' })
    isRunning.current = true
    let res
    try {
      res = await api.figma.refine({
        filePath,
        rootPath,
        content: editor.getContent(),
        instruction: instruction.trim(),
        ai: ai.toJS(),
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
    editor.setContent(res.content)
    closeModal('refine')
    setInstruction('')
    addAlert(
      `Done: ${res.usage.inputTokens} input tokens, ${res.usage.outputTokens} output tokens. Undo reverts the change.`,
      'success',
    )
    if (res.warnings.length) {
      addAlert(['Refine warnings:', ...res.warnings.map(w => `■ ${w}`)], 'info', {
        autoHide: false,
      })
    }
  }

  const handleClose = () => {
    if (progress) {
      api.figma.cancel()
    }
    setError(null)
    closeModal('refine')
  }

  return (
    <Modal isOpened={isOpened} onClose={progress ? () => {} : handleClose}>
      <div className="Modal--label">{'Refine with AI'}</div>

      <form className="flow-v-20" onSubmit={handleSubmit}>
        <textarea
          className="fg-1"
          style={{ width: '100%', minHeight: 100 }}
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="For example: make the button full width and use a 16px font"
          disabled={Boolean(progress)}
          autoFocus
        />

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
            {SETTINGS_CODES.includes(error.code) && (
              <Button
                ghost
                onClick={() => {
                  closeModal('refine')
                  openModal('settings', { tab: 'AI & Figma' })
                }}
              >
                {'Open settings'}
              </Button>
            )}
          </div>
        )}
      </form>

      <div className="ModalFooter">
        <Button primary onClick={handleSubmit} disabled={!canSubmit}>
          {'Refine'}
        </Button>
        <Button variant="secondary" onClick={progress ? () => api.figma.cancel() : handleClose}>
          {progress ? 'Stop' : 'Cancel'}
        </Button>
      </div>
    </Modal>
  )
}

export default connect(
  state => ({
    isOpened: isModalOpened(state, 'refine'),
    ai: state.settings.get('ai'),
  }),
  { closeModal, openModal, addAlert },
)(RefineModal)
