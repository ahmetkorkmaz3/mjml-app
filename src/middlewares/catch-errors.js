import { setError } from 'reducers/error'
import { addAlert } from 'reducers/alerts'

const shown = new WeakSet()

// an error that an async thunk does not catch shows once as an alert
function showAsyncError(store, err) {
  console.error(err)
  if (err && typeof err === 'object') {
    // a thunk that awaits another thunk gets the same error
    if (shown.has(err)) return
    shown.add(err)
  }
  store.dispatch(addAlert((err && err.message) || String(err), 'error'))
}

export default store => next => action => {
  try {
    const result = next(action)
    if (result && typeof result.then === 'function') {
      // the callers still get the rejected promise
      result.then(undefined, err => showAsyncError(store, err))
    }
    return result
  } catch (err) {
    store.dispatch(setError(err))
    console.error(err)
  }
}
