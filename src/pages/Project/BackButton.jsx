import { Component } from 'react'
import { MdArrowBack as FaHome } from 'react-icons/md'

import Button from 'components/Button'

class BackButton extends Component {
  state = {
    isOver: false,
  }

  handleMouseEnter = () => this.setState({ isOver: true })

  handleMouseLeave = () => this.setState({ isOver: false })

  render() {
    const { projectName } = this.props

    const { isOver } = this.state

    return (
      <Button
        className="cu-d ellipsis"
        transparent
        link
        to="/"
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        style={{ minWidth: 76 }}
      >
        <FaHome className="mr-5" />
        <div className="r d-f ai-c" style={{ height: '100%' }}>
          <b
            className="ellipsis BackButton--label"
            style={{
              transform: `translate3d(0, ${isOver ? -30 : 0}px, 0)`,
              maxWidth: 250,
            }}
          >
            {projectName}
          </b>
          <div className="sticky d-f ai-c">
            <b
              className="BackButton--label"
              style={{ transform: `translate3d(0, ${isOver ? 0 : 30}px, 0)` }}
            >
              {'Back'}
            </b>
          </div>
        </div>
      </Button>
    )
  }
}

export default BackButton
