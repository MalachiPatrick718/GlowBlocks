export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed text-sm">
          <Section title="Overview">
            <p>
              GlowBlocks Studio (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) respects your privacy. This policy explains what information we collect, how we use it, and your rights regarding that information.
            </p>
          </Section>

          <Section title="Information we collect">
            <p>When you place an order or contact us, we may collect:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Name and email address</li>
              <li>Shipping address</li>
              <li>Payment information (processed securely through Stripe — we never see or store your card details)</li>
              <li>Order details (the letters, colours, and quantities you choose)</li>
              <li>Messages you send through our contact form</li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>To fulfil and ship your orders</li>
              <li>To communicate with you about your order</li>
              <li>To respond to your questions or support requests</li>
              <li>To improve our products and website</li>
            </ul>
          </Section>

          <Section title="Payment processing">
            <p>
              All payments are processed through Stripe. Your payment information is handled entirely by Stripe and is subject to their <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">privacy policy</a>. We do not store credit card numbers or payment details on our servers.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use minimal cookies to keep your cart working between pages. We do not use tracking cookies or sell your data to advertisers.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>We use the following services to operate:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Resend</strong> — email delivery for contact form messages</li>
              <li><strong>Netlify</strong> — website hosting</li>
            </ul>
            <p className="mt-2">Each service has its own privacy policy and handles data according to their own terms.</p>
          </Section>

          <Section title="Data retention">
            <p>
              We keep your order information for as long as needed to fulfil your order and handle any returns or support requests. Contact form messages are retained for up to 12 months. You can request deletion of your data at any time by contacting us.
            </p>
          </Section>

          <Section title="Your rights">
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Request access to the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Opt out of any marketing communications</li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              If you have questions about this policy, reach out through our{' '}
              <a href="/contact" className="text-purple-400 hover:text-purple-300 underline">contact page</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
