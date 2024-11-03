export function timeAgo(date: Date, timezone = "UTC") {
  if (!date) return ""
  const now = new Date()
  const timeDiff = now.getTime() - date.getTime()

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: timezone !== "UTC",
      timeZone: timezone,
    }).format(date)
  }

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(date)
  }

  const formatDateFull = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(date)
  }

  if (timeDiff < 12 * 60 * 60 * 1000) {
    // Within the past 12 hours
    return formatTime(date)
  }
  if (date.getUTCFullYear() === now.getUTCFullYear()) {
    // More than 12 hours ago, but in the same year
    return `${formatDateShort(date)} ${formatTime(date)}`
  }

  // Not in the same year
  return `${formatDateFull(date)} ${formatTime(date)}`
}
