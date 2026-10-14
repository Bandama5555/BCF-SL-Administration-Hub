import { NextRequest, NextResponse } from "next/server";
import { getDepartmentDirectory, getExecutiveManagementMembers } from "@/lib/accessServer";
import { ensureAccessCatalogueAndSettings } from "@/lib/accessCatalogueSeed";

export async function GET(req: NextRequest) {
  try {
    const { settings } = await ensureAccessCatalogueAndSettings();
    const directory = await getDepartmentDirectory(settings);
    const executiveManagementMembers = await getExecutiveManagementMembers();

    return NextResponse.json({
      success: true,
      departments: directory.departments,
      departmentDirectors: directory.departmentDirectors,
      fallbackDirector: directory.fallbackDirector,
      allDirectors: directory.allDirectors,
      executiveManagementMembers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
