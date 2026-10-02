import cx from 'classnames'
import { MdFileDownload as IconDrop } from 'react-icons/md'

export default function DropFile({ isVisible, ...props }) {
  return (
    <div {...props} className={cx('DropFile', { isVisible })}>
      <div className="DropFile--border" />
      <div className="d-f fd-c jc-c ai-c" style={{ pointerEvents: 'none' }}>
        <div className="DropFile--icon">
          <IconDrop className="mb-10" size={48} />
        </div>
        <div className="DropFile--label">{'Drop an .mjml file or a folder to open it'}</div>
      </div>
    </div>
  )
}
