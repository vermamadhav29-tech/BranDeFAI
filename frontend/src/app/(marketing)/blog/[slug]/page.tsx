import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageShell, { Prose } from "@/components/draftr/shell/PageShell";
import { POSTS, postBySlug } from "@/components/draftr/content/posts";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return {};
  return { title: `${post.title} — BrandefAI`, description: post.excerpt };
}

function readingMinutes(text: string) {
  return Math.max(2, Math.round(text.split(/\s+/).length / 200));
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();
  const words = post.body.map((b) => ("p" in b ? b.p : "h" in b ? b.h : b.ul.join(" "))).join(" ");
  return (
    <PageShell title={post.title} subtitle={post.excerpt} eyebrow={`${post.date} · ${readingMinutes(words)} min read`}>
      <Prose>
        <Link href="/blog" className="bd-back">
          ← All articles
        </Link>
        {post.body.map((b, i) =>
          "h" in b ? (
            <h2 key={i}>{b.h}</h2>
          ) : "ul" in b ? (
            <ul key={i}>
              {b.ul.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b.p}</p>
          ),
        )}
        <div className="bd-cta">
          <h2>Put your content on autopilot</h2>
          <p>BrandefAI plans, creates and posts a full month of Instagram content in your brand voice. Start with a free 3-day trial.</p>
          <Link href="/login" className="bd-btn">
            Start free trial
          </Link>
        </div>
      </Prose>
    </PageShell>
  );
}
