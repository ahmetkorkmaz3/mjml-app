import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router/dom'

import router from 'router'

export default function Root({ store }) {
  return (
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  )
}
