type ActiveSwitchProps = {
  readonly checked: boolean
  readonly label: string
  readonly onChange: (checked: boolean) => void
}

// Checkbox nativo com role="switch": Space e foco vêm do navegador, e o formulário continua lendo `checked`.
// Só transform e cores animam (nunca layout); `motion-reduce` zera a transição para quem pede menos movimento.
export function ActiveSwitch({ checked, label, onChange }: ActiveSwitchProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-gray-200 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 transition-colors duration-150 ease-out after:transition-[transform,border-color] after:duration-150 after:ease-out motion-reduce:transition-none motion-reduce:after:transition-none peer-checked:bg-brand-600" />
    </label>
  )
}
