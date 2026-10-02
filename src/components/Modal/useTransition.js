import { useEffect, useState } from 'react'

// Keep an element mounted during its exit transition.
// Returns `isMounted` (render the element) and `isVisible` (apply the
// "visible" styles, one frame after the mount so the CSS transition runs).
export default function useTransition(isOpened, duration = 300) {
  const [isMounted, setIsMounted] = useState(isOpened)
  const [isVisible, setIsVisible] = useState(false)

  // mount during the render (not in an effect): the parent components can
  // then use the DOM of the content in their componentDidUpdate
  if (isOpened && !isMounted) {
    setIsMounted(true)
  }

  useEffect(() => {
    if (isOpened) {
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setIsVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }
    setIsVisible(false)
    const timeout = setTimeout(() => setIsMounted(false), duration)
    return () => clearTimeout(timeout)
  }, [isOpened, duration])

  return { isMounted: isMounted || isOpened, isVisible }
}
