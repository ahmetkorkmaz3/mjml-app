import { Component } from 'react'
import { connect } from 'react-redux'

import Button from 'components/Button'
import { MdError as IconError } from 'react-icons/md'

import { addSnippet, updateSnippet } from 'actions/snippets'

import { getSnippetErrors } from './validate'

function FieldError({ children }) {
  return (
    <div className="t-small mt-10 c-red">
      <IconError className="mr-5 mb-5" />
      {children}
    </div>
  )
}

export default connect(
  state => ({
    snippets: state.settings.get('snippets'),
  }),
  {
    addSnippet,
    updateSnippet,
  },
)(
  class SnippetForm extends Component {
    static defaultProps = {
      name: '',
      trigger: '',
      content: '',
    }

    // the fields start with the values of the edited snippet
    state = {
      snippetName: this.props.name,
      snippetTrigger: this.props.trigger,
      snippetContent: this.props.content,
    }

    getErrors() {
      const { snippets, snippetIsEdited, name } = this.props
      const { snippetName, snippetTrigger, snippetContent } = this.state
      return getSnippetErrors(
        { name: snippetName, trigger: snippetTrigger, content: snippetContent },
        snippets ? snippets.toArray() : [],
        snippetIsEdited ? name : null,
      )
    }

    handleChangeName = e => this.setState({ snippetName: e.target.value })

    handleChangeTrigger = e => this.setState({ snippetTrigger: e.target.value })

    handleChangeContent = e => this.setState({ snippetContent: e.target.value })

    handleSubmit = e => {
      e && e.preventDefault()
      if (Object.keys(this.getErrors()).length) {
        return
      }
      const { snippetIsEdited, name } = this.props
      const { snippetName, snippetTrigger, snippetContent } = this.state
      if (snippetIsEdited) {
        this.props.updateSnippet(name, snippetName.trim(), snippetTrigger.trim(), snippetContent)
        return
      }
      this.props.addSnippet(snippetName.trim(), snippetTrigger.trim(), snippetContent)
      this.setState({ snippetName: '', snippetTrigger: '', snippetContent: '' })
    }

    render() {
      const { snippetName, snippetContent, snippetTrigger } = this.state
      const { snippetIsEdited } = this.props
      const errors = this.getErrors()
      const hasErrors = Object.keys(errors).length > 0

      return (
        <div className="mb-20">
          <form className="mt-20" onSubmit={this.handleSubmit}>
            <div className="flow-v-20">
              <div className="d-f ai-b">
                <div style={{ width: 120 }} className="fs-0">
                  {'Snippet Name:'}
                </div>
                <input
                  className="fg-1"
                  onChange={this.handleChangeName}
                  placeholder="Name"
                  value={snippetName}
                  type="text"
                  autoFocus
                />
              </div>
              {/* the "required" errors only disable the button */}
              {snippetName.trim() && errors.name && <FieldError>{errors.name}</FieldError>}

              <div className="d-f ai-b">
                <div style={{ width: 120 }} className="fs-0">
                  {'Snippet Trigger:'}
                </div>
                <input
                  className="fg-1"
                  onChange={this.handleChangeTrigger}
                  placeholder="Trigger"
                  value={snippetTrigger}
                  type="text"
                />
              </div>
              {snippetTrigger.trim() && errors.trigger && <FieldError>{errors.trigger}</FieldError>}
              <div className="d-b">
                <div style={{ width: 120 }} className="fs-0">
                  {'Snippet Content:'}
                </div>
                <div className="fg-1 mt-20 mb-20">
                  <textarea
                    onChange={this.handleChangeContent}
                    placeholder="Content"
                    value={snippetContent}
                  />
                </div>
              </div>
            </div>
          </form>
          <Button disabled={hasErrors} primary onClick={this.handleSubmit}>
            {snippetIsEdited ? 'Update Snippet' : 'Create Snippet'}
          </Button>
        </div>
      )
    }
  },
)
