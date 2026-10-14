import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { normalizeRole, type RoleCode } from "@/lib/permissions";
import { checkDocumentPermission, type DocumentTab } from "@/lib/documentPermissions";
import { type DocumentItem, type DocumentDownloadEvent } from "@/lib/documentTypes";
import {
  resolveStaffEmployeeId,
  logSecurityAudit,
  type UserContext,
} from "@/lib/contractSecurity";

interface Params {
  params: Promise<{ id: string }>;
}

function extractUser(req: NextRequest): {
  username: string;
  email: string;
  name: string;
  role: string;
  roleCode: RoleCode;
  employeeId?: string;
} {
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
    username: qUser || "system_user",
    email: qEmail || "user@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    employeeId: qEmpId || undefined,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = extractUser(req);
    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);

    let doc = await col.findOne({ id });
    if (!doc) {
      try {
        doc = await col.findOne({ _id: new ObjectId(id) as any });
      } catch (_) {}
    }

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Rule: Soft-deleted items CANNOT be downloaded by anyone
    if (doc.status === "Deleted") {
      return NextResponse.json(
        {
          error: "This document has been archived / deleted and cannot be downloaded.",
          code: "ITEM_DELETED",
        },
        { status: 403 }
      );
    }

    // Check download permission
    if (!checkDocumentPermission(user.roleCode, doc.category as DocumentTab, "download")) {
      await logSecurityAudit({
        action: "DOWNLOAD_PERMISSION_DENIED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        itemId: doc.id,
        tab: doc.category,
        reason: "User role does not have download permission.",
      });

      return NextResponse.json(
        { error: "You do not have permission to download this item.", code: "ACCESS_DENIED" },
        { status: 403 }
      );
    }

    // STAFF PRIVACY RULE:
    // If downloading a contract, staff can download ONLY their own contract!
    // Changing an ID or URL returns "You do not have access to that page" and logs failed access attempt.
    if (doc.category === "employee-contracts" && user.roleCode === "ST") {
      const staffEmpId = await resolveStaffEmployeeId(user);
      if (!staffEmpId || doc.employeeId !== staffEmpId) {
        await logSecurityAudit({
          action: "FAILED_ACCESS_ATTEMPT",
          user: user.name,
          role: user.roleCode,
          email: user.email,
          employeeId: staffEmpId || "UNLINKED",
          itemId: doc.id,
          itemTitle: doc.title,
          tab: "employee-contracts",
          reason: "Staff member attempted to download contract belonging to another employee.",
        });

        return NextResponse.json(
          { error: "You do not have access to that page.", code: "ACCESS_DENIED" },
          { status: 403 }
        );
      }
    }

    const nowIso = new Date().toISOString();
    const downloadEvent: DocumentDownloadEvent = {
      id: `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: user.name,
      role: user.role,
      roleCode: user.roleCode,
      email: user.email,
      date: nowIso,
    };

    // Record download on every download including repeat downloads
    await col.updateOne(
      { id: doc.id },
      {
        $inc: { downloadCount: 1 },
        $push: { downloadHistory: downloadEvent },
      } as any
    );

    // Sync to EMPLOYEE_CONTRACTS collection if contract
    if (doc.category === "employee-contracts") {
      try {
        const contractsCol = await getCollection(COLLECTIONS.EMPLOYEE_CONTRACTS);
        await contractsCol.updateOne(
          { id: doc.id },
          {
            $inc: { downloadCount: 1 },
            $push: { downloadHistory: downloadEvent },
          } as any
        );
      } catch (_) {}
    }

    // Audit log
    await logSecurityAudit({
      action: doc.category === "employee-contracts" ? "CONTRACT_DOWNLOADED" : "DOCUMENT_DOWNLOADED",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      employeeId: doc.employeeId,
      itemId: doc.id,
      itemTitle: doc.title,
      tab: doc.category,
      details: {
        version: doc.currentVersion,
        fileName: doc.fileName,
      },
    });

    // Provide file download
    if (doc.fileData && doc.fileData.startsWith("data:")) {
      const commaIdx = doc.fileData.indexOf(",");
      const meta = doc.fileData.substring(0, commaIdx);
      const rawBase64 = doc.fileData.substring(commaIdx + 1);
      const mimeMatch = meta.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : doc.fileType || "application/octet-stream";

      const fileBuffer = Buffer.from(rawBase64, "base64");

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
          "Content-Length": fileBuffer.length.toString(),
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    }

    // Simulated fallback file buffer
    const mockContent = `BCF-SL Official Contract Document\nTitle: ${doc.title}\nCategory: ${doc.category}\nVersion: ${doc.currentVersion}\nEmployee: ${doc.employeeName || doc.employeeId || 'Institutional'}\nDownloaded by: ${user.name} (${user.roleCode}) at ${nowIso}\n`;
    const buffer = Buffer.from(mockContent, "utf-8");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[GET /api/documents/:id/download] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to download file" }, { status: 500 });
  }
}
