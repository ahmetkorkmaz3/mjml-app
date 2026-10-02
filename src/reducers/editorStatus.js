import { createAction, handleActions } from 'redux-actions'

// what the status bar shows about the open file
const initialState = { line: 1, col: 1, isDirty: false, isRendering: false, renderMs: null }

export default handleActions(
  {
    EDITOR_STATUS_SET: (state, { payload }) => ({ ...state, ...payload }),
    EDITOR_STATUS_RESET: () => initialState,
  },
  initialState,
)

export const setEditorStatus = createAction('EDITOR_STATUS_SET')
export const resetEditorStatus = createAction('EDITOR_STATUS_RESET')
