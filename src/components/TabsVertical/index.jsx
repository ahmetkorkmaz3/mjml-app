import { PureComponent, Children, createElement } from 'react'
import cx from 'classnames'

import './style.scss'

class TabsVertical extends PureComponent {
  // initialTab: the title of the tab to show first
  state = {
    index: Math.max(
      0,
      Children.toArray(this.props.children).findIndex(c => c.props.title === this.props.initialTab),
    ),
  }

  handleSetTab = index => this.setState({ index })

  handleKeyDown = (e, count) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
      return
    }
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    const index = (this.state.index + step + count) % count
    this.setState({ index })
    const tabs = e.currentTarget.querySelectorAll('.TabsVertical--Tab')
    if (tabs[index]) {
      tabs[index].focus()
    }
  }

  render() {
    const { children } = this.props

    const { index } = this.state

    const childs = Children.toArray(children)
    const tabToDisplay = childs[index]

    return (
      <div className="TabsVertical">
        <div
          className="TabsVertical--Tabs"
          role="tablist"
          aria-orientation="vertical"
          onKeyDown={e => this.handleKeyDown(e, childs.length)}
        >
          {childs.map(({ props: { title, icon } }, i) => (
            <button
              type="button"
              role="tab"
              aria-selected={i === index}
              tabIndex={i === index ? 0 : -1}
              key={title}
              className={cx('TabsVertical--Tab', {
                isActive: i === index,
              })}
              onClick={() => this.handleSetTab(i)}
            >
              {!!icon && createElement(icon, { className: 'TabsVertical--icon', size: 15 })}
              {title}
            </button>
          ))}
        </div>
        <div className="TabsVertical--View" role="tabpanel">
          {tabToDisplay}
        </div>
      </div>
    )
  }
}

export class TabItem extends PureComponent {
  render() {
    const { children, className } = this.props

    return <div className={className}>{children}</div>
  }
}

export default TabsVertical
