import { NextRequest, NextResponse } from "next/server";
import {
  createBlocks,
  unblockEntry,
  editBlockDuration,
  isRoleAuthorizedForVisitorAnalytics,
} from "@/lib/visitorServer";
import { logSecurityAudit } from "@/lib/contractSecurity";
import { normalizeRole } from "@/lib/permissions";
import fs from "fs";
import path from "path";
import { getDb, COLLECTIONS } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function getActor(req: NextRequest) {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");
  const empIdHeader = req.headers.get("x-bcf-employee-id");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    staffId: qEmpId || (roleCode === "SA" ? "BCF-PTE-2026-0001" : "BCF-ST-001"),
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Administrator"),
    role: roleCode,
    email: qEmail || "admin@bcfsl.org",
  };
}

// GET /api/visitor-analytics/blocks
export async function GET(req: NextRequest) {
  try {
    const actor = getActor(req);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(actor.role);

    if (!isAuthorized) {
      await logSecurityAudit({
        action: "UNAUTHORIZED_ACCESS_ATTEMPT",
        user: actor.name,
        role: actor.role,
        email: actor.email,
        tab: "visitor-analytics-blocks",
        reason: "Access denied by default: user is not Super Admin",
      });
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    let blocks: any[] = [];
    let attempts: any[] = [];
    try {
      const db = await getDb();
      blocks = await db.collection(COLLECTIONS.BLOCKED_ENTRIES).find({}).sort({ blocked_at: -1 }).toArray();
      attempts = await db.collection(COLLECTIONS.BLOCKED_ATTEMPTS).find({}).sort({ attempted_at: -1 }).limit(100).toArray();
    } catch {
      try {
        const storePath = path.join(process.cwd(), "src", "data", "visitor_analytics.json");
        if (fs.existsSync(storePath)) {
          const parsed = JSON.parse(fs.readFileSync(storePath, "utf-8"));
          blocks = parsed.blockedEntries || [];
          attempts = parsed.blockedAttempts || [];
        }
      } catch {}
    }

    const activeBlocks = blocks.filter((b) => b.status === "Active");
    const blockHistory = blocks; // All blocks & unblocks

    return NextResponse.json({
      success: true,
      activeBlocks,
      blockHistory,
      recentAttempts: attempts,
    });
  } catch (err: any) {
    console.error("[Blocks GET Error]", err);
    return NextResponse.json({ success: false, error: "Failed to load blocks" }, { status: 500 });
  }
}

// POST /api/visitor-analytics/blocks
export async function POST(req: NextRequest) {
  try {
    const actor = getActor(req);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(actor.role);

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    const body = await req.json();
    const { blockBy, email, deviceIdHash, ip, fingerprintHash, reasonCode, reasonText, duration } = body;

    if (!blockBy || (!blockBy.email && !blockBy.device && !blockBy.ip)) {
      return NextResponse.json(
        { success: false, error: "Select at least one entity to block (Email, Device ID, or IP)." },
        { status: 400 }
      );
    }

    if (!reasonCode || !reasonText || !reasonText.trim()) {
      return NextResponse.json(
        { success: false, error: "Reason code and justification details are required." },
        { status: 400 }
      );
    }

    const result = await createBlocks({
      blockBy,
      email,
      deviceIdHash,
      ip,
      fingerprintHash,
      reasonCode,
      reasonText,
      duration: duration || "Permanent",
      actor,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Visitor successfully blocked and restricted from site access.",
      createdBlocks: result.createdBlocks,
    });
  } catch (err: any) {
    console.error("[Blocks POST Error]", err);
    return NextResponse.json({ success: false, error: "Failed to create block" }, { status: 500 });
  }
}

// DELETE /api/visitor-analytics/blocks (Unblock)
export async function DELETE(req: NextRequest) {
  try {
    const actor = getActor(req);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(actor.role);

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    const url = new URL(req.url);
    const blockId = url.searchParams.get("id");
    const unblockReason = url.searchParams.get("reason") || "Unblocked by Super Admin";

    if (!blockId) {
      return NextResponse.json({ success: false, error: "Block ID is required" }, { status: 400 });
    }

    const result = await unblockEntry({
      blockId,
      unblockReason,
      actor,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Block successfully removed. Access has been restored.",
      unblocked: result.unblocked,
    });
  } catch (err: any) {
    console.error("[Blocks DELETE Error]", err);
    return NextResponse.json({ success: false, error: "Failed to unblock" }, { status: 500 });
  }
}

// PUT /api/visitor-analytics/blocks (Edit duration)
export async function PUT(req: NextRequest) {
  try {
    const actor = getActor(req);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(actor.role);

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    const body = await req.json();
    const { blockId, duration } = body;

    if (!blockId) {
      return NextResponse.json({ success: false, error: "Block ID is required" }, { status: 400 });
    }

    const result = await editBlockDuration({
      blockId,
      duration: duration || "Permanent",
      actor,
    });

    return NextResponse.json({ success: true, message: "Block duration updated successfully." });
  } catch (err: any) {
    console.error("[Blocks PUT Error]", err);
    return NextResponse.json({ success: false, error: "Failed to update duration" }, { status: 500 });
  }
}
