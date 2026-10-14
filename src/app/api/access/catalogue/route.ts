import { NextRequest, NextResponse } from "next/server";
import { ensureAccessCatalogueAndSettings } from "@/lib/accessCatalogueSeed";
import { normalizeRole, RoleCode } from "@/lib/permissions";
import { getUserExistingTabRights } from "@/lib/accessServer";

function extractActor(req: NextRequest) {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    username: qUser || "system_user",
    email: qEmail || "user@bcf-sl.org",
    roleCode,
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const { catalogue, settings } = await ensureAccessCatalogueAndSettings();

    // Filter only requestable tabs (hide admin-only and unrequestable)
    const requestableCatalogue = catalogue.filter((item) => item.requestable !== false);

    // Compute existing rights for current actor for each tab
    const catalogueWithUserRights = await Promise.all(
      requestableCatalogue.map(async (item) => {
        const existingRights = await getUserExistingTabRights(
          actor.roleCode,
          actor.email,
          item.moduleSlug,
          item.tabId
        );

        // A user has full access if they already possess Read & Write (or View & Write)
        const hasFullAccess =
          existingRights.includes("Read") &&
          existingRights.includes("Write") &&
          existingRights.includes("View");

        return {
          ...item,
          existingRights,
          hasFullAccess,
          hasAccess: existingRights.length > 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      catalogue: catalogueWithUserRights,
      settings,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
