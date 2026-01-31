import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AmountInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: number;
  onValueChange: (value: number) => void;
  currency?: string;
  locale?: string;
}

export function AmountInput({
  value,
  onValueChange,
  className,
  locale = "en-US",
  ...props
}: AmountInputProps) {
  // Format the initial value
  const formatValue = React.useCallback((val: number) => {
    if (val === 0 && !props.placeholder) return "";
    return new Intl.NumberFormat(locale, {
      style: "decimal",
      maximumFractionDigits: 2,
    }).format(val);
  }, [locale, props.placeholder]);

  const [displayValue, setDisplayValue] = React.useState(formatValue(value));

  // Sync with external value changes
  React.useEffect(() => {
    // Only update if the parsed display value doesn't match the new prop value
    const numericDisplay = parseFloat(displayValue.replace(/,/g, ""));
    // Use a small epsilon for float comparison if needed, but for simple amounts check exact match or close enough
    if (numericDisplay !== value) {
        // Prevent clearing if user is typing "0." and value is 0
        if(value === 0 && displayValue === "") return;
        // Don't update if it roughly matches (handling parsing diffs)
        if (isNaN(numericDisplay) && value === 0) return;
        
        setDisplayValue(value === 0 ? "" : formatValue(value));
    }
  }, [value, formatValue, displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow digits and one decimal point
    // Remove all non-numeric chars except dot
    const cleanValue = inputValue.replace(/[^0-9.]/g, "");
    
    // Split by dot to handle decimals
    const parts = cleanValue.split(".");
    
    // Prevent multiple dots
    if (parts.length > 2) return;

    // Integer part with commas
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    // Combine
    let formattedValue = integerPart;
    if (parts.length > 1) {
      formattedValue += "." + parts[1].slice(0, 2); // Limit to 2 decimal places
    }

    setDisplayValue(formattedValue);

    // Parse to number for parent
    const numberValue = parseFloat(cleanValue);
    onValueChange(isNaN(numberValue) ? 0 : numberValue);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      className={cn("font-mono", className)}
      {...props}
    />
  );
}
