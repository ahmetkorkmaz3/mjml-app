import api from 'helpers/api'

// apply the templating engine (erb, handlebars) of the project to the HTML
export const compile = params => api.templating.compile(params)
