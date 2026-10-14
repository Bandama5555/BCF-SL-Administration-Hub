import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModule, getSubApp, MODULES } from "@/lib/modules";
import { SubAppContent } from "@/components/SubAppContent";

interface Props {
  params: Promise<{ module: string; subapp: string }>;
}

export async function generateStaticParams() {
  return MODULES.flatMap((mod) =>
    mod.subApps.map((sub) => ({ module: mod.slug, subapp: sub.id }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module: moduleSlug, subapp: subAppId } = await params;
  const mod = getModule(moduleSlug);
  const sub = getSubApp(moduleSlug, subAppId);
  if (!mod || !sub) return { title: "Not Found" };
  return {
    title: `${sub.label} — ${mod.shortLabel}`,
    description: sub.description,
  };
}

export default async function SubAppPage({ params }: Props) {
  const { module: moduleSlug, subapp: subAppId } = await params;
  const mod = getModule(moduleSlug);
  const sub = getSubApp(moduleSlug, subAppId);

  if (!mod || !sub) notFound();

  return <SubAppContent module={mod} subApp={sub} />;
}
