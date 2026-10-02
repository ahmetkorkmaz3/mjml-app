import api from 'helpers/api'

export const {
  readFile,
  writeFile,
  rename,
  mkdir,
  readDir,
  readDirNames,
  copyDir,
  fileExists,
  isReadWrite,
  isExecutable,
  isValidDir,
  alreadyExists,
  isEmptyOrDontExist,
  createOrEmpty,
  copyFile,
  copyAssets,
  getMtime,
} = api.fs

export function sortFiles(files) {
  files.sort((a, b) => {
    if (a.isFolder && !b.isFolder) {
      return -1
    }
    if (!a.isFolder && b.isFolder) {
      return 1
    }
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    if (aName < bName) {
      return -1
    }
    if (aName > bName) {
      return 1
    }
    return 0
  })
}

// open a native dialog, returns the first selected path or null
export function fileDialog(options) {
  return api.dialog.open(options)
}

// open a native save dialog, returns the selected path or null
export function saveDialog(options) {
  return api.dialog.save(options)
}
