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

  // Determine separators based on locale
  const isVi = locale && (locale.startsWith("vi"));
  const thousandSeparator = isVi ? "." : ",";
  const decimalSeparator = isVi ? "," : ".";

  // Sync with external value changes
  React.useEffect(() => {
    // Normalize display value to standard float string for comparison
    // Remove thousands separator, replace decimal separator with dot
    const normalizedDisplay = displayValue
      .split(thousandSeparator).join("")
      .replace(decimalSeparator, ".");
      
    const numericDisplay = parseFloat(normalizedDisplay);
    
    // Use a small epsilon for float comparison if needed, but for simple amounts check exact match or close enough
    if (numericDisplay !== value) {
        // Prevent clearing if user is typing "0." and value is 0 (handled roughly)
        if(value === 0 && displayValue === "") return;
        // Don't update if it roughly matches (handling parsing diffs)
        if (isNaN(numericDisplay) && value === 0) return;
        
        setDisplayValue(value === 0 ? "" : formatValue(value));
    }
  }, [value, formatValue, displayValue, thousandSeparator, decimalSeparator]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Clean input: remove thousand separators first, then everything not digit or decimal separator
    // For regex: escape special chars if needed (dot is special)
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    const decimalRegex = new RegExp(`[^0-9${escapeRegExp(decimalSeparator)}]`, "g");
    
    // We strictly assume user inputs digits and the correct decimal separator for the locale.
    // If they input the *wrong* separator (e.g. dot in VI for decimal), we might want to map it?
    // ideally normalize: if isVi, map dot to nothing (though thousands) or maybe allow dot as ignored char.
    // Let's stick to stripping non-allowed chars.
    
    // Remove thousand separators explicitly first to avoid confusion if user types them? 
    // Actually regex [^0-9,.] logic strips them if they are not the decimal separator.
    // But if thousand separator IS dot (VI), and we want to strip it...
    // The "decimalRegex" keeps digits and decimalSeparator.
    // So for VI (decimal=,), it keeps digits and comma. It strips DOT. Correct.
    // For EN (decimal=.), it keeps digits and dot. It strips COMMA. Correct.
    
    const cleanValue = inputValue.replace(decimalRegex, "");
    
    // Split by decimal separator
    const parts = cleanValue.split(decimalSeparator);
    
    // Prevent multiple decimal separators
    if (parts.length > 2) return;

    // Integer part with thousands separators
    // \B lookahead logic needs to place the SPECIFIC thousand separator
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
    
    // Combine
    let formattedValue = integerPart;
    if (parts.length > 1) {
      formattedValue += decimalSeparator + parts[1].slice(0, 2); // Limit to 2 decimal places
    }

    setDisplayValue(formattedValue);

    // Parse to number for parent
    // Need standard JS float format: 12345.67
    const standardFloatString = parts[0] + (parts.length > 1 ? "." + parts[1].slice(0, 2) : "");
    const numberValue = parseFloat(standardFloatString);
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
