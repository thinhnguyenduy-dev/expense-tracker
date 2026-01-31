
import { useLocale } from 'next-intl';

interface FormattedCurrencyProps {
  value: number;
}

export function FormattedCurrency({ value }: FormattedCurrencyProps) {
  const locale = useLocale();

  const formatted = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: locale === 'vi' ? 'VND' : 'USD',
  }).format(value);

  return <>{formatted}</>;
}
