import kebabCase from 'lodash/kebabCase'

import api, { path } from 'helpers/api'
import mjml2html from 'helpers/mjml'
import router from 'router'

import { addAlert } from 'reducers/alerts'
import { openExternalFileOverlay, closeExternalFileOverlay } from 'reducers/externalFileOverlay'

import {
  saveSettings,
  cleanBadProjects,
  saveLastOpenedFolder,
  saveLastExportedFolder,
} from 'actions/settings'

import {
  copyDir,
  fileDialog,
  readFile,
  readDirNames,
  isReadWrite,
  rename,
  writeFile,
  mkdir,
  fileExists,
  isValidDir,
  getMtime,
} from 'helpers/fs'

const HOME_DIR = api.homedir

export function addProject(p) {
  return async (dispatch, getState) => {
    if (!p) {
      const state = getState()
      p = await fileDialog({
        defaultPath: state.settings.get('lastOpenedFolder') || HOME_DIR,
        properties: ['openDirectory', 'createDirectory'],
      })
      if (!p) {
        return
      }
    }

    if (!(await isReadWrite(p))) {
      throw new Error(`Cannot read or write in ${p}`)
    }

    dispatch(saveLastOpenedFolder(p))
    dispatch(openProject(p))
  }
}

export function removeProject(p, shouldDeleteFolder = false) {
  return dispatch => {
    dispatch({ type: 'PROJECT_REMOVE', payload: p })
    dispatch(saveSettings())
    if (shouldDeleteFolder) {
      api.shell.trashItem(p)
    }
  }
}

export function openProject(projectPath) {
  return dispatch => {
    router.navigate(`/project?path=${encodeURIComponent(projectPath)}`, { replace: true })
    dispatch(loadIfNeeded(projectPath))
    dispatch({ type: 'PROJECT_TOUCH', payload: projectPath })
    dispatch(saveSettings())
  }
}

function loadIfNeeded(path) {
  return async (dispatch, getState) => {
    const state = getState()
    const proj = state.projects.find(p => p.get('path') === path)
    if (!proj) {
      const enriched = await loadProject(path)
      dispatch({ type: 'PROJECT_LOAD', payload: enriched })
      dispatch(saveSettings())
    }
  }
}

// read the project directory
// eventually find the index.mjml file inside and generate its html
// (to have nice previews in home)
async function loadProject(p, mjmlPath) {
  const res = { path: p }
  res.isOK = await isValidDir(p)
  if (res.isOK) {
    try {
      let indexFilePath = path.join(p, 'index.mjml')
      const indexExists = await fileExists(indexFilePath)

      if (!indexExists) {
        const dir = await readDirNames(p)
        const fallback = dir.find(name => name.endsWith('.mjml'))

        if (fallback) indexFilePath = path.join(p, fallback)
      }

      res.mtime = await getMtime(indexFilePath)
      const mjmlContent = await readFile(indexFilePath)
      const { html: htmlContent } = await mjml2html(mjmlContent, indexFilePath, mjmlPath)
      res.html = htmlContent
    } catch (e) {}
    if (!res.mtime) {
      res.mtime = await getMtime(p)
    }
  }
  return res
}

function getMJMLPath(settings) {
  // eventually get the custom mjml path set in settings
  const mjmlManual = settings.getIn(['mjml', 'engine']) === 'manual'
  return mjmlManual ? settings.getIn(['mjml', 'path']) : undefined
}

export function loadProjects() {
  return async (dispatch, getState) => {
    const state = getState()
    const { settings } = state

    const projectsPaths = settings.get('projects')

    const mjmlPath = getMJMLPath(settings)
    const load = proj => loadProject(proj, mjmlPath)

    let enriched = await Promise.all(projectsPaths.map(load))

    // eventually clean settings from bad projects paths
    const pathsToClean = enriched.filter(e => !e.isOK).map(e => e.path)

    if (pathsToClean.length > 0) {
      dispatch(cleanBadProjects(pathsToClean))
      dispatch(saveSettings())
    }

    enriched = enriched.filter(e => e.isOK)

    dispatch({
      type: 'PROJECTS_LOAD',
      payload: enriched,
    })
  }
}

export function updateProjectPreview(p, html) {
  return {
    type: 'PROJECT_UPDATE_PREVIEW',
    payload: {
      path: p,
      html,
    },
  }
}

export function renameProject(oldPath, newPath) {
  return async dispatch => {
    await rename(oldPath, newPath)
    dispatch({
      type: 'PROJECT_RENAME',
      payload: { oldPath, newPath },
    })
    dispatch(saveSettings())
  }
}

export function dropFile(filePath) {
  return dispatch => {
    const ext = path.extname(filePath)
    if (ext !== '.mjml') {
      return
    }
    const dir = path.dirname(filePath)
    dispatch(openProject(dir))
  }
}

async function massExport(state, asyncJob, allFiles = false) {
  const projectsToExport = state.projects
    .filter(p => state.selectedProjects.find(path => path === p.get('path')))
    .filter(p => p.get('html'))

  if (projectsToExport.size === 0) {
    return
  }
  const targetPath = await fileDialog({
    defaultPath: state.settings.get('lastExportedFolder') || HOME_DIR,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (!targetPath) {
    return
  }
  const mjmlPath = getMJMLPath(state.settings)

  for (let i = 0; i < projectsToExport.size; i++) {
    const p = projectsToExport.get(i)
    const projPath = p.get('path')
    const projBaseName = path.basename(projPath)

    if (allFiles) {
      const files = await readDirNames(projPath)
      const mjmlFiles = files.filter(name => name.endsWith('.mjml'))
      if (!mjmlFiles.length) continue

      const targetDir = path.join(targetPath, kebabCase(projBaseName))
      await mkdir(targetDir)

      for (const file of mjmlFiles) {
        const filePath = path.join(projPath, file)
        const mjml = await readFile(filePath)
        const result = await mjml2html(mjml, filePath, mjmlPath)

        const targetName = file.replace(/\.mjml$/, '.html')

        await asyncJob(path.join(targetDir, targetName), result.html)
      }
    } else {
      const projSafeName = `${kebabCase(projBaseName)}.html`
      const filePath = path.join(targetPath, projSafeName)
      await asyncJob(filePath, p, targetPath)
    }
  }
  return targetPath
}

export function exportSelectedProjectsToHTML() {
  return async (dispatch, getState) => {
    const targetPath = await massExport(getState(), (filePath, p) =>
      writeFile(filePath, p.get('html')),
    )
    if (targetPath) {
      dispatch(saveLastExportedFolder(targetPath))
    }
  }
}

export function exportSelectedProjectsAllFilesToHTML() {
  return async (dispatch, getState) => {
    const targetPath = await massExport(
      getState(),
      (filePath, html) => writeFile(filePath, html, { flag: 'w' }),
      true,
    )
    if (targetPath) {
      dispatch(saveLastExportedFolder(targetPath))
    }
  }
}

export function exportSelectedProjectsToImages(done) {
  return async (dispatch, getState) => {
    const state = getState()

    try {
      const targetPath = await massExport(state, async (filePath, p, targetDir) => {
        const html = p.get('html')
        const previewSize = state.settings.get('previewSize')
        const [mobileWidth, desktopWidth] = [previewSize.get('mobile'), previewSize.get('desktop')]
        const [mobileScreenshot, desktopScreenshot] = await Promise.all([
          api.screenshot.take(html, mobileWidth, targetDir),
          api.screenshot.take(html, desktopWidth, targetDir),
        ])
        await api.screenshot.cleanUp(targetDir)
        await Promise.all([
          writeFile(`${filePath.replace(/.html$/, '')}_mobile.png`, mobileScreenshot),
          writeFile(`${filePath.replace(/.html$/, '')}_desktop.png`, desktopScreenshot),
        ])
      })
      if (targetPath) {
        dispatch(addAlert('Successfully exported to images', 'success'))
        dispatch(saveLastExportedFolder(targetPath))
      }
    } catch (err) {
      dispatch(addAlert(err.message || 'Could not export to images', 'error'))
    }
    done()
  }
}

async function getDuplicatePath(projectPath, increment = 1) {
  if (increment > 10) {
    throw new Error('Cant determine duplicate path')
  }
  const duplicatePath = `${projectPath} (${increment})`
  if (await fileExists(duplicatePath)) {
    return getDuplicatePath(projectPath, increment + 1)
  }
  return duplicatePath
}

export function duplicateProject(projectPath) {
  return async dispatch => {
    try {
      const newProjectPath = await getDuplicatePath(projectPath)
      await copyDir(projectPath, newProjectPath)
      dispatch(loadIfNeeded(newProjectPath))
    } catch (err) {
      console.log(err)
    }
  }
}

/**
 * As opening external file will trigger an instant app load + project load
 * we need to wait for the reducers to be ready
 */
async function waitUntilLoaded(getState, timeout = 5e3) {
  const { settings, projects } = getState()
  if (settings && projects) {
    return true
  }
  if (timeout <= 0) {
    throw new Error('Loading settings took too long')
  }
  await new Promise(resolve => setTimeout(resolve, 500))
  return waitUntilLoaded(getState, timeout - 500)
}

export function openExternalFile(filePath) {
  return async (dispatch, getState) => {
    const exists = await fileExists(filePath)
    if (!exists) {
      return
    }
    dispatch(openExternalFileOverlay(filePath))
    try {
      const dirName = path.dirname(filePath)
      const validDir = await isValidDir(dirName)
      if (!validDir) {
        throw new Error('Cant open that.')
      }
      await waitUntilLoaded(getState)
      dispatch(openProject(dirName))
    } catch (err) {
      console.log(err)
    }
    dispatch(closeExternalFileOverlay())
  }
}
