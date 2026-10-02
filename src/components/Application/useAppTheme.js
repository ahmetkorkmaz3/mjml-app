import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import api from 'helpers/api'
import { resolveTheme } from 'helpers/theme'
import { setResolvedTheme } from 'reducers/theme'

const query = window.matchMedia('(prefers-color-scheme: dark)')

// Applies the theme setting: the data-theme attribute of <html> (CSS),
// the redux state (CodeMirror) and nativeTheme in the main process
// (menus, dialogs, scroll bars, window buttons).
export default function useAppTheme() {
  const dispatch = useDispatch()
  const setting = useSelector(state =>
    state.settings ? state.settings.getIn(['appearance', 'theme'], 'system') : null,
  )

  useEffect(() => {
    if (!setting) {
      return
    }
    api.theme.set(setting).catch(err => console.error(err))

    const apply = () => {
      const theme = resolveTheme(setting, query.matches)
      document.documentElement.dataset.theme = theme
      dispatch(setResolvedTheme(theme))
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [setting, dispatch])
}
