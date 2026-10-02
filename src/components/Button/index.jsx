import { Link } from 'react-router'
import cx from 'classnames'

import './style.scss'

// the old boolean props map to the variants, so each file can move at its own speed
function getVariant({ variant, primary, warn, ghost, transparent }) {
  if (variant) return variant
  if (primary) return 'primary'
  if (warn) return 'danger'
  if (ghost || transparent) return 'ghost'
  return 'secondary'
}

// `ref` is a regular prop since React 19
export default function Button({
  link,
  variant,
  size,
  icon,
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
  const cn = cx(
    'Button',
    `Button--${getVariant({ variant, primary, warn, ghost, transparent })}`,
    `Button--${size || (small ? 'sm' : 'md')}`,
    className,
    { 'Button--icon': icon, unclickable },
  )

  const p = {
    className: cn,
    disabled,
    tabIndex: unclickable ? undefined : 0,
    type: link || unclickable ? undefined : 'button',
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
