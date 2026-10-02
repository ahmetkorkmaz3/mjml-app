import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import cx from 'classnames'

import useTransition from './useTransition'

import './style.scss'

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export default function Modal({
  isOpened,
  onClose,
  children,
  className,
  style,
  noUI,
  size = 'md',
  title,
}) {
  const { isMounted, isVisible } = useTransition(isOpened, 200)
  const bodyRef = useRef(null)
  const openerRef = useRef(null)

  // keep the element that had the focus, and give it back on close
  useEffect(() => {
    if (!isOpened) {
      return
    }
    openerRef.current = document.activeElement
    return () => {
      const opener = openerRef.current
      if (opener && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [isOpened])

  useEffect(() => {
    if (isOpened && isMounted && bodyRef.current) {
      const first = bodyRef.current.querySelector('[autofocus], input, textarea, select')
      ;(first || bodyRef.current).focus()
    }
  }, [isOpened, isMounted])

  useEffect(() => {
    if (!isOpened) {
      return
    }
    const handleKeyDown = e => {
      const body = bodyRef.current
      if (e.key === 'Escape' && onClose) {
        onClose()
        return
      }
      if (!body) {
        return
      }
      // the focus stays in the dialog
      if (e.key === 'Tab') {
        const focusable = [...body.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null)
        if (!focusable.length) {
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (
          e.shiftKey &&
          (document.activeElement === first || !body.contains(document.activeElement))
        ) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      // Enter does the main action (the first footer button), except in a text area, on a button or in the editor
      if (e.key === 'Enter' && !e.defaultPrevented && !e.isComposing) {
        const t = e.target
        if (t.closest && t.closest('textarea, button, a, .cm-editor, .Select__control')) {
          return
        }
        const primary = body.querySelector(
          '.ModalFooter .Button--primary:not(:disabled), .ModalFooter .Button--danger:not(:disabled)',
        )
        if (primary) {
          // also stops the implicit submit of a form, so the action runs once
          e.preventDefault()
          primary.click()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpened, onClose])

  if (!isMounted) {
    return null
  }

  return createPortal(
    <div className={cx('Modal', `Modal--${size}`, { withUI: !noUI, isVisible })}>
      <div className="Modal--overlay" onClick={onClose} />
      <div className="Modal-box">
        <div
          tabIndex={-1}
          ref={bodyRef}
          role="dialog"
          aria-modal="true"
          className={cx('Modal--body', className)}
          style={style}
        >
          {title && <div className="Modal--label">{title}</div>}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
