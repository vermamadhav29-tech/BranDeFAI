import Link from "next/link";
import PageShell, { Prose } from "@/components/draftr/shell/PageShell";

export const metadata = { title: "Terms of Service — BrandefAI", description: "The terms that apply when you use BrandefAI." };

export default function TermsPage() {
  return (
    <PageShell title="Terms of Service" subtitle="The simple rules for using BrandefAI." eyebrow="Last updated: October 2026">
      <Prose>
        <div className="bd-note">This is a plain-language draft that describes how the product works today. It should be reviewed by a legal professional before launch.</div>
        <h2>Using BrandefAI</h2>
        <p>BrandefAI helps you plan, create and publish marketing content. You must provide accurate information, keep your sign-in details secure, and use the service lawfully.</p>
        <h2>Credits and plans</h2>
        <p>AI generations use credits. A credit is deducted only when a generation completes successfully. Plans renew monthly and credits reset each billing period. The free trial lasts 3 days and includes a limited number of credits.</p>
        <h2>Billing and cancellation</h2>
        <p>Payments are processed by Razorpay. You can cancel at any time from your account settings; your plan and credits stay active until the end of the billing period you have paid for.</p>
        <h2>Your content and AI output</h2>
        <p>You keep ownership of what you upload and of the content generated for you. AI output can contain mistakes, so review everything before you publish. You are responsible for the content you post to your accounts.</p>
        <h2>Instagram publishing</h2>
        <p>When you connect Instagram, you authorise BrandefAI to publish the posts you schedule through the official Instagram API. You can disconnect at any time. You must follow Instagram&apos;s own terms and community guidelines.</p>
        <h2>Acceptable use</h2>
        <ul>
          <li>Do not upload content you do not have the right to use.</li>
          <li>Do not use the service to create unlawful, misleading or harmful content.</li>
          <li>Do not attempt to disrupt or reverse-engineer the service.</li>
        </ul>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms as the product evolves and will note the date above. Questions? <Link href="/contact">Contact us</Link>. See also our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Prose>
    </PageShell>
  );
}
