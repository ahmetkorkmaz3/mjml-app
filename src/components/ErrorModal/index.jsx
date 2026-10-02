import { Component } from 'react'
import { connect } from 'react-redux'
import { MdContentCopy as IconCopy, MdOpenInNew as IconOpen } from 'react-icons/md'

import api from 'helpers/api'
import { setError } from 'reducers/error'
import { addAlert } from 'reducers/alerts'

import Modal from 'components/Modal'
import Button from 'components/Button'

import './style.scss'

export default connect(
  state => ({
    error: state.error,
  }),
  {
    setError,
    addAlert,
  },
)(
  class ErrorModal extends Component {
    state = {
      // store a reference to error, to provide flash when modal is closing
      error: null,
    }

    static getDerivedStateFromProps(props, state) {
      if (props.error && props.error !== state.error) {
        return { error: props.error }
      }
      return null
    }

    handleCopyStack = () => {
      const { error, addAlert } = this.props
      if (!error) {
        return
      }
      api.clipboard.writeText(error.stack)
      addAlert('Copied!', 'success')
    }

    render() {
      const { error, setError } = this.props

      const { error: errorCopy } = this.state

      const stack = errorCopy ? errorCopy.stack : ''

      return (
        <Modal
          isOpened={!!error}
          onClose={() => setError(null)}
          title="Something went wrong"
          className="ErrorModal flow-v-10"
        >
          <p className="ErrorModal--text">
            {
              'The application code threw an error. You can report it on GitHub with the details below.'
            }
          </p>
          <pre>{stack}</pre>
          <div className="ModalFooter">
            <Button
              variant="primary"
              onClick={() => api.shell.openExternal('https://github.com/mjmlio/mjml-app/issues')}
            >
              <IconOpen />
              {'Report the Issue'}
            </Button>
            <Button variant="secondary" onClick={this.handleCopyStack}>
              <IconCopy />
              {'Copy Details'}
            </Button>
            <Button variant="ghost" onClick={() => setError(null)} className="mr-auto">
              {'Close'}
            </Button>
          </div>
        </Modal>
      )
    }
  },
)
