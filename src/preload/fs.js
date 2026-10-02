import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

// Errors do not keep their `code` when they cross the context bridge, so the
// helpers below return booleans or plain values when the renderer needs to
// know the reason of a failure.

export function readFile(p, encoding = 'utf8') {
  return fs.readFile(p, { encoding })
}

export function writeFile(p, data, options) {
  return fs.writeFile(p, data, options)
}

// the last modification time in ms, or null when the file cannot be read
export async function getMtime(p) {
  try {
    return (await fs.stat(p)).mtimeMs
  } catch (err) {
    return null
  }
}

// fails when the destination exists
export function copyFile(src, dest) {
  return fs.copyFile(src, dest, constants.COPYFILE_EXCL)
}

export function rename(oldPath, newPath) {
  return fs.rename(oldPath, newPath)
}

export async function mkdir(p) {
  await fs.mkdir(p, { recursive: true })
}

export async function readDirNames(p) {
  return fs.readdir(p)
}

export function copyDir(src, dest) {
  return fs.cp(src, dest, { recursive: true, errorOnExist: true, force: false })
}

async function getFileInfo(dir, name) {
  const fullPath = path.resolve(dir, name)
  try {
    const stats = await fs.stat(fullPath)
    return { name, path: fullPath, isFolder: stats.isDirectory() }
  } catch (err) {
    return { name, path: fullPath, isFolder: false }
  }
}

// list the files of a directory (without hidden files)
export async function readDir(p) {
  const filesList = await fs.readdir(p)
  const filtered = filesList.filter(f => !f.startsWith('.'))
  return Promise.all(filtered.map(name => getFileInfo(p, name)))
}

export async function fileExists(p) {
  try {
    await fs.access(p, constants.F_OK)
    return true
  } catch (err) {
    return false
  }
}

export async function isReadWrite(p) {
  try {
    await fs.access(p, constants.R_OK | constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

export async function isExecutable(p) {
  try {
    await fs.access(p, constants.R_OK | constants.X_OK)
    return true
  } catch (err) {
    return false
  }
}

export async function isValidDir(p) {
  if (!(await isReadWrite(p))) {
    return false
  }
  const stats = await fs.stat(p)
  return stats.isDirectory()
}

export async function alreadyExists(location) {
  try {
    await fs.access(location, constants.R_OK | constants.W_OK)
  } catch (err) {
    return err.code !== 'ENOENT'
  }
  return true
}

export async function isEmptyOrDontExist(location) {
  try {
    await fs.access(location, constants.R_OK | constants.W_OK)
  } catch (err) {
    return err.code === 'ENOENT'
  }
  const filesList = await fs.readdir(location)
  return filesList.length === 0
}

export async function createOrEmpty(location) {
  try {
    await fs.access(location, constants.R_OK | constants.W_OK)
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(location)
    }
  }
  const filesList = await fs.readdir(location)
  if (filesList.length > 0) {
    throw new Error('Directory not empty')
  }
}
