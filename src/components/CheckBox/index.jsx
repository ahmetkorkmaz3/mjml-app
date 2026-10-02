import { Component } from 'react'
import cx from 'classnames'
import { MdCheck as IconCheck } from 'react-icons/md'

import './style.scss'

class CheckBox extends Component {
  handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this.props.onChange(!this.props.value)
    }
  }

  render() {
    const { value, onChange, children, className } = this.props

    return (
      <div
        tabIndex={0}
        role="checkbox"
        aria-checked={!!value}
        className={cx(className, 'Checkbox d-f ai-fs t-small focus')}
        onKeyDown={this.handleKeyDown}
        onClick={() => onChange(!value)}
      >
        <span className={cx('Checkbox--box', { isChecked: value })}>
          {value && <IconCheck size={12} />}
        </span>
        {children && <div className="fg-1">{children}</div>}
      </div>
    )
  }
}

export default CheckBox
