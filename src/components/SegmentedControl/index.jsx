import cx from 'classnames'

import './style.scss'

export default function SegmentedControl({ value, options, onChange, disabled, className }) {
  return (
    <div className={cx('SegmentedControl', className, { isDisabled: disabled })} role="radiogroup">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.label ? undefined : o.tooltip}
          disabled={disabled}
          data-tooltip={o.tooltip}
          className={cx('SegmentedControl--item', { isActive: o.value === value })}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.icon}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}
