import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModule, MODULES } from "@/lib/modules";
import { SubAppContent } from "@/components/SubAppContent";

interface Props {
  params: Promise<{ module: string }>;
}

export async function generateStaticParams() {
  return MODULES.map((mod) => ({ module: mod.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module: moduleSlug } = await params;
  const mod = getModule(moduleSlug);
  if (!mod) return { title: "Not Found" };
  return {
    title: mod.label,
    description: mod.description,
  };
}

export default async function ModulePage({ params }: Props) {
  const { module: moduleSlug } = await params;
  const mod = getModule(moduleSlug);

  if (!mod) notFound();

  // Instantly render the module's active primary screen
  const firstSub = mod.subApps.find((s) => !s.hidden) || mod.subApps[0];
  if (!firstSub) notFound();

  return <SubAppContent module={mod} subApp={firstSub} />;
}
