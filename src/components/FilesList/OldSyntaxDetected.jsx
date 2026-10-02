import { MdWarning as IconWarning } from 'react-icons/md'

import Button from 'components/Button'

export default function OldSyntaxDetected({ onMigrate }) {
  return (
    <div className="OldSyntaxDetected">
      <IconWarning />
      <span>{'This file uses the MJML 3 syntax.'}</span>
      <Button size="sm" variant="secondary" onClick={onMigrate} className="ml-auto">
        {'Migrate'}
      </Button>
    </div>
  )
}
