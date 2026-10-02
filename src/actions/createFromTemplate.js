import { path } from 'helpers/api'

import { createOrEmpty, writeFile } from 'helpers/fs'

import { openProject } from 'actions/projects'
import { addAlert } from 'reducers/alerts'

export default function createFromTemplate(location, template) {
  return async dispatch => {
    try {
      await createOrEmpty(location)
      await Promise.all(
        template.files.map(file => writeFile(path.join(location, file.name), file.content)),
      )
      dispatch(openProject(location))
    } catch (err) {
      dispatch(addAlert(err.message || err, 'error'))
    }
  }
}
