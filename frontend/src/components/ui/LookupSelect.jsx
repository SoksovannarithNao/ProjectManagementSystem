// Reusable "pick from a managed list, or add a new one" combo box — used for
// both Position and Department (Team-Admin-managed lookup lists, not
// per-user free text). See AddLookupModal for the "+ Add New" form. Without
// onAddNew the "+ Add New" choice is not offered (hidden, not disabled): the
// caller lacks LOOKUP:CREATE, so the server would refuse it.
const ADD_NEW_VALUE = '__add_new__'

export function LookupSelect({ label, items, value, onChange, onAddNew, loading, disabled }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-muted text-[12px] font-semibold">{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === ADD_NEW_VALUE && onAddNew) {
            onAddNew()
            return
          }
          onChange(e.target.value ? Number(e.target.value) : null)
        }}
        className="field w-full"
      >
        <option value="">{loading ? 'Loading…' : `Select ${label.toLowerCase()}`}</option>
        {items?.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        {onAddNew && <option value={ADD_NEW_VALUE}>+ Add New {label}</option>}
      </select>
    </label>
  )
}
