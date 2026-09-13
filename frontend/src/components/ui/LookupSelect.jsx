// Reusable "pick from a managed list, or add a new one" combo box — used for
// both Position and Department (Team-Admin-managed lookup lists, not
// per-user free text). See AddLookupModal for the "+ Add New" form.
const ADD_NEW_VALUE = '__add_new__'

export function LookupSelect({ label, items, value, onChange, onAddNew, loading, disabled }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-muted text-[12.5px] font-semibold">{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === ADD_NEW_VALUE) {
            onAddNew()
            return
          }
          onChange(e.target.value ? Number(e.target.value) : null)
        }}
        className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
      >
        <option value="">{loading ? 'Loading…' : `Select ${label.toLowerCase()}`}</option>
        {items?.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        <option value={ADD_NEW_VALUE}>+ Add New {label}</option>
      </select>
    </label>
  )
}
