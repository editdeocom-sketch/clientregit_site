import type { ReactNode } from 'react'

const LNK = 'text-gold-strong underline underline-offset-2 hover:text-gold'

function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }): ReactNode {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-8 text-sm leading-relaxed text-ink/90">{children}</div>
    </div>
  )
}

function H2({ children }: { children: ReactNode }): ReactNode {
  return <h2 className="mt-10 mb-3 text-xl font-bold tracking-tight first:mt-0">{children}</h2>
}

function H3({ children }: { children: ReactNode }): ReactNode {
  return <h3 className="mt-6 mb-2 text-base font-semibold">{children}</h3>
}

function P({ children }: { children: ReactNode }): ReactNode {
  return <p className="mt-3 first:mt-0">{children}</p>
}

function UL({ children }: { children: ReactNode }): ReactNode {
  return <ul className="mt-2 list-disc space-y-1.5 pl-5">{children}</ul>
}

function Support(): ReactNode {
  return (
    <>
      {' '}
      <a href="mailto:support.clientregit@gmail.com" className={LNK}>
        support.clientregit@gmail.com
      </a>
    </>
  )
}

export function Privacy(): ReactNode {
  return (
    <LegalShell title="Privacy Policy" updated="15 October 2026">
      <P>
        ClientRegit respects your privacy. This Privacy Policy explains how information is collected, used, stored,
        shared, and deleted when you use our desktop application, website, and related services.
      </P>
      <P>
        ClientRegit is a client-management application designed for video editors, creative freelancers, and other
        professionals. It includes client and project management, tasks, invoices, reports, Google Meet integration,
        licensing, and optional account synchronization.
      </P>
      <P>By using ClientRegit, you acknowledge this Privacy Policy.</P>

      <H2>1. Information We Collect</H2>

      <H3>1.1 Information You Enter</H3>
      <P>Depending on the features you use, ClientRegit may process information you enter, including:</P>
      <UL>
        <li>Client names, email addresses, telephone numbers, business details, notes, and tags.</li>
        <li>Project descriptions, quotations, deadlines, tasks, revision statuses, and file or folder links.</li>
        <li>Invoice details, line items, tax amounts, discounts, payment records, and currency information.</li>
        <li>Information contained in backups, imports, and exports that you choose to create or process.</li>
      </UL>
      <P>
        You are responsible for having an appropriate legal basis to store and process your clients&apos; personal
        information.
      </P>

      <H3>1.2 Account Information</H3>
      <P>
        If you create or sign in to a ClientRegit account, we may process information such as your email address,
        authentication identifiers, account preferences, and information needed to provide account synchronization and
        licensing.
      </P>
      <P>
        Authentication is provided through our configured authentication services, including Supabase where
        applicable.
      </P>

      <H3>1.3 Google Account and Google Meet Information</H3>
      <P>
        If you connect your Google account, ClientRegit may request access to the Google information and permissions
        necessary to provide the Google Meet features you authorize.
      </P>
      <P>
        Depending on the permissions configured, this may include Google account identification, access tokens,
        meeting creation, meeting links, and information about upcoming meetings.
      </P>
      <P>We use this access to:</P>
      <UL>
        <li>Connect your Google account to ClientRegit.</li>
        <li>Create Google Meet links when you request them.</li>
        <li>Display meeting information needed for the integration.</li>
        <li>Maintain the authorized connection until you disconnect it or revoke access.</li>
      </UL>
      <P>
        ClientRegit does not use Google user data for advertising, sell Google user data, or use it to build
        advertising profiles.
      </P>
      <P>
        Google data is not shared with third parties except as necessary to provide the requested functionality,
        comply with applicable law, or as otherwise disclosed and permitted.
      </P>
      <P>
        Google OAuth access tokens are encrypted using Electron&apos;s <code className="font-mono text-xs">safeStorage</code>{' '}
        mechanism before local storage. The protection provided depends on the operating system&apos;s underlying secure
        storage facilities.
      </P>
      <P>
        You can disconnect your Google account from ClientRegit and revoke access through your Google Account security
        settings.
      </P>
      <P>
        Our use and transfer of information received from Google APIs complies with the Google API Services User Data
        Policy, including its Limited Use requirements where applicable.
      </P>

      <H3>1.4 License and Purchase Information</H3>
      <P>
        We may process license keys, activation status, trial status, subscription status, device or activation
        identifiers, and purchase records to activate software, enforce license limits, process payments, and provide
        support.
      </P>
      <P>
        Payment providers, including Razorpay when used, may process payment information under their own privacy
        policies. ClientRegit does not claim to store complete payment-card information unless explicitly stated for a
        particular payment flow.
      </P>

      <H3>1.5 Technical Information</H3>
      <P>
        Depending on the services and features enabled, we or our service providers may process limited technical
        information such as application version, operating system, authentication events, license-validation requests,
        synchronization timestamps, and error information needed for troubleshooting and security.
      </P>
      <P>
        We do not assume that analytics or crash-reporting services are enabled unless they are actually implemented in
        the application.
      </P>

      <H2>2. Where Your Information Is Stored</H2>

      <H3>2.1 Local Storage</H3>
      <P>
        ClientRegit is designed to keep your data local by default. Application records may be stored in a local SQLite
        database on your computer.
      </P>
      <P>
        Information stored locally can include client records, projects, tasks, invoices, preferences, and other
        application data.
      </P>
      <P>
        You control your computer and are responsible for protecting it with appropriate account security, disk
        encryption, backups, and access controls.
      </P>

      <H3>2.2 Optional Account Synchronization</H3>
      <P>
        If you use account synchronization, the information selected for synchronization may be transmitted to and
        stored on our backend infrastructure, including Supabase.
      </P>
      <P>
        Depending on your account type, synchronized records may be associated with your individual account or a team
        workspace.
      </P>
      <P>
        <strong>
          Local storage does not mean that all data remains exclusively on your computer when synchronization is
          enabled.
        </strong>{' '}
        Synchronization requires data to be transmitted to remote servers so it can follow your account across
        supported devices.
      </P>
      <P>
        You should review the synchronization settings and the information being synchronized before enabling this
        feature.
      </P>

      <H3>2.3 Backups and Exports</H3>
      <P>
        ClientRegit may allow you to export CSV files or create JSON backups. Files you export are stored wherever you
        choose to save them. Their protection and subsequent use are your responsibility.
      </P>

      <H2>3. How We Use Information</H2>
      <P>We use information to:</P>
      <UL>
        <li>Provide client, project, task, invoice, calendar, and reporting features.</li>
        <li>Synchronize authorized records across supported devices.</li>
        <li>Authenticate users and manage account access.</li>
        <li>Activate, validate, and enforce software licenses and trial restrictions.</li>
        <li>Process purchases, subscriptions, refunds, and related requests.</li>
        <li>Provide Google Meet functionality requested by you.</li>
        <li>Respond to support requests and troubleshoot technical problems.</li>
        <li>Protect the application, detect abuse, and prevent unauthorized access.</li>
        <li>Meet applicable legal, tax, accounting, and regulatory obligations.</li>
      </UL>
      <P>We do not sell your personal information.</P>

      <H2>4. Service Providers and Sharing</H2>
      <P>
        We may share the minimum information necessary with service providers that help operate ClientRegit, including:
      </P>
      <UL>
        <li>
          <strong>Supabase:</strong> authentication, database hosting, and account synchronization.
        </li>
        <li>
          <strong>Google:</strong> authentication and Google Meet functionality that you authorize.
        </li>
        <li>
          <strong>Razorpay or another configured payment provider:</strong> payment processing and related transaction
          operations.
        </li>
        <li>
          <strong>Email service providers:</strong> transactional messages, such as account, license, purchase, or
          support emails.
        </li>
        <li>
          <strong>Software update infrastructure:</strong> distribution of application updates where enabled.
        </li>
      </UL>
      <P>These providers process information according to their applicable terms, privacy policies, and service arrangements.</P>
      <P>
        We may also disclose information when legally required, to protect users or our rights, or as part of a
        business transfer subject to applicable law.
      </P>
      <P>We do not share client records with unrelated third parties for their own advertising purposes.</P>

      <H2>5. Data Security</H2>
      <P>
        We use technical and organizational measures appropriate to the services provided. These may include local
        database storage, access controls, encrypted connections, secure authentication, and encrypted local storage
        for Google OAuth tokens.
      </P>
      <P>
        No software, device, or online service can guarantee absolute security. You should keep your operating system
        and application updated and protect access to your computer and account.
      </P>

      <H2>6. Data Retention and Deletion</H2>
      <P>Local data generally remains on your device until you delete it or remove the application data.</P>
      <P>
        Synchronized data may remain on our servers while your account or workspace is active, subject to applicable
        retention requirements and operational needs.
      </P>
      <P>
        You may request deletion of account-associated information by emailing
        <Support />. We may need to verify your identity before acting on a request.
      </P>
      <P>
        Deleting an account or uninstalling ClientRegit does not necessarily remove exported files, backups, records
        retained for legal obligations, or every copy held temporarily in backups. We will handle deletion requests in
        accordance with applicable law and our actual retention practices.
      </P>

      <H2>7. Your Privacy Rights</H2>
      <P>
        Depending on your location and applicable law, you may have rights to request access to, correction of, or
        deletion of personal information, withdraw consent, or raise a privacy complaint.
      </P>
      <P>
        To submit a request, contact <Support />. We will respond in accordance with applicable legal requirements.
      </P>
      <P>
        If you are a ClientRegit user who stores information about your own clients, you remain responsible for
        responding to those clients&apos; privacy requests where you act as the controller or equivalent responsible
        party.
      </P>

      <H2>8. Children&apos;s Privacy</H2>
      <P>
        ClientRegit is intended for professional and business use, not for children. We do not knowingly seek to
        collect personal information from children in violation of applicable law.
      </P>

      <H2>9. International Processing</H2>
      <P>
        Our service providers may process information in countries other than your own. Where applicable, we take
        steps required by law to support lawful transfers and appropriate protection of personal information.
      </P>

      <H2>10. Third-Party Services</H2>
      <P>
        Google, Supabase, payment providers, and other service providers may have separate privacy policies and terms.
        Their processing of information through their own services is subject to those policies.
      </P>

      <H2>11. Changes to This Policy</H2>
      <P>
        We may update this Privacy Policy when ClientRegit or its legal requirements change. We will publish the
        revised policy on our website and update the revision date.
      </P>
      <P>Material changes will be communicated through appropriate channels where required by law.</P>

      <H2>12. Contact Us</H2>
      <P>For privacy questions, data requests, or complaints, contact:</P>
      <P>
        <strong>ClientRegit Support</strong>
        <br />
        Email:{' '}
        <a href="mailto:support.clientregit@gmail.com" className={LNK}>
          support.clientregit@gmail.com
        </a>
        <br />
        Website:{' '}
        <a href="https://clientregit.com" className={LNK}>
          https://clientregit.com
        </a>
      </P>
    </LegalShell>
  )
}

export function Terms(): ReactNode {
  return (
    <LegalShell title="Terms of Service" updated="15 October 2026">
      <P>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of ClientRegit, its desktop application, website,
        licenses, subscriptions, and related services.
      </P>
      <P>
        By installing, purchasing, activating, or using ClientRegit, you agree to these Terms. If you do not agree, do
        not use the service.
      </P>

      <H2>1. About ClientRegit</H2>
      <P>ClientRegit is a desktop client-management application designed for video editors, creative freelancers, and other professionals.</P>
      <P>
        Features may include client management, project tracking, tasks, invoices, tax calculations, reports, calendar
        tools, Google Meet integration, account synchronization, backups, exports, and license management.
      </P>
      <P>
        Features may change over time, and some functionality may depend on your license, account type, operating
        system, internet connection, or third-party services.
      </P>

      <H2>2. Eligibility and Accounts</H2>
      <P>You must have the legal capacity required to enter into these Terms in your jurisdiction.</P>
      <P>
        You are responsible for providing accurate account information, protecting your credentials, and ensuring that
        activity under your account or license is authorized.
      </P>
      <P>Notify us promptly if you believe your account or license has been accessed without permission.</P>

      <H2>3. Software License</H2>
      <P>
        Subject to your purchase, trial, and applicable license conditions, ClientRegit grants you a limited,
        non-exclusive, non-transferable license to install and use the application for its intended business or
        personal professional purposes.
      </P>
      <P>
        Your license may be limited by plan, number of authorized devices, subscription status, activation rules, or
        other restrictions disclosed at purchase.
      </P>
      <P>Team licenses may permit use on a specified number of machines or authorized users, depending on the plan purchased.</P>
      <P>Unless applicable law permits otherwise, you may not:</P>
      <UL>
        <li>Redistribute, resell, sublicense, or commercially exploit the software independently of an authorized license.</li>
        <li>Circumvent license validation, activation, or technical restrictions.</li>
        <li>Reverse engineer, decompile, or modify the software except where legally permitted.</li>
        <li>Use the software for unlawful activity or to infringe another person&apos;s rights.</li>
      </UL>
      <P>
        You retain ownership of your own data. These Terms do not transfer ownership of your clients&apos; information,
        project files, invoices, or other content to ClientRegit.
      </P>

      <H2>4. Free Trial and Activation</H2>
      <P>
        ClientRegit may offer a seven-day trial. Trial availability, start date, feature access, and expiration are
        determined by the application and the terms presented when the trial is activated.
      </P>
      <P>A trial may expire automatically. Continued use of paid features may require a valid license or subscription.</P>
      <P>
        License keys, including CRIT-format keys, must be used according to the plan purchased. You may not share,
        duplicate, or transfer a license in a way that violates its stated device or seat limits.
      </P>
      <P>
        Eligible Individual licenses may continue to work offline after activation, subject to the application&apos;s
        validation rules. Team licenses require an internet connection for periodic seat verification.
      </P>

      <H2>5. Pricing and Payments</H2>
      <P>
        Prices, billing intervals, license limits, included features, and payment conditions are presented at checkout
        or in the applicable offer.
      </P>
      <P>
        ClientRegit may offer one-time purchases and monthly or yearly subscriptions. Prices may be displayed in INR or
        USD, as applicable.
      </P>
      <P>
        For eligible transactions in India, applicable GST and other taxes will be calculated and displayed as required
        at checkout. The final payable amount is the amount shown before you confirm payment.
      </P>
      <P>
        Payments may be processed by Razorpay or another payment provider made available at checkout. Your payment may
        also be subject to that provider&apos;s terms.
      </P>
      <P>We may correct pricing or billing errors, subject to applicable law and any refund rights you have.</P>

      <H2>6. Subscriptions and Cancellation</H2>
      <P>Subscriptions renew according to the billing interval and renewal terms disclosed at purchase.</P>
      <P>
        You may cancel a subscription using the available account or billing controls or by contacting
        <Support />.
      </P>
      <P>
        Cancellation stops future renewals when processed successfully, but access may continue until the end of the
        paid period unless otherwise stated or required by law.
      </P>
      <P>Refund eligibility is governed by our Refund Policy and applicable law.</P>

      <H2>7. Refunds</H2>
      <P>
        ClientRegit offers a 14-day refund policy subject to the conditions and process set out in the Refund Policy
        published at{' '}
        <a href="/refunds" className={LNK}>
          https://clientregit.com/refunds
        </a>
        .
      </P>
      <P>
        The Refund Policy forms part of these Terms. Nothing in these Terms removes mandatory rights you may have under
        applicable consumer-protection law.
      </P>

      <H2>8. Your Data and Account Synchronization</H2>
      <P>
        ClientRegit is designed for local data storage by default. If you enable account synchronization, eligible
        records may be transmitted to and stored on remote infrastructure so they can follow your account across
        supported devices.
      </P>
      <P>You are responsible for:</P>
      <UL>
        <li>Maintaining appropriate backups of important business information.</li>
        <li>Ensuring that you have permission to store and process your clients&apos; information.</li>
        <li>Reviewing which data you choose to synchronize.</li>
        <li>Protecting your devices, accounts, exported files, and backups.</li>
      </UL>
      <P>
        We do not guarantee that every record can be recovered following device failure, accidental deletion,
        corruption, or circumstances outside our reasonable control. Keep independent backups of important
        information.
      </P>
      <P>
        Our collection and handling of personal information are described in the Privacy Policy at{' '}
        <a href="/privacy" className={LNK}>
          https://clientregit.com/privacy
        </a>
        .
      </P>

      <H2>9. Google Meet and Third-Party Services</H2>
      <P>
        Google Meet integration requires a compatible Google account and may depend on Google&apos;s APIs,
        permissions, availability, and terms.
      </P>
      <P>You authorize only the Google access that you grant through the relevant consent process. You may revoke that access through Google.</P>
      <P>
        ClientRegit does not own or control Google Meet, Supabase, payment providers, email services, or other
        third-party services. Their availability and use are subject to their respective terms and policies.
      </P>
      <P>
        We are not responsible for interruptions caused by third-party services outside our reasonable control. This
        does not limit rights that cannot legally be excluded.
      </P>

      <H2>10. Invoices, GST, and Business Records</H2>
      <P>
        ClientRegit provides tools for preparing invoices, calculating amounts, recording payments, and displaying tax
        calculations.
      </P>
      <P>
        These tools are for administrative assistance. You are responsible for checking invoice accuracy, tax rates,
        GST applicability, invoice numbering, required disclosures, accounting records, and compliance with laws that
        apply to your business.
      </P>
      <P>
        The availability of an 18% GST calculation does not mean that every transaction is subject to that rate. Seek
        advice from a qualified tax professional when necessary.
      </P>
      <P>ClientRegit does not provide legal, tax, or accounting advice.</P>

      <H2>11. Updates and Compatibility</H2>
      <P>
        ClientRegit may provide bug fixes, security patches, feature updates, and application updates through its
        configured update mechanism.
      </P>
      <P>
        We may change, improve, suspend, or discontinue features when reasonably necessary for maintenance, security,
        technical compatibility, or business reasons, subject to applicable law and any commitments expressly made at
        purchase.
      </P>
      <P>
        We do not guarantee that every release will support every operating system version, device, or third-party
        integration indefinitely.
      </P>

      <H2>12. Acceptable Use</H2>
      <P>
        You must not use ClientRegit to commit fraud, violate privacy or data-protection laws, distribute unlawful
        material, infringe intellectual property rights, interfere with our services, or bypass security and licensing
        restrictions.
      </P>
      <P>
        You are responsible for your use of the application and the information you enter or process through it.
      </P>

      <H2>13. Intellectual Property</H2>
      <P>
        ClientRegit and its associated software, branding, design, documentation, and original materials are owned by
        or licensed to their respective rights holders.
      </P>
      <P>Except for the limited license granted in these Terms, no ownership rights are transferred to you.</P>

      <H2>14. Availability and Disclaimer</H2>
      <P>ClientRegit is provided subject to applicable warranties and rights under law.</P>
      <P>
        To the extent permitted by law, we do not guarantee uninterrupted, error-free, or universally compatible
        operation. We do not guarantee that third-party services will remain available or that all data can be
        recovered in every circumstance.
      </P>
      <P>Nothing in these Terms excludes a warranty, consumer right, or remedy that cannot lawfully be excluded.</P>

      <H2>15. Limitation of Liability</H2>
      <P>
        To the extent permitted by applicable law, ClientRegit will not be liable for indirect, incidental, special, or
        consequential losses arising from use of the software, including loss of anticipated profits, business
        opportunities, or data.
      </P>
      <P>
        To the extent permitted by law, our total liability for claims arising from ClientRegit will be limited to the
        amount you paid to us for the relevant product or service during the 12 months preceding the event giving rise
        to the claim.
      </P>
      <P>
        These limitations do not apply to liability that cannot legally be limited or excluded, including any
        applicable mandatory consumer rights.
      </P>

      <H2>16. Suspension and Termination</H2>
      <P>
        We may suspend or terminate a license or account where reasonably necessary to address fraud, unlawful
        activity, serious security risks, license abuse, or a material breach of these Terms.
      </P>
      <P>Where appropriate and legally permitted, we will provide notice and an opportunity to resolve the issue.</P>
      <P>
        You may stop using ClientRegit at any time. Ending use does not automatically delete synchronized information,
        cancel a subscription, or entitle you to a refund. Handle those actions separately where applicable.
      </P>

      <H2>17. Changes to These Terms</H2>
      <P>
        We may update these Terms to reflect changes to the software, business operations, or legal requirements. The
        revised version will be published on our website with an updated date.
      </P>
      <P>
        Where required by law, we will notify you of material changes or obtain any necessary consent.
      </P>

      <H2>18. Governing Law and Disputes</H2>
      <P>
        These Terms are subject to the laws of India, to the extent applicable and without depriving consumers of
        mandatory protections available under the laws that apply to them.
      </P>
      <P>
        Any court jurisdiction or dispute-resolution arrangement will be subject to applicable law, including mandatory
        consumer-protection rules.
      </P>

      <H2>19. Contact</H2>
      <P>For questions about these Terms, licensing, payments, or the application, contact:</P>
      <P>
        <strong>ClientRegit Support</strong>
        <br />
        Email:{' '}
        <a href="mailto:support.clientregit@gmail.com" className={LNK}>
          support.clientregit@gmail.com
        </a>
        <br />
        Website:{' '}
        <a href="https://clientregit.com" className={LNK}>
          https://clientregit.com
        </a>
      </P>
    </LegalShell>
  )
}

export function Refunds(): ReactNode {
  return (
    <LegalShell title="Refund Policy" updated="15 October 2026">
      <P>
        At ClientRegit, we want customers to be able to evaluate their purchase fairly. This Refund Policy explains how
        to request a refund for a ClientRegit license or subscription.
      </P>

      <H2>1. 14-Day Refund Period</H2>
      <P>
        You may request a refund within 14 calendar days of the original purchase of an eligible ClientRegit license or
        subscription.
      </P>
      <P>For a subscription renewal, you may request a refund within 14 calendar days of that renewal charge.</P>
      <P>
        Refunds remain subject to applicable law and the payment provider&apos;s processing requirements. Any mandatory
        consumer rights take precedence over conflicting terms in this policy.
      </P>

      <H2>2. Eligible Purchases</H2>
      <P>The 14-day refund period applies to eligible ClientRegit purchases, including:</P>
      <UL>
        <li>Individual lifetime licenses.</li>
        <li>Team licenses and seat-based purchases.</li>
        <li>Monthly subscriptions.</li>
        <li>Yearly subscriptions.</li>
      </UL>
      <P>
        If your purchase includes multiple licenses or seats, clearly identify the transaction and the portion for
        which you are requesting a refund.
      </P>

      <H2>3. How to Request a Refund</H2>
      <P>
        To request a refund, email{' '}
        <a href="mailto:support.clientregit@gmail.com" className={LNK}>
          support.clientregit@gmail.com
        </a>{' '}
        with the following information:
      </P>
      <UL>
        <li>The email address used for your purchase.</li>
        <li>Your order or payment reference.</li>
        <li>The product or subscription purchased.</li>
        <li>The purchase date.</li>
        <li>A brief description of your request.</li>
      </UL>
      <P>
        Please use the subject line <strong>&ldquo;ClientRegit Refund Request.&rdquo;</strong>
      </P>
      <P>
        We may ask for reasonable additional information to verify the purchase and prevent fraudulent refunds. Do not
        email passwords, full payment-card details, or other unnecessary sensitive information.
      </P>
      <P>We will review your request and communicate the outcome by email.</P>

      <H2>4. Refund Processing</H2>
      <P>
        If your refund is approved, we will initiate it through the original payment method or the applicable payment
        provider&apos;s refund process, where available.
      </P>
      <P>
        The time it takes for funds to appear in your account depends on your bank, card issuer, payment provider, and
        payment method.
      </P>
      <P>Any legally required refund deadlines will be observed.</P>

      <H2>5. Subscriptions and Renewals</H2>
      <P>You may cancel a subscription to prevent future renewals. Cancellation does not necessarily refund the current billing period.</P>
      <P>
        If you request a refund within the applicable 14-day period, we will assess it under this policy and applicable
        law.
      </P>
      <P>
        After cancellation, access may continue until the end of the paid period unless otherwise stated or required by
        law.
      </P>

      <H2>6. Taxes and GST</H2>
      <P>
        Where a refund is issued for a purchase that included GST or other taxes, the refund and any corresponding
        tax-document adjustments will be handled in accordance with applicable law and the original transaction.
      </P>
      <P>
        The final amount returned may depend on the transaction and legal requirements. We will not retain an amount
        where applicable law requires it to be refunded.
      </P>

      <H2>7. Duplicate or Unauthorized Payments</H2>
      <P>
        If you believe you were charged more than once for the same purchase or that a payment was unauthorized,
        contact{' '}
        <a href="mailto:support.clientregit@gmail.com" className={LNK}>
          support.clientregit@gmail.com
        </a>{' '}
        promptly.
      </P>
      <P>We will investigate the transaction and coordinate with the payment provider where necessary.</P>

      <H2>8. License and Access After a Refund</H2>
      <P>
        When a refund is completed, the associated license or subscription may be deactivated, and access to paid
        features may end.
      </P>
      <P>
        You remain responsible for retaining any local records or exports you need. Before removing the application or
        its local data, export or back up important information where possible.
      </P>
      <P>
        A refund does not automatically delete your account or synchronized data. Contact support if you also wish to
        request account or data deletion.
      </P>

      <H2>9. No Waiver of Legal Rights</H2>
      <P>
        This policy does not remove any rights or remedies available under applicable consumer-protection law. Where
        the law provides a more favorable mandatory right to a refund or cancellation, that right will apply.
      </P>

      <H2>10. Contact Us</H2>
      <P>For refund questions or to submit a request, contact:</P>
      <P>
        <strong>ClientRegit Support</strong>
        <br />
        Email:{' '}
        <a href="mailto:support.clientregit@gmail.com" className={LNK}>
          support.clientregit@gmail.com
        </a>
        <br />
        Website:{' '}
        <a href="https://clientregit.com" className={LNK}>
          https://clientregit.com
        </a>
      </P>
    </LegalShell>
  )
}
