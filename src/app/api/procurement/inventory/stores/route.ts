import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type InventoryStore } from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
  dispatchProcurementNotification,
} from "@/lib/procurementAuth";
import { sendMail, cleanEmail } from "@/lib/mail";

const CEO_EMAIL = process.env.CEO_EMAIL || "ceo@bcf-sl.org";

async function notifyCeoStoreCreated(
  store: InventoryStore,
  createdBy: { name: string; roleCode: string; email: string }
) {
  try {
    const appUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://adminbcfsl.bandamacharityfsl.com";

    const statusColor =
      store.status === "Active"
        ? "#059669"
        : store.status === "Inactive"
        ? "#64748b"
        : store.status === "Suspended"
        ? "#d97706"
        : "#e11d48";

    const securityRows =
      store.securityAgency || store.securityName || store.securitySupervisorName
        ? `
            <tr style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
              <td colspan="2" style="padding: 10px 0; font-weight: 700; color: #047857;">Security &amp; Guard Personnel Details</td>
            </tr>
            ${
              store.securityAgency
                ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Security Agency:</td><td style="padding: 8px 0; color: #0f172a;">${store.securityAgency}</td></tr>`
                : ""
            }
            ${
              store.securityName
                ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Security Guard Name(s):</td><td style="padding: 8px 0; color: #0f172a;">${store.securityName} (${store.securityPhone || "No Phone"})</td></tr>`
                : ""
            }
            ${
              store.securityAddress
                ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Security Address:</td><td style="padding: 8px 0; color: #0f172a;">${store.securityAddress}</td></tr>`
                : ""
            }
            ${
              store.securitySupervisorName
                ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Security Supervisor:</td><td style="padding: 8px 0; color: #0f172a;">${store.securitySupervisorName} (${store.securitySupervisorPhone || "No Phone"}) ${store.securitySupervisorAddress ? `&bull; ${store.securitySupervisorAddress}` : ""}</td></tr>`
                : ""
            }
          `
        : "";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); color: #ffffff; padding: 24px; text-align: left;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Bandama Charity Foundation (SL)</h1>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Procurement &amp; Supply Chain Management Hub</p>
        </div>
        <div style="padding: 24px;">
          <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; margin-bottom: 12px;">
            NEW STORE / WAREHOUSE REGISTERED
          </div>
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">New Store/Warehouse Facility Added</h2>
          <p style="margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.5;">
            Dear Dr. Alimamy Koroma (CEO),<br/><br/>
            A new store/warehouse facility has been successfully created and registered in the BCF-SL Inventory Management module.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; width: 150px; font-weight: 600;">Store Code:</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${store.id}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Store Name:</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${store.storeName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Location &amp; District:</td>
              <td style="padding: 10px 0; color: #0f172a;">${store.location}, ${store.district} (${store.chiefdom} Chiefdom)</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Storage Classification:</td>
              <td style="padding: 10px 0; color: #0f172a;">${store.storageType}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Holding Capacity:</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${store.capacity?.toLocaleString()} Units</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Designated Storekeeper:</td>
              <td style="padding: 10px 0; color: #0f172a;">${store.storekeeper} (${store.contact})</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Operating Status:</td>
              <td style="padding: 10px 0;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 800; color: #ffffff; background-color: ${statusColor};">
                  ${store.status}
                </span>
              </td>
            </tr>
            ${securityRows}
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Registered By:</td>
              <td style="padding: 10px 0; color: #0f172a;">${createdBy.name} (${createdBy.roleCode} &bull; ${createdBy.email})</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Registration Timestamp:</td>
              <td style="padding: 10px 0; color: #0f172a;">${new Date().toLocaleString("en-GB", { timeZone: "Africa/Freetown" })} (SL Time)</td>
            </tr>
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <a href="${appUrl}/procurement?tab=inventory-management" style="display: inline-block; background: #047857; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px;">
              View Stores &amp; Warehouses in Hub
            </a>
          </div>
        </div>
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
          This is an automated notification dispatched by the BCF-SL Administration System &bull; Procurement &amp; Stores Directorate.
        </div>
      </div>
    `;

    await sendMail({
      to: cleanEmail(CEO_EMAIL),
      subject: `[BCF-SL Procurement] New Store / Warehouse Created: ${store.storeName} (${store.id})`,
      html,
      text: `New Store/Warehouse Created: ${store.storeName} (${store.id}) in ${store.location}, District: ${store.district}. Storekeeper: ${store.storekeeper}. Status: ${store.status}. Registered by: ${createdBy.name}.`,
    });
  } catch (mailErr) {
    console.error("[notifyCeoStoreCreated] Email delivery error:", mailErr);
  }
}

async function notifyCeoStoreStatusChanged(
  store: InventoryStore,
  oldStatus: string,
  newStatus: string,
  updatedBy: { name: string; roleCode: string; email: string }
) {
  try {
    const appUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://adminbcfsl.bandamacharityfsl.com";

    const statusColor =
      newStatus === "Active"
        ? "#059669"
        : newStatus === "Inactive"
        ? "#64748b"
        : newStatus === "Suspended"
        ? "#d97706"
        : "#e11d48";

    const securitySnippet = store.securityAgency || store.securityName
      ? `<tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Security Agency / Guard:</td>
          <td style="padding: 10px 0; color: #0f172a;">${store.securityAgency || store.securityName} (${store.securityPhone || store.securitySupervisorPhone || "No Phone"})</td>
        </tr>`
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); color: #ffffff; padding: 24px; text-align: left;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Bandama Charity Foundation (SL)</h1>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Procurement &amp; Supply Chain Management Hub</p>
        </div>
        <div style="padding: 24px;">
          <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; margin-bottom: 12px;">
            STORE OPERATIONAL STATUS UPDATE
          </div>
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Store/Warehouse Status Changed</h2>
          <p style="margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.5;">
            Dear Dr. Alimamy Koroma (CEO),<br/><br/>
            The operational status of store facility <strong>${store.storeName}</strong> has been updated from <strong>${oldStatus}</strong> to <strong style="color: ${statusColor};">${newStatus}</strong>.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; width: 150px; font-weight: 600;">Store Code:</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${store.id}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Store Name:</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${store.storeName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Location &amp; District:</td>
              <td style="padding: 10px 0; color: #0f172a;">${store.location}, ${store.district}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Previous Status:</td>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">${oldStatus}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">New Status:</td>
              <td style="padding: 10px 0;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 800; color: #ffffff; background-color: ${statusColor};">
                  ${newStatus}
                </span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Storekeeper in Charge:</td>
              <td style="padding: 10px 0; color: #0f172a;">${store.storekeeper} (${store.contact})</td>
            </tr>
            ${securitySnippet}
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Updated By:</td>
              <td style="padding: 10px 0; color: #0f172a;">${updatedBy.name} (${updatedBy.roleCode} &bull; ${updatedBy.email})</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Timestamp:</td>
              <td style="padding: 10px 0; color: #0f172a;">${new Date().toLocaleString("en-GB", { timeZone: "Africa/Freetown" })} (SL Time)</td>
            </tr>
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <a href="${appUrl}/procurement?tab=inventory-management" style="display: inline-block; background: #047857; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px;">
              Open Inventory Management
            </a>
          </div>
        </div>
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
          This is an automated notification dispatched by the BCF-SL Administration System &bull; Procurement &amp; Stores Directorate.
        </div>
      </div>
    `;

    await sendMail({
      to: cleanEmail(CEO_EMAIL),
      subject: `[BCF-SL Procurement] Store Status Updated: ${store.storeName} is now ${newStatus}`,
      html,
      text: `Store Status Changed: ${store.storeName} (${store.id}) changed from ${oldStatus} to ${newStatus}. Updated by: ${updatedBy.name}.`,
    });
  } catch (mailErr) {
    console.error("[notifyCeoStoreStatusChanged] Email delivery error:", mailErr);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<InventoryStore>(COLLECTIONS.INVENTORY_STORES);
    const stores = await col.find({}).sort({ storeName: 1 }).toArray();

    return NextResponse.json({
      success: true,
      stores,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/inventory/stores] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load stores" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      storeName,
      location,
      district,
      chiefdom,
      storekeeper,
      contact,
      storageType,
      capacity = 1000,
      status = "Active",
      securityName,
      securityAddress,
      securityPhone,
      securityAgency,
      securitySupervisorName,
      securitySupervisorPhone,
      securitySupervisorAddress,
    } = body;

    if (!storeName || !location) {
      return NextResponse.json({ error: "Store name and location are required." }, { status: 400 });
    }

    const col = await getCollection<InventoryStore>(COLLECTIONS.INVENTORY_STORES);
    const count = await col.countDocuments();
    const storeId = `BCF-STORE-${String(count + 1).padStart(3, "0")}`;

    const validStatus = ["Active", "Inactive", "Suspended", "Closed"].includes(status)
      ? status
      : "Active";

    const nowIso = new Date().toISOString();
    const newStore: InventoryStore = {
      id: storeId,
      storeName: storeName.trim(),
      location: location.trim(),
      district: district || "Western Area Urban",
      chiefdom: chiefdom || "Central",
      storekeeper: storekeeper || "Assigned Storekeeper",
      contact: contact || "+232 78 000 000",
      storageType: storageType || "Regional Depot",
      capacity: parseInt(capacity) || 1000,
      status: validStatus as any,
      securityName: securityName ? securityName.trim() : "",
      securityAddress: securityAddress ? securityAddress.trim() : "",
      securityPhone: securityPhone ? securityPhone.trim() : "",
      securityAgency: securityAgency ? securityAgency.trim() : "",
      securitySupervisorName: securitySupervisorName ? securitySupervisorName.trim() : "",
      securitySupervisorPhone: securitySupervisorPhone ? securitySupervisorPhone.trim() : "",
      securitySupervisorAddress: securitySupervisorAddress ? securitySupervisorAddress.trim() : "",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await col.insertOne(newStore as any);

    // Audit log
    await logProcurementAudit({
      action: "INVENTORY_STORE_CREATED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "inventory-management",
      recordId: newStore.id,
      details: {
        storeName: newStore.storeName,
        location: newStore.location,
        status: newStore.status,
        securityAgency: newStore.securityAgency,
      },
    });

    // In-app notification
    await dispatchProcurementNotification({
      title: `New Store Facility Registered: ${newStore.storeName}`,
      message: `Store ${newStore.id} (${newStore.storeName}) in ${newStore.location} has been registered with status ${newStore.status}.`,
      targetRoles: ["CEO", "PRC", "SA"],
      link: "/procurement?tab=inventory-management",
      tab: "inventory-management",
      type: "info",
    });

    // Send email to CEO
    await notifyCeoStoreCreated(newStore, auth.user);

    return NextResponse.json({ success: true, store: newStore }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/procurement/inventory/stores] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create store" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      id,
      status,
      storeName,
      location,
      district,
      chiefdom,
      storekeeper,
      contact,
      storageType,
      capacity,
      securityName,
      securityAddress,
      securityPhone,
      securityAgency,
      securitySupervisorName,
      securitySupervisorPhone,
      securitySupervisorAddress,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Store ID is required for update." }, { status: 400 });
    }

    const col = await getCollection<InventoryStore>(COLLECTIONS.INVENTORY_STORES);
    const existing = await col.findOne({ id });

    if (!existing) {
      return NextResponse.json({ error: `Store with ID ${id} not found.` }, { status: 404 });
    }

    const updateFields: Partial<InventoryStore> = {
      updatedAt: new Date().toISOString(),
    };

    let statusChanged = false;
    const oldStatus = existing.status;

    if (status && status !== existing.status) {
      const allowed = ["Active", "Inactive", "Suspended", "Closed"];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${allowed.join(", ")}` },
          { status: 400 }
        );
      }
      updateFields.status = status as any;
      statusChanged = true;
    }

    if (storeName && storeName.trim()) updateFields.storeName = storeName.trim();
    if (location && location.trim()) updateFields.location = location.trim();
    if (district !== undefined) updateFields.district = district;
    if (chiefdom !== undefined) updateFields.chiefdom = chiefdom;
    if (storekeeper !== undefined) updateFields.storekeeper = storekeeper;
    if (contact !== undefined) updateFields.contact = contact;
    if (storageType !== undefined) updateFields.storageType = storageType;
    if (capacity !== undefined) updateFields.capacity = parseInt(capacity) || 0;

    // Security Details (Optional)
    if (securityName !== undefined) updateFields.securityName = securityName.trim();
    if (securityAddress !== undefined) updateFields.securityAddress = securityAddress.trim();
    if (securityPhone !== undefined) updateFields.securityPhone = securityPhone.trim();
    if (securityAgency !== undefined) updateFields.securityAgency = securityAgency.trim();
    if (securitySupervisorName !== undefined) updateFields.securitySupervisorName = securitySupervisorName.trim();
    if (securitySupervisorPhone !== undefined) updateFields.securitySupervisorPhone = securitySupervisorPhone.trim();
    if (securitySupervisorAddress !== undefined) updateFields.securitySupervisorAddress = securitySupervisorAddress.trim();

    await col.updateOne({ id }, { $set: updateFields });
    const updated = await col.findOne({ id });

    if (statusChanged && updated) {
      // Audit log
      await logProcurementAudit({
        action: "INVENTORY_STORE_STATUS_UPDATED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "inventory-management",
        recordId: id,
        details: {
          storeName: updated.storeName,
          oldStatus,
          newStatus: updated.status,
        },
      });

      // Notification
      await dispatchProcurementNotification({
        title: `Store Status Changed: ${updated.storeName}`,
        message: `Store ${updated.id} status changed from ${oldStatus} to ${updated.status} by ${auth.user.name}.`,
        targetRoles: ["CEO", "PRC", "SA"],
        link: "/procurement?tab=inventory-management",
        tab: "inventory-management",
        type: updated.status === "Closed" || updated.status === "Suspended" ? "warning" : "info",
      });

      // Email CEO
      await notifyCeoStoreStatusChanged(updated, oldStatus, updated.status, auth.user);
    } else {
      await logProcurementAudit({
        action: "INVENTORY_STORE_UPDATED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "inventory-management",
        recordId: id,
        details: updateFields,
      });
    }

    return NextResponse.json({ success: true, store: updated });
  } catch (err: any) {
    console.error("[PATCH /api/procurement/inventory/stores] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update store" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return PATCH(req);
}
