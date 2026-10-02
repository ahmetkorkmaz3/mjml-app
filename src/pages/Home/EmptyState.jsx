import Button from 'components/Button'

export default function EmptyState({ onNew, onOpen, newButtonRef }) {
  return (
    <div className="HomeEmpty">
      <h1>{'Create your first email'}</h1>
      <p>{'Start from a template or open a folder with MJML files.'}</p>
      <div className="HomeEmpty--actions">
        <Button ref={newButtonRef} variant="primary" size="lg" onClick={onNew}>
          {'New Project'}
        </Button>
        <Button variant="secondary" size="lg" onClick={onOpen}>
          {'Open Project…'}
        </Button>
      </div>
      <p className="HomeEmpty--hint">{'Or drop an .mjml file or a folder here'}</p>
    </div>
  )
}
