import { format, parseISO } from 'date-fns'
import type { SheetData } from '@/lib/attendanceSheet'

const BLUE = 'FF93C5FD' // weekend cells
const BLUE_HEADER = 'FF3B82F6' // weekend headings
const HEAD = 'FFF1F5F9'
const GREEN = 'FF16A34A'
const RED = 'FFDC2626'
const INDIGO = 'FF4338CA'
const GREY = 'FF64748B'
const BORDER = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
const BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER }
const MONTH_EDGE = { style: 'medium' as const, color: { argb: 'FF334155' } }
const MONTH_FILLS = ['FF334155', 'FF64748B'] // the month names alternate so neighbouring months are easy to tell apart

/**
 * The same sheet as the PDF, as an Excel file: a tick or an X for every weekday, weekends blank and blue,
 * codes (AL, MC, EL, UL, WFH) for approved leave and work from home. Every day is on one sheet, so a long range
 * scrolls sideways (the name column and the day headings stay in view). exceljs is loaded only when a file is made.
 */
export async function attendanceExcel(sheet: SheetData, opts: { company: string; from: string; to: string }): Promise<{ bytes: () => Promise<ArrayBuffer>; save: (name: string) => Promise<void> }> {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  wb.creator = 'UrusProgres'
  wb.created = new Date()
  const ws = wb.addWorksheet('Attendance', { views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }] })
  const range = `${format(parseISO(opts.from), 'd MMM yyyy')} to ${format(parseISO(opts.to), 'd MMM yyyy')}`
  const lastCol = sheet.days.length + 2 // name + days + present

  ws.getCell('A1').value = 'Attendance report'
  ws.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF1E293B' } }
  ws.getCell('A2').value = `${opts.company}   |   ${range}`
  ws.getCell('A2').font = { size: 10, color: { argb: GREY } }

  // month row (row 4): one merged cell over the days of each month, so it is clear which month a date belongs to
  const months: { label: string; first: number; last: number }[] = []
  sheet.days.forEach((d, i) => {
    const label = format(parseISO(d.date), 'MMMM yyyy')
    const prev = months[months.length - 1]
    if (prev && prev.label === label) prev.last = i + 2
    else months.push({ label, first: i + 2, last: i + 2 })
  })
  const monthRow = ws.getRow(4)
  monthRow.height = 20
  months.forEach((m, k) => {
    if (m.last > m.first) ws.mergeCells(4, m.first, 4, m.last)
    const cell = monthRow.getCell(m.first)
    cell.value = m.label
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    for (let c = m.first; c <= m.last; c++) {
      monthRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MONTH_FILLS[k % 2] } }
      monthRow.getCell(c).border = BORDERS
    }
  })
  for (const c of [1, sheet.days.length + 2]) {
    monthRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } }
    monthRow.getCell(c).border = BORDERS
  }
  monthRow.getCell(1).value = 'Month'
  monthRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E293B' } }
  monthRow.getCell(1).alignment = { vertical: 'middle' }
  const monthStart = new Set(months.map((m) => m.first))

  // heading row (row 5): name, one column per day, present
  const head = ws.getRow(5)
  head.height = 32
  head.getCell(1).value = 'Name'
  sheet.days.forEach((d, i) => {
    const cell = head.getCell(i + 2)
    cell.value = `${format(parseISO(d.date), 'd')}\n${format(parseISO(d.date), 'EEEEEE')}`
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: d.weekend ? BLUE_HEADER : HEAD } }
    cell.font = { bold: true, size: 9, color: { argb: d.weekend ? 'FFFFFFFF' : 'FF1E293B' } }
  })
  head.getCell(lastCol).value = 'Present'
  for (const c of [1, lastCol]) {
    head.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } }
    head.getCell(c).font = { bold: true, size: 10, color: { argb: 'FF1E293B' } }
  }
  for (let c = 1; c <= lastCol; c++) {
    head.getCell(c).alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle', wrapText: true }
    head.getCell(c).border = monthStart.has(c) && c > 2 ? { ...BORDERS, left: MONTH_EDGE } : BORDERS
  }

  // one row per person
  sheet.rows.forEach((r, i) => {
    const row = ws.getRow(6 + i)
    row.height = 20
    row.getCell(1).value = r.name
    row.getCell(1).font = { bold: true, size: 10 }
    row.getCell(1).alignment = { vertical: 'middle' }
    r.cells.forEach((state, j) => {
      const cell = row.getCell(j + 2)
      const code = r.codes[j]
      if (code) {
        cell.value = code
        cell.font = { bold: true, size: 9, color: { argb: INDIGO } }
      } else if (state === 'present') {
        cell.value = '✓'
        cell.font = { bold: true, size: 12, color: { argb: GREEN } }
      } else if (state === 'absent') {
        cell.value = '✗'
        cell.font = { bold: true, size: 12, color: { argb: RED } }
      }
      if (state === 'weekend') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    const total = row.getCell(lastCol)
    total.value = `${r.present}/${r.workdays}`
    total.font = { bold: true, size: 10 }
    total.alignment = { horizontal: 'center', vertical: 'middle' }
    // a heavier line on the left of the first day of each month
    for (let c = 1; c <= lastCol; c++) row.getCell(c).border = monthStart.has(c) && c > 2 ? { ...BORDERS, left: MONTH_EDGE } : BORDERS
  })

  // legend
  let at = 6 + sheet.rows.length + 1
  const note = (text: string, color = GREY, bold = false) => {
    const cell = ws.getCell(at++, 1)
    cell.value = text
    cell.font = { size: 9, color: { argb: color }, bold }
  }
  note('✓ clocked in     ✗ no clock-in on a weekday     blue = weekend     blank = day not reached yet')
  note('"Present" = weekdays clocked in / weekdays so far.')
  if (sheet.legend.length > 0) note(sheet.legend.map((l) => `${l.code} = ${l.name}`).join('     '), INDIGO, true)

  ws.getColumn(1).width = 30
  for (let c = 2; c < lastCol; c++) ws.getColumn(c).width = 5.5
  ws.getColumn(lastCol).width = 10

  const bytes = async () => (await wb.xlsx.writeBuffer()) as ArrayBuffer
  return {
    bytes,
    save: async (name) => {
      const url = URL.createObjectURL(new Blob([await bytes()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    },
  }
}
