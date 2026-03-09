export function Privacy() {
  return (
    <div className="container mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2025</p>

      <div className="mt-10 space-y-10 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p className="mt-3">
            We collect information you provide directly (account registration, support requests) and information generated automatically when you use EcoNode AI (energy usage data, device telemetry, usage logs). We do not collect personally identifiable information beyond what is necessary to provide the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <p className="mt-3">
            Your data is used solely to operate, maintain, and improve EcoNode AI. This includes generating optimization recommendations, producing usage analytics, and providing customer support. We do not sell, rent, or share your personal data with third parties for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Data Security</h2>
          <p className="mt-3">
            All data transmitted to and from EcoNode AI is encrypted using TLS. Data at rest is encrypted using AES-256. We implement access controls, audit logging, and regular security assessments to protect your information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Data Retention</h2>
          <p className="mt-3">
            We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting support@econode.ai.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Cookies</h2>
          <p className="mt-3">
            EcoNode AI uses minimal, essential cookies required for authentication and session management. We do not use tracking or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
          <p className="mt-3">
            You have the right to access, correct, or delete your personal data. To exercise these rights, please contact us at support@econode.ai.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on this page and updating the "Last updated" date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
          <p className="mt-3">
            For privacy-related questions, contact us at{' '}
            <a href="mailto:privacy@econode.ai" className="text-primary hover:underline">
              privacy@econode.ai
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
