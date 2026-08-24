import { addMinutes, format, parse } from 'date-fns'

export const getIsoWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7)
}

/** Next half-hour local slot at least `minMinutesAhead` from now. */
export function getDefaultFutureScheduleSlot(minMinutesAhead = 30): {
  date: string
  time: string
} {
  let slot = addMinutes(new Date(), minMinutesAhead)
  slot.setSeconds(0, 0)
  const rem = slot.getMinutes() % 30
  if (rem !== 0) {
    slot = addMinutes(slot, 30 - rem)
  }
  return {
    date: format(slot, 'yyyy-MM-dd'),
    time: format(slot, 'HH:mm'),
  }
}

/** Parse `<input type="date">` + `<input type="time">` as local wall time. */
export function parseLocalDateTime(date: string, time: string): Date {
  const normalized = time.length === 5 ? `${time}:00` : time
  return parse(`${date} ${normalized}`, 'yyyy-MM-dd HH:mm:ss', new Date())
}
