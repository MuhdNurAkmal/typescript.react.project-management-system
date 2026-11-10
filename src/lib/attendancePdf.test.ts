import { describe, expect, it } from 'vitest'
import { attendancePdf } from '@/lib/attendancePdf'
import { buildSheet } from '@/lib/attendanceSheet'

const at = (day: string) => new Date(`${day}T09:00:00`).toISOString()

describe('attendancePdf', () => {
  const people = [
    { id: 'u1', name: 'Aina' },
    { id: 'u2', name: 'Budi' },
  ]
  const sessions = [
    { user_id: 'u1', clock_in: at('2026-06-01') },
    { user_id: 'u1', clock_in: at('2026-06-03') },
    { user_id: 'u2', clock_in: at('2026-06-02') },
  ]

  it('makes a PDF file', async () => {
    const sheet = buildSheet(sessions, people, '2026-06-01', '2026-06-14', '2026-06-10')
    const pdf = await attendancePdf(sheet, { company: 'Demo Sdn Bhd', from: '2026-06-01', to: '2026-06-14' })
    const bytes = new Uint8Array(pdf.bytes())
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    expect(pdf.pages).toBe(1)
  })

  it('gives every calendar month its own page', async () => {
    const sheet = buildSheet(sessions, people, '2026-06-01', '2026-07-20', '2026-07-31')
    const pdf = await attendancePdf(sheet, { company: 'Demo', from: '2026-06-01', to: '2026-07-20' })
    expect(pdf.pages).toBe(2)
  })

  it('makes one page per month, even for a short range that crosses a month end', async () => {
    const crossing = buildSheet(sessions, people, '2026-06-29', '2026-07-02', '2026-07-31')
    expect((await attendancePdf(crossing, { company: 'Demo', from: '2026-06-29', to: '2026-07-02' })).pages).toBe(2)
    const three = buildSheet(sessions, people, '2026-04-10', '2026-06-20', '2026-07-31')
    expect((await attendancePdf(three, { company: 'Demo', from: '2026-04-10', to: '2026-06-20' })).pages).toBe(3)
    const oneMonth = buildSheet(sessions, people, '2026-05-01', '2026-05-31', '2026-07-31')
    expect((await attendancePdf(oneMonth, { company: 'Demo', from: '2026-05-01', to: '2026-05-31' })).pages).toBe(1)
  })
})
