import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type AssetRecord, type ProcurementSettings, DEFAULT_PROCUREMENT_SETTINGS } from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
  dispatchProcurementNotification,
} from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "asset-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);

    const search = req.nextUrl.searchParams.get("search")?.toLowerCase().trim();
    const category = req.nextUrl.searchParams.get("category");
    const status = req.nextUrl.searchParams.get("status");
    const department = req.nextUrl.searchParams.get("department");
    const custodian = req.nextUrl.searchParams.get("custodian");

    const query: any = {};
    if (category && category !== "ALL") query.category = category;
    if (status && status !== "ALL") query.status = status;
    if (department && department !== "ALL") query.department = department;
    if (custodian) query.custodian = custodian;

    let assets = await col.find(query).sort({ updatedAt: -1 }).toArray();

    if (search) {
      assets = assets.filter(
        (a) =>
          a.name.toLowerCase().includes(search) ||
          a.assetTag.toLowerCase().includes(search) ||
          a.serialNumber.toLowerCase().includes(search) ||
          (a.brand && a.brand.toLowerCase().includes(search)) ||
          (a.model && a.model.toLowerCase().includes(search)) ||
          (a.custodian && a.custodian.toLowerCase().includes(search)) ||
          (a.poNumber && a.poNumber.toLowerCase().includes(search)) ||
          (a.grnNumber && a.grnNumber.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      assets,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/assets] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "asset-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      name,
      category,
      subcategory,
      description,
      brand,
      model,
      serialNumber,
      purchaseCost,
      supplier,
      purchaseDate,
      department,
      location,
      procurementId,
      txnId,
      prNumber,
      poNumber,
      grnNumber,
      fundingSource,
      programme,
      donor,
      custodian,
      custodianEmployeeId,
      depreciationMethod = "Straight Line",
      usefulLife = 5,
      residualValue = 0,
      warrantyExpiry,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Asset name is required." }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: "Asset category is required." }, { status: 400 });
    }

    const col = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const count = await col.countDocuments();
    const year = new Date().getFullYear();
    const seqNum = String(count + 1).padStart(6, "0");
    const assetTag = `BCF-AST-${year}-${seqNum}`;
    const assetId = assetTag;

    const cost = Math.max(0, parseFloat(purchaseCost) || 0);
    const lifeYears = Math.max(1, parseInt(usefulLife) || 5);
    const resVal = Math.max(0, parseFloat(residualValue) || cost * 0.05);

    // Initial Net Book Value
    const netBookValue = cost;
    const accumulatedDepreciation = 0;
    const nowIso = new Date().toISOString();

    const newAsset: AssetRecord = {
      id: assetId,
      assetTag,
      name: name.trim(),
      category,
      subcategory: subcategory || "",
      description: (description || "").trim(),
      brand: brand || "",
      model: model || "",
      serialNumber: serialNumber || `SN-${Date.now().toString().slice(-6)}`,
      barcode: assetTag,
      qrCodeData: `https://bcf-sl.org/asset/${assetTag}`,
      procurementId,
      txnId: txnId || `BCF-TXN-${year}-${seqNum}`,
      prNumber,
      poNumber,
      grnNumber,
      supplier: supplier || "Accredited Supplier",
      purchaseDate: purchaseDate || nowIso.split("T")[0],
      purchaseCost: cost,
      department: department || "Operations",
      programme,
      donor,
      fundingSource,
      location: location || "BCF Head Office, Freetown",
      custodian: custodian || undefined,
      custodianEmployeeId: custodianEmployeeId || undefined,
      responsibleOfficer: custodian || auth.user.name,
      assetCost: cost,
      currency: "NLe",
      acquisitionDate: purchaseDate || nowIso.split("T")[0],
      depreciationMethod,
      usefulLife: lifeYears,
      residualValue: resVal,
      accumulatedDepreciation,
      netBookValue,
      status: custodian ? "Assigned" : "In Storage",
      warrantyExpiry,
      assignments: custodian
        ? [
            {
              assignmentNumber: `ASN-${year}-001`,
              employeeId: custodianEmployeeId || "UNLINKED",
              employeeName: custodian,
              department: department || "Operations",
              position: "Designated Custodian",
              location: location || "BCF Head Office",
              dateAssigned: nowIso.split("T")[0],
              conditionAtIssue: "New / Good Condition",
              issuedBy: auth.user.name,
              receivedBy: custodian,
              active: true,
            },
          ]
        : [],
      transfers: [],
      maintenance: [],
      inspections: [],
      incidents: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await col.insertOne(newAsset as any);

    await logProcurementAudit({
      action: "ASSET_REGISTERED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "asset-management",
      recordId: newAsset.id,
      txnId: newAsset.txnId,
      details: {
        assetTag: newAsset.assetTag,
        name: newAsset.name,
        category: newAsset.category,
        cost: newAsset.assetCost,
      },
    });

    return NextResponse.json({ success: true, asset: newAsset }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/procurement/assets] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create asset record" }, { status: 500 });
  }
}
