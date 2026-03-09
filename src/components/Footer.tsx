import { Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="flex flex-col gap-2">
            <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
              <Leaf className="h-4 w-4 text-primary" />
              <span>EcoNode AI</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Intelligent energy optimization for a sustainable future.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Resources</p>
            <nav className="flex flex-col gap-1">
              <Link to="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Support
              </Link>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} EcoNode AI. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
