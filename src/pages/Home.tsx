import { Link } from 'react-router-dom'
import { Leaf, Zap, BarChart3, Shield, Globe } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Real-Time Optimization',
    description: 'AI-driven analysis continuously monitors and optimizes your energy consumption patterns.',
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    description: 'Deep insights into usage trends, cost projections, and efficiency opportunities.',
  },
  {
    icon: Shield,
    title: 'Reliable & Secure',
    description: 'Enterprise-grade infrastructure with end-to-end encryption and uptime guarantees.',
  },
  {
    icon: Globe,
    title: 'Carbon Footprint Tracking',
    description: 'Measure and reduce your environmental impact with automated sustainability reporting.',
  },
]

export function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 py-32 text-center">
        <div className="mb-6 flex items-center justify-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
          <Leaf className="h-3.5 w-3.5 text-primary" />
          <span>AI-Powered Energy Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Smarter Energy,{' '}
          <span className="text-primary">Greener Future</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          EcoNode AI helps businesses and communities optimize energy usage, cut costs, and reduce their carbon footprint — all powered by intelligent automation.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            to="/app"
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            to="/support"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-8 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30 px-6 py-24">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Everything you need to go green
            </h2>
            <p className="mt-3 text-muted-foreground">
              A complete platform for modern energy management.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="px-6 py-24 text-center">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Ready to optimize your energy?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join thousands of organizations already saving energy and money with EcoNode AI.
          </p>
          <Link
            to="/app"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-10 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Start for Free
          </Link>
        </div>
      </section>
    </>
  )
}
