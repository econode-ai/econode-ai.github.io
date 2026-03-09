import { Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 max-w-6xl items-center px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 transition-opacity">
          <Leaf className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">EcoNode AI</span>
        </Link>
      </div>
    </header>
  )
}
