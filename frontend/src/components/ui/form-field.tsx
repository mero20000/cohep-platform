'use client'



interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: string
  required?: boolean
  as?: 'input' | 'select' | 'textarea'
  children?: React.ReactNode
  fieldId?: string
}

export function FormField({ label, error, hint, required, as = 'input', children, className = '', fieldId, ...props }: FormFieldProps) {
  const id = fieldId || label.toLowerCase().replace(/\s+/g, '-')
  const baseClass = `mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition-colors ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gold-500 focus:ring-gold-500'} bg-white ${className}`

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {as === 'select' ? (
        <select id={id} className={baseClass} {...(props as Record<string, unknown>)}>
          {children}
        </select>
      ) : as === 'textarea' ? (
        <textarea id={id} className={baseClass} {...(props as Record<string, unknown>)} />
      ) : (
        <input id={id} className={baseClass} {...props} />
      )}
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
