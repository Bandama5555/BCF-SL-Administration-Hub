import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | BCF-SL Administration Hub",
  description: "Sign in to access the Bandama Charity Foundation Sierra Leone Administration Hub.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
