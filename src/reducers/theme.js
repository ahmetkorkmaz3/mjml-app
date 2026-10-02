import { createAction, handleActions } from 'redux-actions'

// the resolved theme ('light' or 'dark'), for the code that needs it in JS
// (CodeMirror). The CSS uses the data-theme attribute of <html>.
export default handleActions(
  {
    THEME_RESOLVED: (state, { payload }) => payload,
  },
  window.api.initialTheme,
)

export const setResolvedTheme = createAction('THEME_RESOLVED')
