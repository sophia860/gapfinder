export function formatMoney(amount: number, currency = "USD") {
  try {
    // Use a single locale; Intl.NumberFormat handles every ISO 4217 currency
    // code regardless of locale, so any currency the user selects renders
    // correctly without maintaining a per-currency locale map.
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}
