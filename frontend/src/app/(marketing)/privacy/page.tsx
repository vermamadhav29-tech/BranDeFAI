import Link from "next/link";
import PageShell, { Prose } from "@/components/draftr/shell/PageShell";

export const metadata = { title: "Privacy Policy — BrandefAI", description: "How BrandefAI collects, uses and protects your data." };

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy Policy" subtitle="What we collect, why we collect it, and the choices you have." eyebrow="Last updated: October 2026">
      <Prose>
        <div className="bd-note">This is a plain-language draft that describes how the product works today. It should be reviewed by a legal professional before launch.</div>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: your email address and sign-in information.</li>
          <li>Brand details you enter: brand name, industry, audience, tone and any logo or product photos you upload.</li>
          <li>Content you generate: captions, ad copy, images, videos and your content calendar.</li>
          <li>Instagram connection: when you connect an account, an access token that lets us publish on your behalf.</li>
          <li>Payments: handled by our payment provider, Razorpay. We do not store your card details.</li>
          <li>Basic usage data, such as pages visited and errors, to keep the service reliable.</li>
        </ul>
        <h2>How we use it</h2>
        <p>We use your information to provide BrandefAI: to generate content in your brand voice, schedule and publish posts you approve, manage your credits and billing, and give you support. We do not sell your personal data.</p>
        <h2>Service providers</h2>
        <p>To deliver the product we share the minimum necessary data with trusted providers: AI model providers (text, image and video generation), media storage, our hosting and database providers, Razorpay for payments, and Instagram (Meta) when you choose to publish.</p>
        <h2>Your content</h2>
        <p>You own the content you upload and the content generated for you. You are responsible for having the right to use the images and text you provide.</p>
        <h2>Retention and deletion</h2>
        <p>We keep your data while your account is active. You can disconnect Instagram at any time from Settings, and you can ask us to delete your account and associated data by writing to us.</p>
        <h2>Security</h2>
        <p>We use industry-standard safeguards such as encrypted connections and restricted access to production systems. No system is perfectly secure, and we encourage you to use a strong password.</p>
        <h2>Contact</h2>
        <p>
          Questions about this policy? <Link href="/contact">Get in touch</Link>. See also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </Prose>
    </PageShell>
  );
}
