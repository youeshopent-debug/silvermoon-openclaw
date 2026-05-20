import { getGuideBySlug, getGuides } from "@/content/guides"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, BookOpen } from "lucide-react"

export async function generateStaticParams() {
  return getGuides().map((guide) => ({ slug: guide.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}) {
  const guide = getGuideBySlug(params.slug)
  if (!guide) return {}

  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    openGraph: {
      title: `${guide.title} | DeepCalm AI`,
      description: guide.description,
      type: "article",
      publishedTime: guide.publishedAt,
    },
  }
}

const categoryGradients: Record<string, string> = {
  "助眠科学": "from-indigo-600/20 via-transparent to-transparent",
  "冥想技巧": "from-emerald-600/20 via-transparent to-transparent",
  "焦虑管理": "from-rose-600/20 via-transparent to-transparent",
  "呼吸技巧": "from-amber-600/20 via-transparent to-transparent",
}

const categoryDots: Record<string, string> = {
  "助眠科学": "bg-indigo-500",
  "冥想技巧": "bg-emerald-500",
  "焦虑管理": "bg-rose-500",
  "呼吸技巧": "bg-amber-500",
}

export default function GuideDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const guide = getGuideBySlug(params.slug)
  if (!guide) notFound()

  return (
    <main className="min-h-screen bg-nord-bg">
      <div
        className={`bg-gradient-to-b ${categoryGradients[guide.category] || "from-nord-accent/10 via-transparent to-transparent"}`}
      >
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/guide"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-nord-muted transition-colors hover:text-nord-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            返回指南列表
          </Link>

          <div className="mb-3 flex items-center gap-3">
            <span className={`inline-block h-2 w-2 rounded-full ${categoryDots[guide.category] || "bg-nord-accent"}`} />
            <span className="text-sm font-medium text-nord-muted">
              {guide.category}
            </span>
          </div>

          <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-nord-text sm:text-4xl">
            {guide.title}
          </h1>

          <p className="mb-6 text-lg leading-relaxed text-nord-muted">
            {guide.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-nord-muted">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {guide.readingTime}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {guide.publishedAt}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="space-y-10">
          {guide.sections.map((section, i) => (
            <div
              key={i}
              className="rounded-xl border border-nord-border/50 bg-nord-card p-6 transition-all duration-300 hover:border-nord-accent/20 sm:p-8"
            >
              <h2 className="mb-4 text-xl font-semibold leading-snug text-nord-text">
                {section.heading}
              </h2>
              <div className="leading-relaxed text-nord-muted">
                <p>{section.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-nord-border/30 pt-8 text-center">
          <p className="mb-4 text-sm text-nord-muted">
            希望这篇文章对你有帮助。如需专业心理支持，建议咨询持证心理治疗师。
          </p>
          <Link
            href="/guide"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-nord-accent transition-colors hover:text-nord-accent/80"
          >
            <ArrowLeft className="h-4 w-4" />
            浏览更多指南文章
          </Link>
        </div>
      </div>
    </main>
  )
}
