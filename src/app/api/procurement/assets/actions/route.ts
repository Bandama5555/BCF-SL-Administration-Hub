import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  type AssetRecord,
  type AssetAssignment,
  type AssetTransfer,
  type AssetMaintenance,
  type AssetInspection,
  type AssetDisposal,
  type AssetIncident,
} from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
  dispatchProcurementNotification,
} from "@/lib/procurementAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "asset-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { action, assetId } = body;

    if (!action || !assetId) {
      return NextResponse.json({ error: "Action and asset ID are required." }, { status: 400 });
    }

    const col = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const asset = await col.findOne({ $or: [{ id: assetId }, { assetTag: assetId }] });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found in Asset Register." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.split("T")[0];

    // ─────────────────────────────────────────────────────────────
    //  ACTION: ASSIGN
    // ─────────────────────────────────────────────────────────────
    if (action === "ASSIGN") {
      // RULE: Disposed assets can NEVER be assigned! (Acceptance Test 8)
      if (asset.status === "Disposed") {
        return NextResponse.json(
          {
            error: `Asset ${asset.assetTag} is Disposed and can no longer be assigned.`,
            code: "CANNOT_ASSIGN_DISPOSED_ASSET",
          },
          { status: 400 }
        );
      }

      const {
        employeeId,
        employeeName,
        department,
        position,
        location,
        conditionAtIssue,
        expectedReturnDate,
        remarks,
      } = body;

      if (!employeeId || !employeeName) {
        return NextResponse.json({ error: "Employee selection is required for asset assignment." }, { status: 400 });
      }

      // Deactivate any currently active assignment
      const updatedAssignments = (asset.assignments || []).map((a) =>
        a.active ? { ...a, active: false, actualReturnDate: today } : a
      );

      const newAssignment: AssetAssignment = {
        assignmentNumber: `ASN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        employeeId: employeeId.trim(),
        employeeName: employeeName.trim(),
        department: department || asset.department,
        position: position || "Staff Member",
        location: location || asset.location,
        dateAssigned: body.dateAssigned || today,
        conditionAtIssue: conditionAtIssue || "Good Operational Condition",
        expectedReturnDate: expectedReturnDate || undefined,
        issuedBy: auth.user.name,
        receivedBy: employeeName.trim(),
        remarks,
        active: true,
      };

      updatedAssignments.push(newAssignment);

      await col.updateOne(
        { id: asset.id },
        {
          $set: {
            status: "Assigned",
            custodian: employeeName.trim(),
            custodianEmployeeId: employeeId.trim(),
            department: department || asset.department,
            location: location || asset.location,
            assignments: updatedAssignments,
            updatedAt: nowIso,
          },
        }
      );

      await logProcurementAudit({
        action: "ASSET_ASSIGNED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "asset-management",
        recordId: asset.id,
        details: {
          assetTag: asset.assetTag,
          assignedTo: employeeName,
          employeeId,
          assignmentNumber: newAssignment.assignmentNumber,
        },
      });

      return NextResponse.json({ success: true, message: `Asset assigned to ${employeeName}.`, assignment: newAssignment });
    }

    // ─────────────────────────────────────────────────────────────
    //  ACTION: RETURN ASSIGNMENT
    // ─────────────────────────────────────────────────────────────
    if (action === "RETURN_ASSIGNMENT") {
      const updatedAssignments = (asset.assignments || []).map((a) =>
        a.active ? { ...a, active: false, actualReturnDate: today, remarks: body.returnCondition || a.remarks } : a
      );

      await col.updateOne(
        { id: asset.id },
        {
          $set: {
            status: "In Storage",
            custodian: undefined,
            custodianEmployeeId: undefined,
            assignments: updatedAssignments,
            updatedAt: nowIso,
          },
        }
      );

      await logProcurementAudit({
        action: "ASSET_RETURNED_TO_STORAGE",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "asset-management",
        recordId: asset.id,
        details: { assetTag: asset.assetTag, previousCustodian: asset.custodian },
      });

      return NextResponse.json({ success: true, message: `Asset ${asset.assetTag} returned to storage.` });
    }

    // ─────────────────────────────────────────────────────────────
    //  ACTION: TRANSFER
    // ─────────────────────────────────────────────────────────────
    if (action === "TRANSFER") {
      const {
        fromEntity,
        toEntity,
        previousLocation,
        newLocation,
        reason,
        remarks,
      } = body;

      const newTransfer: AssetTransfer = {
        transferNumber: `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        fromEntity: fromEntity || asset.department,
        toEntity: toEntity || "New Department",
        previousLocation: previousLocation || asset.location,
        newLocation: newLocation || asset.location,
        reason: reason || "Operational re-allocation",
        transferDate: body.transferDate || today,
        approvedBy: auth.user.name,
        releasedBy: body.releasedBy || auth.user.name,
        receivedBy: body.receivedBy || "Receiving Officer",
        remarks,
      };

      const transfers = [...(asset.transfers || []), newTransfer];

      await col.updateOne(
        { id: asset.id },
        {
          $set: {
            department: toEntity || asset.department,
            location: newLocation || asset.location,
            transfers,
            updatedAt: nowIso,
          },
        }
      );

      await logProcurementAudit({
        action: "ASSET_TRANSFERRED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "asset-management",
        recordId: asset.id,
        details: { assetTag: asset.assetTag, transfer: newTransfer },
      });

      return NextResponse.json({ success: true, message: "Asset transferred successfully.", transfer: newTransfer });
    }

    // ─────────────────────────────────────────────────────────────
    //  ACTION: MAINTENANCE
    // ─────────────────────────────────────────────────────────────
    if (action === "MAINTENANCE") {
      const {
        type,
        serviceProvider,
        date,
        problemReported,
        workPerformed,
        partsUsed,
        labourCost = 0,
        totalCost = 0,
        warrantyStatus,
        nextServiceDate,
        technician,
        remarks,
      } = body;

      const newMnt: AssetMaintenance = {
        maintenanceId: `MNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        type: type || "Routine",
        serviceProvider: serviceProvider || "Certified Service Center",
        date: date || today,
        problemReported: problemReported || "Scheduled Servicing",
        workPerformed: workPerformed || "Inspection and tuning",
        partsUsed,
        labourCost: parseFloat(labourCost) || 0,
        totalCost: parseFloat(totalCost) || 0,
        warrantyStatus: warrantyStatus || "Under Warranty",
        nextServiceDate,
        technician: technician || "Technician",
        remarks,
      };

      const maintenance = [...(asset.maintenance || []), newMnt];

      await col.updateOne(
        { id: asset.id },
        {
          $set: {
            status: "Under Maintenance",
            maintenance,
            updatedAt: nowIso,
          },
        }
      );

      await logProcurementAudit({
        action: "ASSET_MAINTENANCE_LOGGED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "asset-management",
        recordId: asset.id,
        details: { assetTag: asset.assetTag, maintenance: newMnt },
      });

      return NextResponse.json({ success: true, message: "Maintenance record saved.", maintenance: newMnt });
    }

    // ─────────────────────────────────────────────────────────────
    //  ACTION: INSPECTION
    // ─────────────────────────────────────────────────────────────
    if (action === "INSPECTION") {
      const {
        inspectionDate,
        physicalLocation,
        condition,
        serialNumberVerified = true,
        assetTagVerified = true,
        workingCondition = true,
        damageNotes,
        findings,
        recommendedAction,
      } = body;

      const newInspection: AssetInspection = {
        inspectionId: `INSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        inspectionDate: inspectionDate || today,
        physicalLocation: physicalLocation || asset.location,
        custodian: asset.custodian || "In Storage",
        condition: condition || "Good",
        serialNumberVerified: Boolean(serialNumberVerified),
        assetTagVerified: Boolean(assetTagVerified),
        workingCondition: Boolean(workingCondition),
        damageNotes,
        inspector: auth.user.name,
        findings: findings || "Physical condition and operational status verified.",
        recommendedAction: recommendedAction || "Continue in active deployment",
      };

      const inspections = [...(asset.inspections || []), newInspection];

      await col.updateOne(
        { id: asset.id },
        {
          $set: {
            inspections,
            updatedAt: nowIso,
          },
        }
      );

      await logProcurementAudit({
        action: "ASSET_INSPECTION_LOGGED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "asset-management",
        recordId: asset.id,
        details: { assetTag: asset.assetTag, inspection: newInspection },
      });

      return NextResponse.json({ success: true, message: "Asset inspection logged.", inspection: newInspection });
    }

    // ─────────────────────────────────────────────────────────────
    //  ACTION: DISPOSE
    // ─────────────────────────────────────────────────────────────
    if (action === "DISPOSE") {
      const {
        reason,
        method,
        approval,
        disposalDate,
        disposalValue = 0,
        buyerRecipient,
        disposalEvidence,
        authorizedOfficer,
      } = body;

      if (!reason || !method) {
        return NextResponse.json({ error: "Disposal reason and method are required." }, { status: 400 });
      }

      const disposal: AssetDisposal = {
        disposalId: `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        description: `Disposal of ${asset.name} (${asset.assetTag})`,
        originalCost: asset.assetCost,
        accumulatedDepreciation: asset.accumulatedDepreciation,
        netBookValue: asset.netBookValue,
        reason: reason.trim(),
        method,
        approval: approval || "Procurement Committee & CEO Endorsement",
        disposalDate: disposalDate || today,
        disposalValue: parseFloat(disposalValue) || 0,
        buyerRecipient,
        disposalEvidence,
        authorizedOfficer: authorizedOfficer || auth.user.name,
        financeConfirmation: true,
        confirmedAt: nowIso,
      };

      // Disposed asset STAYS in register with Status: Disposed. Never hard deleted!
      await col.updateOne(
        { id: asset.id },
        {
          $set: {
            status: "Disposed",
            disposal,
            custodian: undefined,
            custodianEmployeeId: undefined,
            updatedAt: nowIso,
          },
        }
      );

      // Audit trail
      await logProcurementAudit({
        action: "ASSET_DISPOSED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "asset-management",
        recordId: asset.id,
        details: {
          assetTag: asset.assetTag,
          name: asset.name,
          cost: asset.assetCost,
          nbv: asset.netBookValue,
          method,
          reason,
        },
      });

      // Notification to Internal Audit & Risk Director (IAR)!
      await dispatchProcurementNotification({
        title: `ASSET DISPOSAL APPROVED: ${asset.assetTag}`,
        message: `Asset ${asset.name} (${asset.assetTag}) officially disposed via ${method}. Net Book Value: ${asset.netBookValue} NLe.`,
        type: "info",
        targetRoles: ["IAR", "PRC", "SA"],
        tab: "asset-management",
        itemId: asset.id,
      });

      return NextResponse.json({ success: true, message: `Asset ${asset.assetTag} disposed. Record kept with status Disposed.`, disposal });
    }

    // ─────────────────────────────────────────────────────────────
    //  ACTION: INCIDENT (Lost / Stolen / Damaged)
    // ─────────────────────────────────────────────────────────────
    if (action === "INCIDENT") {
      const {
        incidentType = "Lost",
        dateReported,
        location,
        circumstances,
        policeReportNumber,
        internalInvestigation,
        recoveryStatus = "Pending",
        managementDecision,
        responsibleOfficer,
        resolution,
      } = body;

      const incident: AssetIncident = {
        incidentNumber: `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        custodian: asset.custodian || "Unassigned",
        dateReported: dateReported || today,
        location: location || asset.location,
        circumstances: circumstances || "Reported incident",
        policeReportNumber,
        internalInvestigation: internalInvestigation || "Investigation opened by Security & Procurement Directorate.",
        recoveryStatus: recoveryStatus as any,
        managementDecision: managementDecision || "Under review",
        responsibleOfficer: responsibleOfficer || auth.user.name,
        resolution,
      };

      const incidents = [...(asset.incidents || []), incident];
      const newStatus = incidentType === "Stolen" ? "Stolen" : incidentType === "Damaged" ? "Damaged" : "Lost";

      await col.updateOne(
        { id: asset.id },
        {
          $set: {
            status: newStatus as any,
            incidents,
            updatedAt: nowIso,
          },
        }
      );

      await logProcurementAudit({
        action: `ASSET_INCIDENT_${newStatus.toUpperCase()}`,
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "asset-management",
        recordId: asset.id,
        details: { assetTag: asset.assetTag, incident },
      });

      // Notification to Internal Audit & Risk Director (IAR)!
      await dispatchProcurementNotification({
        title: `SECURITY INCIDENT: Asset Reported ${newStatus.toUpperCase()} (${asset.assetTag})`,
        message: `Asset ${asset.name} (${asset.assetTag}) reported ${newStatus} at ${location || asset.location}. Police Report: ${policeReportNumber || "N/A"}.`,
        type: "alert",
        targetRoles: ["IAR", "PRC", "SA"],
        tab: "asset-management",
        itemId: asset.id,
      });

      return NextResponse.json({ success: true, message: `Incident recorded. Asset status updated to ${newStatus}.`, incident });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/procurement/assets/actions] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to execute asset action" }, { status: 500 });
  }
}
