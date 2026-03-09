import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-40 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
      >
        Go Home
      </Link>
    </div>
  )
}
