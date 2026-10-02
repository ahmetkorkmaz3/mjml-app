import get from 'lodash/get'

import api from 'helpers/api'

export default function mjml2html(mjmlContent, filePath, mjmlPath = null, options = {}) {
  return new Promise(resolve => {
    window.requestIdleCallback(async () => {
      try {
        const settings = await api.storage.get('settings')

        const res = await api.mjml.render(mjmlContent, filePath, {
          mjmlPath,
          minify: !!options.minify,
          keepComments: get(settings, 'mjml.keepComments', true),
          useMjmlConfig: get(settings, 'mjml.useMjmlConfig', false),
          mjmlConfigPath: get(settings, 'mjml.mjmlConfigPath'),
          preventAutoSave: get(settings, 'editor.preventAutoSave', false),
        })

        resolve(res)
      } catch (e) {
        resolve({ html: '', errors: [] })
      }
    })
  })
}

export function migrateToMJML4(content) {
  return api.mjml.migrateToMJML4(content)
}
