export const MAX_CONTEXT_CHARS = 100000

export const SYSTEM_PROMPT = `You convert a Figma design into one MJML email template.

Rules:
- Return one complete MJML document (<mjml> ... </mjml>) in a single \`\`\`mjml code block. Do not write anything else.
- Use mj-section and mj-column for the layout. Never put an mj-section inside an mj-column. Use mj-group only when columns must stay side by side on mobile.
- Set the width attribute of mj-body to the body width that the user message gives.
- Put the colors and the fonts of the design into mj-attributes and mj-class in mj-head. Use the design variable names for the mj-class names when possible.
- Use mj-font for web fonts and give a safe fallback, for example "Inter, Arial, sans-serif".
- Use only the image paths from the image list in src attributes. Do not invent image URLs. For an image marked as missing, use https://placehold.co/<width>x<height> with the size from the design.
- Use mj-button for buttons, mj-divider for lines, mj-spacer for empty space and mj-social for social icons.
- Keep the text of the design exactly. Do not translate it.
- Use px units. Do not use CSS position, flexbox or grid.`

export const NO_MJML_PROMPT =
  'Your reply did not contain a complete MJML document. Return the full document from <mjml> to </mjml> in one ```mjml code block.'

export function bodyWidth(designWidth) {
  if (!designWidth || designWidth > 700) {
    return 600
  }
  return Math.round(designWidth)
}

function imageList(images) {
  if (!images.length) {
    return 'No images.'
  }
  return images
    .map(img => {
      const missing = img.ok ? '' : ' - missing, use a placeholder'
      return `- ${img.path} (Figma: ${img.name}, id: ${img.id})${missing}`
    })
    .join('\n')
}

export function buildDesignText(design, images) {
  let context = design.context || ''
  let note = ''
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS)
    note =
      '\n(The design data is cut at this point because it is too long. Use the screenshot for the rest.)'
  }
  const variables = design.variables || {}

  return [
    `Design name: ${design.name}`,
    `Body width: ${bodyWidth(design.width)}px (design width: ${Math.round(design.width || 0)}px)`,
    '',
    'Images (use only these paths in src):',
    imageList(images),
    '',
    'Design variables:',
    Object.keys(variables).length ? JSON.stringify(variables, null, 2) : 'None.',
    '',
    `Design data from Figma (${design.source}):`,
    context + note,
  ].join('\n')
}

function image(data) {
  return { type: 'file', mediaType: 'image/png', data }
}

export function buildGenerateMessages({ design, images }) {
  const content = [{ type: 'text', text: buildDesignText(design, images) }]
  if (design.screenshot) {
    content.push(image(design.screenshot))
  }
  return [{ role: 'user', content }]
}

export function buildFixPrompt(errors) {
  return [
    'The MJML has these validation errors. Fix them and return the full corrected document.',
    ...errors.map(err => `- line ${err.line ?? '?'}: ${err.message}`),
  ].join('\n')
}

export function buildVisualCheckMessages({ design, mjml, rendered }) {
  const text = [
    `The first image is the Figma design. The second image is the current MJML rendered at ${bodyWidth(design.width)}px.`,
    'Compare them. Fix the differences in layout, spacing, colors, font sizes and alignment.',
    'Keep the image paths. Return the full corrected MJML document.',
    '',
    'Current MJML:',
    '```mjml',
    mjml,
    '```',
  ].join('\n')
  return [
    {
      role: 'user',
      content: [{ type: 'text', text }, image(design.screenshot), image(rendered)],
    },
  ]
}

export function buildRefineMessages({ content, instruction, screenshot }) {
  const text = [
    `Change this MJML template. Instruction: ${instruction}`,
    'Keep everything else the same. Return the full MJML document.',
    '',
    '```mjml',
    content,
    '```',
  ].join('\n')
  const parts = [{ type: 'text', text }]
  if (screenshot) {
    parts.push(
      { type: 'text', text: 'This image is the original Figma design.' },
      image(screenshot),
    )
  }
  return [{ role: 'user', content: parts }]
}
