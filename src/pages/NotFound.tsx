import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">That page does not exist.</p>
      <Link to="/" className="underline">
        Back to the dashboard
      </Link>
    </div>
  )
}
