import cx from 'classnames'

import api, { path } from 'helpers/api'
import { displayPath, formatRelativeTime } from 'helpers/projects'

import Preview from 'components/Preview'

export default function ProjectItem({ project, isSelected, onClick, onOpen, onContextMenu }) {
  const name = path.basename(project.path)
  const time = formatRelativeTime(project.mtime, Date.now())
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cx('ProjectCard', { isSelected })}
      onClick={onClick}
      onDoubleClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      onContextMenu={onContextMenu}
    >
      <div className="ProjectCard--thumb">
        <Preview scaled html={project.html || null} iframeBase={project.path} />
      </div>
      <div className="ProjectCard--name" title={name}>
        {name}
      </div>
      <div className="ProjectCard--meta" title={project.path}>
        <span className="ellipsis">{displayPath(project.path, api.homedir, path.sep)}</span>
        {time && <span className="ProjectCard--time">{`· ${time}`}</span>}
      </div>
    </div>
  )
}
