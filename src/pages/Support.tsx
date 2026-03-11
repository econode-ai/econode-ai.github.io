import { Mail, MessageCircle, FileText } from 'lucide-react'

const faqs = [
  {
    question: 'What does EcoNode AI do?',
    answer:
      'EcoNode AI provides low-cost, automated nature risk analytics for SMEs. It generates TNFD-ready baseline profiles that reveal fixable risks and satisfy lender disclosure requirements — all without needing external consultants.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. All data is encrypted in transit and at rest. We never sell your data to third parties, and you retain full ownership of your usage data.',
  },
  {
    question: 'What is TNFD and why does it matter?',
    answer:
      'The Taskforce on Nature-related Financial Disclosures (TNFD) is a framework for organisations to report and act on nature-related risks and opportunities. Banks and investors increasingly expect TNFD-aligned disclosures from the businesses they fund.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Click "Get Started Free" from the home page. You can run a free baseline analysis immediately — no account or credit card required.',
  },
]

export function Support() {
  return (
    <div className="container mx-auto max-w-4xl px-6 py-20">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">Support</h1>
      <p className="mt-4 text-muted-foreground">
        We're here to help. Browse our FAQ or reach out directly.
      </p>

      {/* Contact options */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Mail, title: 'Email Us', desc: 'support@econode.ai', href: 'mailto:support@econode.ai' },
          { icon: MessageCircle, title: 'Community', desc: 'Join the discussion', href: '#' },
          { icon: FileText, title: 'Docs', desc: 'Read the documentation', href: '#' },
        ].map(({ icon: Icon, title, desc, href }) => (
          <a
            key={title}
            href={href}
            className="flex flex-col gap-3 rounded-lg border border-border bg-background p-6 hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </a>
        ))}
      </div>

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Frequently Asked Questions</h2>
        <div className="mt-6 space-y-6">
          {faqs.map(({ question, answer }) => (
            <div key={question} className="border-b border-border pb-6 last:border-0">
              <h3 className="font-semibold text-foreground">{question}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
