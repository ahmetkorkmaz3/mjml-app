// A row of the settings: the label and an optional help text on the left,
// the control on the right.
export default function SettingRow({ label, help, children }) {
  return (
    <div className="SettingRow">
      <div className="SettingRow--text">
        <div className="SettingRow--label">{label}</div>
        {help && <div className="SettingRow--help">{help}</div>}
      </div>
      <div className="SettingRow--control">{children}</div>
    </div>
  )
}
