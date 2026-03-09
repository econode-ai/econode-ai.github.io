export function Terms() {
  return (
    <div className="container mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2025</p>

      <div className="mt-10 space-y-10 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using EcoNode AI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. License to Use</h2>
          <p className="mt-3">
            EcoNode AI grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes, subject to these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Prohibited Uses</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
            <li>Use the Service for unlawful purposes or in violation of any regulations.</li>
            <li>Attempt to gain unauthorized access to any systems or networks.</li>
            <li>Resell, sublicense, or redistribute the Service without prior written consent.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Disclaimers</h2>
          <p className="mt-3">
            The Service is provided "as is" without warranties of any kind, express or implied. EcoNode AI does not warrant that the Service will be uninterrupted, error-free, or completely secure. Energy savings and optimization outcomes are estimates and may vary.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Limitation of Liability</h2>
          <p className="mt-3">
            To the fullest extent permitted by applicable law, EcoNode AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Modifications to the Service</h2>
          <p className="mt-3">
            We reserve the right to modify or discontinue the Service at any time, with or without notice. We are not liable to you or any third party for any modification, suspension, or discontinuation of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Governing Law</h2>
          <p className="mt-3">
            These Terms are governed by and construed in accordance with applicable law. Any disputes arising from these Terms shall be resolved through binding arbitration.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
          <p className="mt-3">
            Questions about these Terms? Contact us at{' '}
            <a href="mailto:legal@econode.ai" className="text-primary hover:underline">
              legal@econode.ai
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
