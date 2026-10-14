import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { AccessSettings } from "@/lib/accessTypes";
import { ensureAccessCatalogueAndSettings } from "@/lib/accessCatalogueSeed";
import { normalizeRole } from "@/lib/permissions";

function extractActor(req: NextRequest) {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return { roleCode };
}

// GET /api/access/settings
export async function GET() {
  try {
    const { settings } = await ensureAccessCatalogueAndSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT /api/access/settings
export async function PUT(req: NextRequest) {
  try {
    const actor = extractActor(req);
    if (actor.roleCode !== "SA") {
      return NextResponse.json({ success: false, error: "Only Super Admin can update settings." }, { status: 403 });
    }

    const body = await req.json();
    const col = await getCollection<AccessSettings>(COLLECTIONS.ACCESS_SETTINGS);

    const updatedSettings: AccessSettings = {
      id: "access_settings",
      fallbackStage1ApproverRole: body.fallbackStage1ApproverRole || "CEO",
      fallbackStage2ApproverRole: body.fallbackStage2ApproverRole || "SA",
      fallbackSuperAdminSelfGrant: body.fallbackSuperAdminSelfGrant || "CEO",
      acceptanceStatement:
        body.acceptanceStatement ||
        "I will use this access only for my authorized work, keep my login private, and immediately report any misuse or security irregularity.",
      reminderDays: Number(body.reminderDays) || 3,
      expiryDays: Number(body.expiryDays) || 7,
      notifyHrOnAllRequests: Boolean(body.notifyHrOnAllRequests),
      updatedAt: new Date().toISOString(),
    };

    await col.updateOne({ id: "access_settings" }, { $set: updatedSettings }, { upsert: true });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
