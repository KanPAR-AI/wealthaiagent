/** INR and financial formatting utilities */

export function formatINR(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)}K`
  }
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatYears(years: number): string {
  if (years === 1) return '1 year'
  return `${years} years`
}

export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_00_00_000) {
    return `${sign}${(abs / 1_00_00_000).toFixed(1)}Cr`
  }
  if (abs >= 1_00_000) {
    return `${sign}${(abs / 1_00_000).toFixed(1)}L`
  }
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(0)}K`
  }
  return `${sign}${Math.round(abs)}`
}
