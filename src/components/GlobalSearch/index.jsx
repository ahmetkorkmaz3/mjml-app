import { PureComponent } from 'react'
import { connect } from 'react-redux'
import cx from 'classnames'
import debounce from 'lodash/debounce'
import { MdSearch as IconSearch } from 'react-icons/md'

import { searchText } from 'reducers/search'

import './style.scss'

export default connect(({ search }) => ({ search }), {
  searchText,
})(
  class GlobalSearch extends PureComponent {
    state = {
      isFocused: false,
      textCache: this.props.search.text,
    }

    componentWillUnmount() {
      this.props.searchText('')
    }

    debouncedSearch = debounce(text => this.props.searchText(text), 100)

    handleFocus = () => this.setState({ isFocused: true })

    handleBlur = () => this.setState({ isFocused: false })

    handleKeyDown = e => {
      if (e.key === 'Escape') {
        this.handleChange({ target: { value: '' } })
        e.currentTarget.blur()
      }
    }

    handleChange = e => {
      const text = e.target.value
      this.setState({ textCache: text })
      this.debouncedSearch(text)
    }

    render() {
      const { className } = this.props
      const { isFocused, textCache } = this.state
      return (
        <div
          className={cx('GlobalSearch', className, {
            isFocused,
          })}
        >
          <div className="GlobalSearch--icon-container">
            <IconSearch size={14} />
          </div>
          <input
            type="search"
            className="GlobalSearch--input"
            placeholder="Search projects"
            aria-label="Search projects"
            value={textCache}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyDown}
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
          />
        </div>
      )
    }
  },
)
