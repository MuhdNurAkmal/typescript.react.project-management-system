import { format, parseISO } from 'date-fns'
import { chunk, type DayState, type SheetData } from '@/lib/attendanceSheet'

/** Days per page. Name + 31 narrow day columns + the total fit across A4 landscape. */
const DAYS_PER_PAGE = 31

const BLUE: [number, number, number] = [147, 197, 253] // weekend cells
const BLUE_HEADER: [number, number, number] = [59, 130, 246] // weekend headings
const GREEN: [number, number, number] = [22, 163, 74]
const RED: [number, number, number] = [220, 38, 38]
const GREY: [number, number, number] = [100, 116, 139]

/**
 * Draws the attendance sheet as a PDF: a tick for a weekday attended, an X for a weekday missed, weekends blank
 * and blue, days that have not happened yet blank. A range longer than 31 days continues on the next page.
 * jsPDF is loaded only when a report is made.
 */
export async function attendancePdf(sheet: SheetData, opts: { company: string; from: string; to: string }): Promise<{ save: (name: string) => void; bytes: () => ArrayBuffer; pages: number }> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const range = `${format(parseISO(opts.from), 'd MMM yyyy')} to ${format(parseISO(opts.to), 'd MMM yyyy')}`

  const pieces = chunk(sheet.days.map((d, i) => ({ ...d, index: i })), DAYS_PER_PAGE)
  pieces.forEach((piece, n) => {
    if (n > 0) doc.addPage()
    doc.setFontSize(15)
    doc.setTextColor(30, 41, 59)
    doc.text('Attendance report', 14, 16)
    doc.setFontSize(9)
    doc.setTextColor(...GREY)
    doc.text(`${opts.company}   |   ${range}${pieces.length > 1 ? `   |   part ${n + 1} of ${pieces.length}` : ''}`, 14, 22)
    doc.text(`Created ${format(new Date(), 'd MMM yyyy HH:mm')}`, pageWidth - 14, 16, { align: 'right' })

    const head = [['Name', ...piece.map((d) => `${format(parseISO(d.date), 'd')}\n${format(parseISO(d.date), 'EEEEEE')}`), 'Present']]
    const states: DayState[][] = sheet.rows.map((r) => piece.map((d) => r.cells[d.index]))
    // the Present column counts the days on this page, so each page adds up on its own
    const body = sheet.rows.map((r, i) => {
      const mine = states[i]
      const present = mine.filter((c) => c === 'present').length
      const workdays = mine.filter((c) => c === 'present' || c === 'absent').length
      return [r.name, ...piece.map(() => ''), `${present}/${workdays}`]
    })
    const lastCol = piece.length + 1

    autoTable(doc, {
      head,
      body,
      startY: 27,
      margin: { left: 14, right: 14, bottom: 16 },
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.15, minCellHeight: 7 },
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: { 0: { halign: 'left', cellWidth: 46, fontStyle: 'bold' }, [lastCol]: { cellWidth: 17, fontStyle: 'bold' } },
      didParseCell: (d) => {
        const col = d.column.index
        if (col === 0 || col === lastCol) return
        const day = piece[col - 1]
        if (!day.weekend) return
        if (d.section === 'head') {
          d.cell.styles.fillColor = BLUE_HEADER
          d.cell.styles.textColor = [255, 255, 255]
        } else {
          d.cell.styles.fillColor = BLUE
        }
      },
      didDrawCell: (d) => {
        const col = d.column.index
        if (d.section !== 'body' || col === 0 || col === lastCol) return
        const state = states[d.row.index][col - 1]
        if (state !== 'present' && state !== 'absent') return
        const { x, y, width: w, height: h } = d.cell
        doc.setLineWidth(0.45)
        if (state === 'present') {
          doc.setDrawColor(...GREEN)
          doc.line(x + w * 0.25, y + h * 0.55, x + w * 0.42, y + h * 0.72)
          doc.line(x + w * 0.42, y + h * 0.72, x + w * 0.76, y + h * 0.3)
        } else {
          doc.setDrawColor(...RED)
          doc.line(x + w * 0.3, y + h * 0.3, x + w * 0.7, y + h * 0.7)
          doc.line(x + w * 0.7, y + h * 0.3, x + w * 0.3, y + h * 0.7)
        }
      },
    })

    // legend under the table of this page
    const end = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40
    const ly = Math.min(end + 7, doc.internal.pageSize.getHeight() - 10)
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.setLineWidth(0.45)
    doc.setDrawColor(...GREEN)
    doc.line(14, ly, 16, ly + 1.6)
    doc.line(16, ly + 1.6, 19, ly - 1.6)
    doc.text('Clocked in', 21, ly + 1)
    doc.setDrawColor(...RED)
    doc.line(45, ly - 1.5, 48, ly + 1.5)
    doc.line(48, ly - 1.5, 45, ly + 1.5)
    doc.text('No clock-in on a weekday', 50, ly + 1)
    doc.setFillColor(...BLUE)
    doc.rect(100, ly - 2, 5, 4, 'F')
    doc.text('Weekend', 107, ly + 1)
    doc.text('Blank = day not reached yet. "Present" = weekdays clocked in / weekdays so far on this page.', 130, ly + 1)
  })

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.text(`Page ${i} of ${total}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }
  return { save: (name) => doc.save(name), bytes: () => doc.output('arraybuffer'), pages: total }
}
