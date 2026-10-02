import { Link } from 'react-router'
import cx from 'classnames'

import './style.scss'

// `ref` is a regular prop since React 19
export default function Button({
  link,
  primary,
  ghost,
  warn,
  transparent,
  unclickable,
  className,
  children,
  disabled,
  small,
  ref,
  ...props
}) {
  const cn = cx('Button', className, {
    primary,
    ghost,
    warn,
    unclickable,
    transparent,
    small,
  })

  const p = {
    className: cn,
    disabled,
    tabIndex: unclickable ? undefined : 0,
    ...props,
    ref,
  }

  if (link) {
    return <Link {...p}>{children}</Link>
  }
  if (unclickable) {
    return <div {...p}>{children}</div>
  }
  return <button {...p}>{children}</button>
}
