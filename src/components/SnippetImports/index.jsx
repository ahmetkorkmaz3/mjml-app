import { Component } from 'react'
import { connect } from 'react-redux'

import Button from 'components/Button'

import { saveSettings } from 'actions/settings'
import { addAlert } from 'reducers/alerts'
import { parseSnippetsImport } from 'components/SnippetForm/validate'

import api from 'helpers/api'
import { saveDialog, fileDialog, writeFile, readFile } from 'helpers/fs'

const HOME_DIR = api.homedir

export default connect(
  state => ({
    settings: state.settings,
  }),
  {
    addSnippetsFromImport: snippets => dispatch => {
      // one action for each snippet, then one save and one alert for the import
      for (const { name, trigger, content } of snippets) {
        dispatch({
          type: 'SNIPPET_ADD',
          payload: { snippetName: name, snippetTrigger: trigger, snippetContent: content },
        })
      }
      if (snippets.length) dispatch(saveSettings())
    },
    addAlert,
  },
)(
  class SnippetImports extends Component {
    async importSnippets() {
      const { settings, addSnippetsFromImport, addAlert } = this.props
      const existingSnippets = settings.get('snippets').toArray()

      const filePath = await fileDialog({
        title: 'Import Snippets from JSON file',
        defaultPath: HOME_DIR,
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      })

      if (!filePath) return

      let result
      try {
        result = parseSnippetsImport(await readFile(filePath), existingSnippets)
      } catch (err) {
        addAlert(`Could not import the snippets: ${err.message}`, 'error')
        return
      }

      const { added, skipped } = result
      addSnippetsFromImport(added)
      const message = [
        `Imported ${added.length} snippet${added.length === 1 ? '' : 's'}`,
        skipped ? `, skipped ${skipped} (invalid, or the name or trigger is already used)` : '',
      ].join('')
      addAlert(message, added.length ? 'success' : 'info')
    }

    async exportSnippets() {
      const { settings, addAlert } = this.props
      const snippets = settings.get('snippets')

      const filePath = await saveDialog({
        title: 'Export Snippets to JSON file',
        defaultPath: HOME_DIR,
        filters: [{ name: 'All Files', extensions: ['json'] }],
      })

      if (!filePath) return

      try {
        await writeFile(filePath, JSON.stringify(snippets))
      } catch (err) {
        addAlert(`Could not export the snippets: ${err.message}`, 'error')
        return
      }

      addAlert('JSON successfully created!', 'success')
    }

    render() {
      return (
        <div className="w-100 bt-white p-v-20">
          <div className="mb-20">
            <Button primary onClick={() => this.importSnippets()}>
              {'Import snippets from JSON file'}
            </Button>
          </div>
          <div className="mb-20">
            <Button primary onClick={() => this.exportSnippets()}>
              {'Export snippets into JSON file'}
            </Button>
          </div>
        </div>
      )
    }
  },
)
