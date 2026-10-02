import { useEffect } from 'react'

import api from 'helpers/api'

// tells the main process which menu items apply to the page that is open
export default function useMenuContext(context) {
  const key = JSON.stringify(context)
  useEffect(() => {
    api.menu.setContext(JSON.parse(key)).catch(err => console.error(err))
  }, [key])
}
