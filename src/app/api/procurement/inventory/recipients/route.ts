import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { enforceProcurementAccess } from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    const [empCol, benCol] = await Promise.all([
      getCollection<any>(COLLECTIONS.EMPLOYEES),
      getCollection<any>(COLLECTIONS.BENEFICIARIES).catch(() => null),
    ]);

    const employees = await empCol.find({}).project({
      id: 1,
      employeeId: 1,
      name: 1,
      fullName: 1,
      department: 1,
      dept: 1,
      title: 1,
      position: 1,
      location: 1,
      office: 1,
      district: 1,
    }).toArray();

    const formattedStaff = employees.map((e: any) => ({
      id: e.employeeId || e.id || e._id?.toString(),
      name: e.fullName || e.name || "Staff Member",
      type: "Staff" as const,
      department: e.department || e.dept || "BCF Operations",
      title: e.title || e.position || "Staff",
      location: e.location || e.office || (e.district ? `${e.district} District Office` : "BCF Head Office, Freetown"),
    }));

    let formattedBeneficiaries: any[] = [];
    if (benCol) {
      const beneficiaries = await benCol.find({}).limit(50).toArray();
      formattedBeneficiaries = beneficiaries.map((b: any) => ({
        id: b.id || b._id?.toString(),
        name: b.name || b.fullName || b.communityName || "Beneficiary Group",
        type: "Beneficiary" as const,
        department: b.programme || b.project || "Community Development",
        title: b.category || "Beneficiary",
        location: b.community || b.district ? `${b.community || ""} ${b.district || ""}`.trim() : "Sierra Leone",
      }));
    }

    // Default sample community beneficiaries if empty
    if (formattedBeneficiaries.length === 0) {
      formattedBeneficiaries = [
        {
          id: "BEN-001",
          name: "Kenema District Primary School Board",
          type: "Beneficiary",
          department: "Education Program",
          title: "School Beneficiary",
          location: "Kenema District Office, Eastern Province",
        },
        {
          id: "BEN-002",
          name: "Gbendembu Community Health Post",
          type: "Beneficiary",
          department: "Health Supplies",
          title: "Clinic Beneficiary",
          location: "Gbendembu, Bombali District",
        },
        {
          id: "BEN-003",
          name: "Bo Children Learning Centre",
          type: "Beneficiary",
          department: "Child Welfare",
          title: "Learning Center",
          location: "Kakua Chiefdom, Bo District",
        },
        {
          id: "BEN-004",
          name: "Kissy Youth Development Centre",
          type: "Beneficiary",
          department: "Youth Empowerment",
          title: "Youth Group",
          location: "Kissy, Western Area Urban",
        },
      ];
    }

    return NextResponse.json({
      success: true,
      recipients: [...formattedStaff, ...formattedBeneficiaries],
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/inventory/recipients] Error:", err);
    return NextResponse.json({ success: false, recipients: [] });
  }
}
