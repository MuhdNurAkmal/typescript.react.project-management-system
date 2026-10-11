/*
 * A faint, blurred project timeline behind the sign-in card: the page shows what the app is without a slogan.
 * Pure SVG, decorative only (aria-hidden), no network requests. The centre fades out so the form stays calm.
 */
const rows: { y: number; bars: { x: number; w: number; tone: string }[] }[] = [
  { y: 70, bars: [{ x: 60, w: 230, tone: 'fill-primary/25' }, { x: 330, w: 150, tone: 'fill-info/25' }, { x: 760, w: 260, tone: 'fill-primary/20' }] },
  { y: 140, bars: [{ x: 160, w: 300, tone: 'fill-success/25' }, { x: 520, w: 190, tone: 'fill-primary/25' }, { x: 900, w: 220, tone: 'fill-info/20' }] },
  { y: 210, bars: [{ x: 20, w: 170, tone: 'fill-info/25' }, { x: 260, w: 260, tone: 'fill-primary/20' }, { x: 640, w: 160, tone: 'fill-warning/30' }, { x: 860, w: 250, tone: 'fill-success/20' }] },
  { y: 280, bars: [{ x: 110, w: 200, tone: 'fill-primary/25' }, { x: 420, w: 330, tone: 'fill-info/20' }, { x: 840, w: 180, tone: 'fill-primary/25' }] },
  { y: 350, bars: [{ x: 300, w: 240, tone: 'fill-warning/25' }, { x: 600, w: 220, tone: 'fill-success/25' }, { x: 40, w: 190, tone: 'fill-primary/20' }, { x: 920, w: 200, tone: 'fill-info/25' }] },
  { y: 420, bars: [{ x: 70, w: 280, tone: 'fill-info/20' }, { x: 400, w: 170, tone: 'fill-primary/25' }, { x: 700, w: 300, tone: 'fill-primary/20' }] },
  { y: 490, bars: [{ x: 200, w: 210, tone: 'fill-success/20' }, { x: 470, w: 280, tone: 'fill-info/25' }, { x: 860, w: 230, tone: 'fill-warning/25' }] },
  { y: 560, bars: [{ x: 30, w: 240, tone: 'fill-primary/25' }, { x: 340, w: 180, tone: 'fill-success/25' }, { x: 640, w: 250, tone: 'fill-primary/20' }] },
]

export function SignInBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_20%_-10%,oklch(0.93_0.04_258/0.8),transparent),radial-gradient(50rem_35rem_at_100%_100%,oklch(0.94_0.03_235/0.7),transparent)]" />
      <svg
        viewBox="0 0 1200 620"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full blur-[1.5px] [mask-image:radial-gradient(ellipse_at_center,transparent_12%,black_75%)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-1000"
      >
        {[200, 400, 600, 800, 1000].map((x) => (
          <line key={x} x1={x} x2={x} y1={0} y2={620} className="stroke-primary/10" strokeWidth={1} />
        ))}
        <line x1={720} x2={720} y1={0} y2={620} className="stroke-primary/30" strokeWidth={2} strokeDasharray="6 6" />
        {rows.map((r) =>
          r.bars.map((b) => <rect key={`${r.y}-${b.x}`} x={b.x} y={r.y} width={b.w} height={26} rx={13} className={b.tone} />),
        )}
      </svg>
    </div>
  )
}
