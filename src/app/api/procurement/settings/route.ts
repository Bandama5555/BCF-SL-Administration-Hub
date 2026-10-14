import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type ProcurementSettings, DEFAULT_PROCUREMENT_SETTINGS } from "@/lib/inventoryAssetTypes";
import { enforceProcurementAccess, logProcurementAudit } from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<ProcurementSettings>(COLLECTIONS.PROCUREMENT_SETTINGS);
    let settings: any = await col.findOne({});

    if (!settings) {
      settings = { ...DEFAULT_PROCUREMENT_SETTINGS, updatedAt: new Date().toISOString() };
      await col.insertOne(settings as any);
    }

    return NextResponse.json({
      success: true,
      settings,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/settings] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const col = await getCollection<ProcurementSettings>(COLLECTIONS.PROCUREMENT_SETTINGS);

    const updateData: Partial<ProcurementSettings> = {
      updatedAt: new Date().toISOString(),
      updatedBy: auth.user.name,
    };

    if (body.capitalisationThreshold !== undefined) {
      updateData.capitalisationThreshold = parseFloat(body.capitalisationThreshold) || 5000;
    }
    if (body.valuationMethod) {
      updateData.valuationMethod = body.valuationMethod === "Weighted Average" ? "Weighted Average" : "FIFO";
    }
    if (body.expiryWarningDays !== undefined) {
      updateData.expiryWarningDays = parseInt(body.expiryWarningDays) || 60;
    }
    if (body.depreciationRates) {
      updateData.depreciationRates = body.depreciationRates;
    }

    await col.updateOne({}, { $set: updateData }, { upsert: true });
    const updated = await col.findOne({});

    await logProcurementAudit({
      action: "PROCUREMENT_SETTINGS_UPDATED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "inventory-management",
      details: updateData,
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error("[PUT /api/procurement/settings] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
