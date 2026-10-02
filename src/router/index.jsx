import { createHashRouter } from 'react-router'

import Application from 'components/Application'

import HomePage from 'pages/Home'
import ProjectPage from 'pages/Project'

const router = createHashRouter([
  {
    path: '/',
    Component: Application,
    children: [
      { index: true, Component: HomePage },
      { path: 'project', Component: ProjectPage },
    ],
  },
])

export default router
