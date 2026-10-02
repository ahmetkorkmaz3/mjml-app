import { app, shell } from 'electron'

export default function buildMenu(mainWindow) {
  return [
    {
      label: 'MJML',
      submenu: [
        {
          label: 'New project',
          click() {
            mainWindow.webContents.send('redux-command', 'new-project')
          },
        },
        {
          label: 'Open project',
          click() {
            mainWindow.webContents.send('redux-command', 'open-project')
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'About',
          click() {
            mainWindow.webContents.send('redux-command', 'about')
          },
        },
        {
          label: 'Documentation',
          click() {
            shell.openExternal('https://documentation.mjml.io/')
          },
        },
        {
          label: 'Browser Editor',
          click() {
            shell.openExternal('https://mjml.io/try-it-live')
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Quit MJML',
          accelerator: 'CmdOrCtrl+Q',
          click() {
            app.quit()
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click() {
            mainWindow.webContents.reload()
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          click() {
            mainWindow.setFullScreen(!mainWindow.isFullScreen())
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click() {
            mainWindow.webContents.toggleDevTools()
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(process.platform === 'darwin'
          ? [{ role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }]
          : []),
      ],
    },
  ]
}
