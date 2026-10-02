import { configureStore } from '@reduxjs/toolkit'
import { createLogger } from 'redux-logger'

import rootReducer from 'reducers'
import catchErrorsMiddleware from 'middlewares/catch-errors'

export default function createStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware => {
      // the state uses Immutable.js and some actions carry functions,
      // so the serializability and immutability checks do not apply
      const middlewares = getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }).prepend(catchErrorsMiddleware)

      if (import.meta.env.DEV) {
        return middlewares.concat(createLogger({ level: 'info', collapsed: true }))
      }
      return middlewares
    },
    devTools: import.meta.env.DEV,
  })
}
