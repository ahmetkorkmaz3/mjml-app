import erb from 'erb'
import Handlebars from 'handlebars'

export async function compile({ raw, engine, variables = {} }) {
  if (engine === 'erb') {
    return erb({
      timeout: 5000,
      data: { values: variables },
      template: raw,
    })
  }
  if (engine === 'handlebars') {
    return Handlebars.compile(raw)(variables)
  }

  return raw
}
