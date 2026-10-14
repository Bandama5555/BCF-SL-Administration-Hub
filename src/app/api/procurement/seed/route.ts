import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  DEFAULT_PROCUREMENT_SETTINGS,
  DEFAULT_PROCUREMENT_EXT_PERMISSIONS,
  type InventoryItem,
  type InventoryStore,
  type AssetRecord,
  type ProcurementSettings,
  type ProcurementPermissionRow,
} from "@/lib/inventoryAssetTypes";
import { type RoleCode } from "@/lib/permissions";
import { extractProcurementUser, logProcurementAudit } from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const user = extractProcurementUser(req);
    const reset = req.nextUrl.searchParams.get("reset") === "true";

    // 1. Seed or update permissions rows in MongoDB
    const permCol = await getCollection<ProcurementPermissionRow>(COLLECTIONS.PROCUREMENT_PERMISSIONS);
    const permCount = await permCol.countDocuments();
    if (permCount === 0 || reset) {
      if (reset) await permCol.deleteMany({});
      const rows: ProcurementPermissionRow[] = [];
      const now = new Date().toISOString();
      const roles: RoleCode[] = ["SA", "PRC", "HR", "CEO", "IAR", "ST", "FIN", "PRG", "IT"];
      for (const role of roles) {
        rows.push({
          role,
          tab: "inventory-management",
          level: DEFAULT_PROCUREMENT_EXT_PERMISSIONS[role]["inventory-management"],
          updatedAt: now,
        });
        rows.push({
          role,
          tab: "asset-management",
          level: DEFAULT_PROCUREMENT_EXT_PERMISSIONS[role]["asset-management"],
          updatedAt: now,
        });
      }
      await permCol.insertMany(rows as any);
    }

    // 2. Seed procurement settings
    const settingsCol = await getCollection<ProcurementSettings>(COLLECTIONS.PROCUREMENT_SETTINGS);
    const settingsCount = await settingsCol.countDocuments();
    if (settingsCount === 0 || reset) {
      if (reset) await settingsCol.deleteMany({});
      await settingsCol.insertOne({
        ...DEFAULT_PROCUREMENT_SETTINGS,
        updatedAt: new Date().toISOString(),
      } as any);
    }

    // 3. Seed inventory stores
    const storesCol = await getCollection<InventoryStore>(COLLECTIONS.INVENTORY_STORES);
    const storesCount = await storesCol.countDocuments();
    if (storesCount === 0 || reset) {
      if (reset) await storesCol.deleteMany({});
      const seedStores: InventoryStore[] = [
        {
          id: "BCF-STORE-001",
          storeName: "BCF Central Warehouse, Freetown",
          location: "BCF Head Office, Freetown",
          district: "Western Area Urban",
          chiefdom: "Central Freetown",
          storekeeper: "Alie Koroma",
          contact: "+232 78 242 826",
          storageType: "Central Warehouse",
          capacity: 10000,
          status: "Active",
          createdAt: "2026-01-01T08:00:00Z",
          updatedAt: "2026-01-01T08:00:00Z",
        },
        {
          id: "BCF-STORE-002",
          storeName: "Bo Regional Humanitarian Depot",
          location: "Bo District Office, Bo Town",
          district: "Bo",
          chiefdom: "Kakua",
          storekeeper: "Foday Conteh",
          contact: "+232 77 341 902",
          storageType: "Regional Depot",
          capacity: 5000,
          status: "Active",
          createdAt: "2026-01-05T09:00:00Z",
          updatedAt: "2026-01-05T09:00:00Z",
        },
        {
          id: "BCF-STORE-003",
          storeName: "Kenema Agricultural & Field Store",
          location: "Kenema District Office",
          district: "Kenema",
          chiefdom: "Nongowa",
          storekeeper: "Mariama Kamara",
          contact: "+232 76 112 543",
          storageType: "Field Transit",
          capacity: 4000,
          status: "Active",
          createdAt: "2026-01-10T10:00:00Z",
          updatedAt: "2026-01-10T10:00:00Z",
        },
        {
          id: "BCF-STORE-004",
          storeName: "Makeni Northern Hub Store",
          location: "Makeni District Office",
          district: "Bombali",
          chiefdom: "Gbendembu",
          storekeeper: "Sorie Bangura",
          contact: "+232 79 554 120",
          storageType: "Regional Depot",
          capacity: 3500,
          status: "Active",
          createdAt: "2026-01-12T11:00:00Z",
          updatedAt: "2026-01-12T11:00:00Z",
        },
      ];
      await storesCol.insertMany(seedStores as any);
    }

    // 4. Seed initial inventory items
    const itemsCol = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const itemsCount = await itemsCol.countDocuments();
    if (itemsCount === 0 || reset) {
      if (reset) await itemsCol.deleteMany({});
      const seedItems: InventoryItem[] = [
        {
          id: "INV-ITEM-0001",
          stockCode: "BCF-OFF-0001",
          name: "A4 Executive Copy Paper (80gsm)",
          description: "Premium multipurpose printing & photocopying paper for institutional reporting.",
          category: "Office Supplies",
          subcategory: "Stationery",
          brand: "Double A",
          model: "80gsm Ultra White",
          sku: "PAP-A4-80",
          unit: "Box (5 Reams)",
          barcode: "8858741002341",
          itemClass: "Consumable",
          minStockLevel: 10,
          maxStockLevel: 100,
          reorderLevel: 30,
          reorderQuantity: 50,
          currentBalance: 25, // Demonstrates low stock alert!
          unitCost: 450,
          totalValue: 11250,
          warehouseId: "BCF-STORE-001",
          warehouseName: "BCF Central Warehouse, Freetown",
          status: "Low Stock",
          createdAt: "2026-01-15T09:00:00Z",
          updatedAt: "2026-01-15T09:00:00Z",
        },
        {
          id: "INV-ITEM-0002",
          stockCode: "BCF-PRG-0001",
          name: "Student Learning Kits & Backpacks",
          description: "Heavy duty branded school bags with exercise books, geometry sets, and pens.",
          category: "Programme Materials",
          subcategory: "Education Supplies",
          brand: "BCF Education",
          model: "2026 Primary Edition",
          sku: "EDU-BAG-2026",
          unit: "Kit",
          barcode: "8858741005521",
          itemClass: "Programme Material",
          minStockLevel: 50,
          maxStockLevel: 1000,
          reorderLevel: 150,
          reorderQuantity: 500,
          currentBalance: 500,
          unitCost: 180,
          totalValue: 90000,
          warehouseId: "BCF-STORE-001",
          warehouseName: "BCF Central Warehouse, Freetown",
          programmeId: "PRG-EDU-01",
          programmeName: "Girls Primary Education Initiative",
          donorId: "DNR-UNICEF-01",
          donorName: "UNICEF Sierra Leone",
          status: "In Stock",
          createdAt: "2026-01-20T10:00:00Z",
          updatedAt: "2026-01-20T10:00:00Z",
        },
        {
          id: "INV-ITEM-0003",
          stockCode: "BCF-MED-0001",
          name: "Community First Aid & Trauma Response Kits",
          description: "Sterile gauze, antiseptics, bandages, splints, and diagnostic monitors.",
          category: "Medical & Health",
          subcategory: "First Aid",
          brand: "Lifeline Global",
          model: "Trauma Pro-V3",
          sku: "MED-FAK-2026",
          unit: "Kit",
          barcode: "8858741008812",
          itemClass: "Consumable",
          minStockLevel: 15,
          maxStockLevel: 100,
          reorderLevel: 25,
          reorderQuantity: 40,
          currentBalance: 40,
          unitCost: 650,
          totalValue: 26000,
          warehouseId: "BCF-STORE-002",
          warehouseName: "Bo Regional Humanitarian Depot",
          expiryDate: "2026-11-30", // Expiring within warning period
          status: "In Stock",
          createdAt: "2026-02-01T11:00:00Z",
          updatedAt: "2026-02-01T11:00:00Z",
        },
        {
          id: "INV-ITEM-0004",
          stockCode: "BCF-FLT-0001",
          name: "Land Cruiser Heavy Duty Fuel Filter Elements",
          description: "OEM replacement diesel fuel filters for Toyota Land Cruiser field vehicles.",
          category: "Spare Parts",
          subcategory: "Vehicle Fleet",
          brand: "Toyota Genuine Parts",
          model: "23390-51070",
          sku: "FLT-TOY-2339",
          unit: "Piece",
          barcode: "8858741009943",
          itemClass: "Spare Part",
          minStockLevel: 5,
          maxStockLevel: 30,
          reorderLevel: 8,
          reorderQuantity: 15,
          currentBalance: 0, // Demonstrates Out of Stock alert!
          unitCost: 320,
          totalValue: 0,
          warehouseId: "BCF-STORE-001",
          warehouseName: "BCF Central Warehouse, Freetown",
          status: "Out of Stock",
          createdAt: "2026-02-10T12:00:00Z",
          updatedAt: "2026-02-10T12:00:00Z",
        },
      ];
      await itemsCol.insertMany(seedItems as any);
    }

    // 5. Seed initial asset records
    const assetsCol = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const assetsCount = await assetsCol.countDocuments();
    if (assetsCount === 0 || reset) {
      if (reset) await assetsCol.deleteMany({});
      const seedAssets: AssetRecord[] = [
        {
          id: "BCF-AST-2026-000001",
          assetTag: "BCF-AST-2026-000001",
          name: "Lenovo ThinkPad T14 Gen 4 Enterprise Laptop",
          category: "IT Equipment & Technology",
          subcategory: "Laptops & Portables",
          description: "Intel Core i7 13th Gen, 32GB RAM, 1TB NVMe SSD, 14 inch WUXGA Anti-glare.",
          brand: "Lenovo",
          model: "ThinkPad T14 Gen 4",
          serialNumber: "PF49XK21",
          barcode: "BCF-AST-2026-000001",
          qrCodeData: "https://bcf-sl.org/asset/BCF-AST-2026-000001",
          procurementId: "BCF-PRC-2026-0012",
          txnId: "BCF-TXN-2026-000021",
          poNumber: "PO-2026-0012",
          grnNumber: "GRN-2026-0012",
          supplier: "ABC General Supplies Ltd",
          purchaseDate: "2026-01-10",
          purchaseCost: 28500,
          department: "Procurement Department",
          location: "BCF Head Office, Freetown",
          custodian: "Hassan Kanu",
          custodianEmployeeId: "BCF-EMP-PRC-001",
          responsibleOfficer: "Hassan Kanu (Procurement Director)",
          assetCost: 28500,
          currency: "NLe",
          acquisitionDate: "2026-01-10",
          depreciationMethod: "Straight Line",
          usefulLife: 3,
          residualValue: 1425,
          accumulatedDepreciation: 1504,
          netBookValue: 26996,
          status: "Assigned",
          warrantyExpiry: "2029-01-10",
          assignments: [
            {
              assignmentNumber: "ASN-2026-001",
              employeeId: "BCF-EMP-PRC-001",
              employeeName: "Hassan Kanu",
              department: "Procurement Department",
              position: "Procurement & Supply Chain Director",
              location: "BCF Head Office, Freetown",
              dateAssigned: "2026-01-15",
              conditionAtIssue: "Brand New Sealed Box",
              issuedBy: "Mariama Sesay (HR Director)",
              receivedBy: "Hassan Kanu",
              active: true,
            },
          ],
          transfers: [],
          maintenance: [],
          inspections: [],
          incidents: [],
          createdAt: "2026-01-10T14:00:00Z",
          updatedAt: "2026-01-15T09:30:00Z",
        },
        {
          id: "BCF-AST-2026-000002",
          assetTag: "BCF-AST-2026-000002",
          name: "Toyota Land Cruiser HZJ76 Hardtop 4x4",
          category: "Vehicles & Transport",
          subcategory: "Operational Fleet",
          description: "4.2L 6-Cylinder Diesel, 4WD, Heavy duty bullbar, winch, dual fuel tanks, VHF radio.",
          brand: "Toyota",
          model: "Land Cruiser HZJ76",
          serialNumber: "JT711HZJ082341",
          barcode: "BCF-AST-2026-000002",
          qrCodeData: "https://bcf-sl.org/asset/BCF-AST-2026-000002",
          txnId: "BCF-TXN-2026-000005",
          poNumber: "PO-2026-0004",
          grnNumber: "GRN-2026-0004",
          supplier: "Sierra Vehicle Importers SL",
          purchaseDate: "2025-11-20",
          purchaseCost: 650000,
          department: "Executive Management",
          location: "BCF Head Office, Freetown",
          custodian: "Dr. Alimamy Koroma",
          custodianEmployeeId: "BCF-EMP-CEO-001",
          responsibleOfficer: "Dr. Alimamy Koroma (CEO)",
          assetCost: 650000,
          currency: "NLe",
          acquisitionDate: "2025-11-20",
          depreciationMethod: "Straight Line",
          usefulLife: 5,
          residualValue: 65000,
          accumulatedDepreciation: 43875,
          netBookValue: 606125,
          status: "Active",
          warrantyExpiry: "2028-11-20",
          assignments: [],
          transfers: [],
          maintenance: [
            {
              maintenanceId: "MNT-2026-001",
              type: "Routine",
              serviceProvider: "Toyota Sierra Leone Certified Service",
              date: "2026-02-15",
              problemReported: "10,000 KM scheduled service",
              workPerformed: "Full oil and filter replacement, brake inspection, suspension greasing.",
              labourCost: 1800,
              totalCost: 4500,
              warrantyStatus: "Valid under Toyota Warranty",
              nextServiceDate: "2026-08-15",
              technician: "Abu Bakarr Mansaray",
            },
          ],
          inspections: [],
          incidents: [],
          createdAt: "2025-11-20T10:00:00Z",
          updatedAt: "2026-02-15T15:00:00Z",
        },
      ];
      await assetsCol.insertMany(seedAssets as any);
    }

    await logProcurementAudit({
      action: "PROCUREMENT_SYSTEM_SEEDED",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      tab: "inventory-management",
      details: { reset },
    });

    return NextResponse.json({
      success: true,
      message: "Procurement inventory and asset management system seeded successfully.",
      counts: {
        stores: await (await getCollection(COLLECTIONS.INVENTORY_STORES)).countDocuments(),
        items: await (await getCollection(COLLECTIONS.INVENTORY_ITEMS)).countDocuments(),
        assets: await (await getCollection(COLLECTIONS.ASSETS)).countDocuments(),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/seed] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to seed data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
