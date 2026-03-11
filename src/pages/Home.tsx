import { Link } from 'react-router-dom'
import { Leaf, FileSearch, BarChart3, Shield, Scale } from 'lucide-react'

const features = [
  {
    icon: FileSearch,
    title: 'Automated Baseline Analysis',
    description: 'AI-powered assessment of your nature-related risks and dependencies — no consultants needed.',
  },
  {
    icon: BarChart3,
    title: 'TNFD-Ready Reports',
    description: 'Generate disclosure-ready profiles that satisfy lender requirements and regulatory frameworks.',
  },
  {
    icon: Shield,
    title: 'Fixable Risk Identification',
    description: 'Pinpoint actionable risks you can address now, with clear remediation pathways.',
  },
  {
    icon: Scale,
    title: 'Self-Serve Upgrades',
    description: 'Start with a free baseline and upgrade when you need deeper analysis or ongoing monitoring.',
  },
]

export function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 py-32 text-center">
        <div className="mb-6 flex items-center justify-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
          <Leaf className="h-3.5 w-3.5 text-primary" />
          <span>AI-Powered Nature Risk Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Low Cost{' '}
          <span className="text-primary">Actionable Risk Analytics</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          TNFD‑ready nature risk profiles for SMEs: automated baseline analysis + self‑serve upgrades that satisfy your bank and reveal fixable risks.
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
              Everything you need for nature risk compliance
            </h2>
            <p className="mt-3 text-muted-foreground">
              A complete platform for automated TNFD analysis and disclosure.
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
            Ready to understand your nature risk?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Get your TNFD-ready baseline analysis in minutes — no consultants, no complexity.
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
