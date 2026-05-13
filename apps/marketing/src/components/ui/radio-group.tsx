import * as React from 'react';
import { cn } from '@/lib/utils';

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onChange: (next: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

interface RadioGroupProps {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true';
}

/**
 * Grupo de radios baseado em <input type=radio>. Estado pode ser
 * controlado (value) ou interno (defaultValue). onValueChange dispara
 * sempre que o usuário troca a seleção.
 */
function RadioGroup({
  name,
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...ariaProps
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = React.useCallback(
    (next: string) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const contextValue = React.useMemo<RadioGroupContextValue>(
    () => ({ name, value: currentValue, onChange: handleChange }),
    [name, currentValue, handleChange],
  );

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div role="radiogroup" className={cn('flex gap-2', className)} {...ariaProps}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface RadioGroupItemProps {
  value: string;
  label: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function RadioGroupItem({ value, label, className, disabled }: RadioGroupItemProps) {
  const ctx = React.useContext(RadioGroupContext);
  if (!ctx) {
    throw new Error('RadioGroupItem must be used inside a RadioGroup');
  }
  const checked = ctx.value === value;
  const id = `${ctx.name}-${value}`;

  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground',
        checked && 'border-primary bg-primary/10 text-primary',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="radio"
        id={id}
        name={ctx.name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => ctx.onChange(value)}
        className="sr-only"
      />
      <span>{label}</span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
