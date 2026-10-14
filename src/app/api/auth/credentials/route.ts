import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToBackend(req, "/api/auth/credentials", async () => {
    return Response.json({
      success: true,
      count: 6,
      defaultPasswordNotice: "All system accounts can log in using either 'BCF@2026' or 'Password123!'.",
      credentials: [
        {
          role: "Super Admin",
          fullName: "Albert Joseph Bandama",
          title: "Chief Executive Officer (CEO)",
          department: "Executive Management",
          email: "admin@bcfsl.org",
          username: "abandama",
          password: "ChangeMe123!",
          badgeColor: "purple",
          accessLevel: "Level 1 — Full System Control",
          isPrimary: true,
        },
        {
          role: "HRM Director",
          fullName: "Joe Ansumana Conteh",
          title: "Human Resources Director",
          department: "Human Resources Management Department",
          email: "joe.conteh@bcf-sl.org",
          username: "jconteh",
          password: "BCF@2026",
          badgeColor: "emerald",
          accessLevel: "Departmental / Executive",
          isPrimary: true,
        },
        {
          role: "Finance Director",
          fullName: "Mariama Bangura",
          title: "Finance Director",
          department: "Finance Department",
          email: "mariama.bangura@bcf-sl.org",
          username: "mbangura",
          password: "BCF@2026",
          badgeColor: "blue",
          accessLevel: "Departmental / Executive",
          isPrimary: true,
        },
        {
          role: "IT Director",
          fullName: "Ibrahim Koroma",
          title: "IT Director",
          department: "ICT Department",
          email: "i.koroma@bcf-sl.org",
          username: "ikoroma",
          password: "BCF@2026",
          badgeColor: "cyan",
          accessLevel: "Departmental / Technical",
          isPrimary: false,
        },
        {
          role: "Procurement Officer",
          fullName: "Hawa Kanu",
          title: "Procurement Officer",
          department: "Procurement Department",
          email: "h.kanu@bcf-sl.org",
          username: "hkanu",
          password: "BCF@2026",
          badgeColor: "amber",
          accessLevel: "Frontline Operations",
          isPrimary: false,
        },
        {
          role: "Programme Officer",
          fullName: "Sahr Emmanuel Bangura",
          title: "Programme Officer",
          department: "Programs Department",
          email: "sahr.bangura@bcf.sl",
          username: "sbangura",
          password: "BCF@2026",
          badgeColor: "teal",
          accessLevel: "Frontline Operations",
          isPrimary: false,
        },
      ],
    });
  });
}
