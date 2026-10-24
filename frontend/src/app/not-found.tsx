import Link from "next/link";
import "@/styles/draftr-fonts.css";
import "@/styles/draftr.css";
import "@/styles/draftr-extra.css";
import PageShell, { Prose } from "@/components/draftr/shell/PageShell";

export const metadata = { title: "Page not found — BrandefAI" };

export default function NotFound() {
  return (
    <PageShell title="Page not found" subtitle="The page you are looking for does not exist or has moved." eyebrow="404">
      <Prose>
        <p style={{ textAlign: "center" }}>
          <Link href="/" className="bd-btn">
            Back to home
          </Link>
        </p>
      </Prose>
    </PageShell>
  );
}
