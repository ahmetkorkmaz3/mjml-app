import { Component } from 'react'
import cx from 'classnames'

import 'components/CheckBox/style.scss'

class Radio extends Component {
  handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this.props.onChange(this.props.value)
    }
  }

  render() {
    const { isActive, value, onChange, children } = this.props

    return (
      <div
        className="d-f ai-fs t-small focus Radio"
        tabIndex={0}
        role="radio"
        aria-checked={!!isActive}
        onKeyDown={isActive ? undefined : this.handleKeyDown}
        onClick={isActive ? undefined : () => onChange(value)}
      >
        <span className={cx('Radio--box', { isChecked: isActive })} />
        <div className="fg-1">{children}</div>
      </div>
    )
  }
}

export default Radio
