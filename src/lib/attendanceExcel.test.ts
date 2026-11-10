import { describe, expect, it } from 'vitest'
import { attendanceExcel } from '@/lib/attendanceExcel'
import { buildSheet } from '@/lib/attendanceSheet'

const at = (day: string) => new Date(`${day}T09:00:00`).toISOString()

describe('attendanceExcel', () => {
  // Mon 1 to Sun 7 June 2026, today is Thu the 4th
  const people = [
    { id: 'u1', name: 'Aina' },
    { id: 'u2', name: 'Budi' },
  ]
  const sessions = [
    { user_id: 'u1', clock_in: at('2026-06-01') },
    { user_id: 'u2', clock_in: at('2026-06-02') },
  ]
  const types = [{ id: 1, name: 'Annual leave', blocks_clock_in: true }]
  const leaves = [{ user_id: 'u1', leave_type_id: 1, start_date: '2026-06-03', end_date: '2026-06-03' }]
  const sheet = buildSheet(sessions, people, '2026-06-01', '2026-06-07', '2026-06-04', leaves, types)

  async function open() {
    const file = await attendanceExcel(sheet, { company: 'Demo Sdn Bhd', from: '2026-06-01', to: '2026-06-07' })
    const { Workbook } = await import('exceljs')
    const wb = new Workbook()
    await wb.xlsx.load(await file.bytes())
    return wb.getWorksheet('Attendance')!
  }

  it('has a heading row with the days and a row per person', async () => {
    const ws = await open()
    expect(ws.getCell('A1').value).toBe('Attendance report')
    expect(ws.getCell('A5').value).toBe('Name')
    expect(ws.getCell('B5').value).toBe('1\nMo')
    expect(ws.getCell('I5').value).toBe('Present')
    expect(ws.getCell('A6').value).toBe('Aina')
    expect(ws.getCell('A7').value).toBe('Budi')
  })

  it('writes a tick, an X, a leave code, and leaves weekends and upcoming days empty', async () => {
    const ws = await open()
    // Aina: Mon present, Tue missed, Wed AL, Thu missed (today), Fri not reached, Sat and Sun weekend
    expect([2, 3, 4, 5, 6, 7, 8].map((c) => ws.getRow(6).getCell(c).value)).toEqual(['✓', '✗', 'AL', '✗', null, null, null])
    expect(ws.getRow(6).getCell(9).value).toBe('1/3')
    expect(ws.getRow(7).getCell(3).value).toBe('✓')
  })

  it('colours the weekend columns blue', async () => {
    const ws = await open()
    const fill = (addr: string) => (ws.getCell(addr).fill as { fgColor?: { argb?: string } }).fgColor?.argb
    expect(fill('G6')).toBe('FF93C5FD') // Saturday, body
    expect(fill('H7')).toBe('FF93C5FD') // Sunday, body
    expect(fill('G5')).toBe('FF3B82F6') // Saturday, heading
    expect(fill('B6')).toBeUndefined() // a weekday is not filled
  })

  it('has a month row above the days, one merged cell per month, so each date can be placed', async () => {
    const long = buildSheet(sessions, people, '2026-06-29', '2026-07-02', '2026-07-31')
    const file = await attendanceExcel(long, { company: 'Demo', from: '2026-06-29', to: '2026-07-02' })
    const { Workbook } = await import('exceljs')
    const wb = new Workbook()
    await wb.xlsx.load(await file.bytes())
    const ws = wb.getWorksheet('Attendance')!
    // columns B and C are 29 and 30 June, D and E are 1 and 2 July
    expect(ws.getCell('B4').value).toBe('June 2026')
    expect(ws.getCell('D4').value).toBe('July 2026')
    expect(ws.getCell('C4').master.address).toBe('B4')
    expect(ws.getCell('E4').master.address).toBe('D4')
  })
})
