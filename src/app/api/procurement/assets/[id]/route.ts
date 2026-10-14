import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type AssetRecord } from "@/lib/inventoryAssetTypes";
import { enforceProcurementAccess, logProcurementAudit } from "@/lib/procurementAuth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await enforceProcurementAccess(req, "asset-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const asset = await col.findOne({ $or: [{ id }, { assetTag: id }] });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found in Asset Register" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      asset,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/assets/:id] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load asset" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await enforceProcurementAccess(req, "asset-management", "F");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const asset = await col.findOne({ $or: [{ id }, { assetTag: id }] });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found in Asset Register" }, { status: 404 });
    }

    const body = await req.json();
    const updateFields: Partial<AssetRecord> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name) updateFields.name = String(body.name).trim();
    if (body.description !== undefined) updateFields.description = String(body.description).trim();
    if (body.category) updateFields.category = body.category;
    if (body.subcategory !== undefined) updateFields.subcategory = body.subcategory;
    if (body.brand !== undefined) updateFields.brand = body.brand;
    if (body.model !== undefined) updateFields.model = body.model;
    if (body.serialNumber !== undefined) updateFields.serialNumber = body.serialNumber;
    if (body.department !== undefined) updateFields.department = body.department;
    if (body.location !== undefined) updateFields.location = body.location;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.custodian !== undefined) updateFields.custodian = body.custodian;
    if (body.custodianEmployeeId !== undefined) updateFields.custodianEmployeeId = body.custodianEmployeeId;
    if (body.responsibleOfficer !== undefined) updateFields.responsibleOfficer = body.responsibleOfficer;
    if (body.usefulLife !== undefined) updateFields.usefulLife = parseInt(body.usefulLife) || asset.usefulLife;
    if (body.residualValue !== undefined) updateFields.residualValue = parseFloat(body.residualValue) || asset.residualValue;
    if (body.warrantyExpiry !== undefined) updateFields.warrantyExpiry = body.warrantyExpiry;

    await col.updateOne({ id: asset.id }, { $set: updateFields });
    const updated = await col.findOne({ id: asset.id });

    await logProcurementAudit({
      action: "ASSET_RECORD_UPDATED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "asset-management",
      recordId: asset.id,
      details: updateFields,
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (err: any) {
    console.error("[PUT /api/procurement/assets/:id] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await enforceProcurementAccess(req, "asset-management", "F");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const asset = await col.findOne({ $or: [{ id }, { assetTag: id }] });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Per Rule 5: Records are NEVER hard-deleted; status set to Retired
    await col.updateOne(
      { id: asset.id },
      { $set: { status: "Retired", updatedAt: new Date().toISOString() } }
    );

    await logProcurementAudit({
      action: "ASSET_RETIRED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "asset-management",
      recordId: asset.id,
      details: { previousStatus: asset.status, newStatus: "Retired" },
    });

    return NextResponse.json({
      success: true,
      message: `Asset "${asset.assetTag}" marked as Retired. Full history preserved.`,
    });
  } catch (err: any) {
    console.error("[DELETE /api/procurement/assets/:id] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to retire asset" }, { status: 500 });
  }
}
