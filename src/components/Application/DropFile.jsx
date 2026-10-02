import cx from 'classnames'
import { MdFileDownload as IconDrop } from 'react-icons/md'

export default function DropFile({ isVisible, ...props }) {
  return (
    <div {...props} className={cx('DropFile', { isVisible })}>
      <div className="DropFile--border" />
      <div className="d-f fd-c jc-c ai-c" style={{ pointerEvents: 'none' }}>
        <div className="DropFile--icon">
          <IconDrop className="mb-20" size={100} />
        </div>
        <div className="DropFile--label">{'Drop here'}</div>
      </div>
    </div>
  )
}
