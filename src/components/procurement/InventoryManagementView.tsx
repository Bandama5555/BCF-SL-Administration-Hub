"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  type InventoryItem,
  type InventoryStore,
  type InventoryTransaction,
  type ItemClass,
  type AdjustmentType,
  type StockReturnItem,
} from "@/lib/inventoryAssetTypes";
import { getUser, type AuthUser } from "@/lib/auth";
import { normalizeRole, type RoleCode } from "@/lib/permissions";

type SubSection =
  | "dashboard"
  | "items"
  | "stores"
  | "receipts"
  | "issues"
  | "transfers"
  | "returns"
  | "adjustments"
  | "counts"
  | "reorder"
  | "expiry"
  | "reports";

export function InventoryManagementView() {
  const [activeSection, setActiveSection] = useState<SubSection>("dashboard");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<InventoryStore[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canFull, setCanFull] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const currentRoleCode = normalizeRole(user?.role, user?.username, user?.email);
  const canIssue =
    currentRoleCode === "SA" ||
    currentRoleCode === "PRC" ||
    (user as any)?.role === "Admin" ||
    (user as any)?.role === "Procurement Director";

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  // Modals state
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [selectedStoreForStock, setSelectedStoreForStock] = useState<InventoryStore | null>(null);
  const [storeStockSearch, setStoreStockSearch] = useState("");
  const [updatingStoreId, setUpdatingStoreId] = useState<string | null>(null);

  // Form states for mutations
  const [newStore, setNewStore] = useState({
    storeName: "",
    location: "",
    district: "Western Area Urban",
    chiefdom: "Central",
    storekeeper: "",
    contact: "",
    storageType: "Regional Depot",
    capacity: 5000,
    status: "Active" as "Active" | "Inactive" | "Suspended" | "Closed",
    securityName: "",
    securityAddress: "",
    securityPhone: "",
    securityAgency: "",
    securitySupervisorName: "",
    securitySupervisorPhone: "",
    securitySupervisorAddress: "",
  });

  const [editingStore, setEditingStore] = useState<InventoryStore | null>(null);
  const [editStoreForm, setEditStoreForm] = useState({
    storeName: "",
    location: "",
    district: "Western Area Urban",
    chiefdom: "Central",
    storekeeper: "",
    contact: "",
    storageType: "Regional Depot",
    capacity: 5000,
    status: "Active" as "Active" | "Inactive" | "Suspended" | "Closed",
    securityName: "",
    securityAddress: "",
    securityPhone: "",
    securityAgency: "",
    securitySupervisorName: "",
    securitySupervisorPhone: "",
    securitySupervisorAddress: "",
  });
  const [newItem, setNewItem] = useState({
    stockCode: "",
    name: "",
    description: "",
    category: "Office Supplies",
    itemClass: "Consumable" as ItemClass,
    unit: "Unit",
    minStockLevel: 10,
    maxStockLevel: 100,
    reorderLevel: 25,
    reorderQuantity: 50,
    currentBalance: 50,
    unitCost: 100,
    warehouseId: "BCF-STORE-001",
    warehouseName: "BCF Central Warehouse, Freetown",
    expiryDate: "",
  });

  const [issueForm, setIssueForm] = useState({
    storeId: "",
    storeName: "",
    itemId: "",
    itemSearch: "",
    quantityRequested: 1,
    quantity: 1,
    recipient: "",
    location: "",
    department: "Programs Department",
    programme: "Girls Primary Education Initiative",
    donor: "UNICEF Sierra Leone",
    purpose: "Community distribution",
  });
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientsDirectory, setRecipientsDirectory] = useState<any[]>([]);
  const [isRecipientDropdownOpen, setIsRecipientDropdownOpen] = useState(false);
  const [confirmedVoucher, setConfirmedVoucher] = useState<InventoryTransaction | null>(null);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueError, setIssueError] = useState("");

  const [adjForm, setAdjForm] = useState({
    itemId: "",
    quantity: 1,
    adjustmentType: "Damage" as AdjustmentType,
    reason: "",
    requestedByName: "",
    approvedByName: "",
  });

  const [transferForm, setTransferForm] = useState({
    itemId: "",
    quantity: 1,
    sourceStoreId: "BCF-STORE-001",
    sourceStoreName: "BCF Central Warehouse, Freetown",
    destStoreId: "BCF-STORE-002",
    destStoreName: "Bo Regional Humanitarian Depot",
    reason: "Inter-district stock rebalancing",
    referenceNumber: "",
    notes: "",
  });
  const [transferSearch, setTransferSearch] = useState("");
  const [transferSourceFilter, setTransferSourceFilter] = useState("ALL");
  const [transferDestFilter, setTransferDestFilter] = useState("ALL");
  const [selectedTransferForView, setSelectedTransferForView] = useState<InventoryTransaction | null>(null);

  const openTransferModal = (sourceId?: string, itId?: string) => {
    // Immediately close any open warehouse view modal so transfer dialog is displayed clearly
    setSelectedStoreForStock(null);

    const srcId = sourceId || (stores[0]?.id || "BCF-STORE-001");
    const srcStore = stores.find((s) => s.id === srcId);
    const destOptions = stores.filter((s) => s.id !== srcId);
    const firstDest = destOptions[0] || stores[0];

    const storeAvailableItems = items.filter(
      (it) =>
        (it.warehouseId === srcId ||
          it.warehouseName === srcStore?.storeName ||
          (srcId === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central"))) &&
        (it.currentBalance || 0) > 0
    );

    const targetItemId =
      itId ||
      storeAvailableItems[0]?.id ||
      items.find((i) => (i.currentBalance || 0) > 0)?.id ||
      items[0]?.id ||
      "";

    setTransferForm({
      itemId: targetItemId,
      quantity: 1,
      sourceStoreId: srcId,
      sourceStoreName: srcStore?.storeName || "BCF Central Warehouse, Freetown",
      destStoreId: firstDest?.id || "",
      destStoreName: firstDest?.storeName || "",
      reason: "Inter-district stock rebalancing",
      referenceNumber: `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: "",
    });
    setIsTransferModalOpen(true);
  };

  // ─── STOCK RECEIPT FEATURE STATE & HELPERS ───
  const canRecordReceipt = currentRoleCode === "SA" || currentRoleCode === "PRC";

  interface ReceiptItemRow {
    rowId: string;
    itemId: string;
    itemName: string;
    stockCode: string;
    unit: string;
    orderedQuantity: number;
    alreadyReceivedQuantity: number;
    outstandingQuantity: number;
    quantityReceived: number | string;
    quantityRejected: number | string;
    acceptedQuantity: number;
    condition: "Good" | "Damaged" | "Incomplete";
    batchNumber: string;
    expiryDate: string;
    unitCost: number | string;
    totalValue: number | string;
    remarks: string;
    isFixedAsset?: boolean;
    isPerishable?: boolean;
    fixedAssetWarning?: string;
  }

  const [isRecordReceiptOpen, setIsRecordReceiptOpen] = useState(false);
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptSuccessRef, setReceiptSuccessRef] = useState<string | null>(null);

  const [receiptOptions, setReceiptOptions] = useState<{
    grns: any[];
    pos: any[];
    stores: any[];
    items: any[];
    settings: { localPurchaseApprovalLimit: number; receiptTolerancePercent: number };
    suppliers: string[];
    programmes: string[];
    donors: string[];
  } | null>(null);

  const [receiptForm, setReceiptForm] = useState({
    source: "GRN" as "GRN" | "Local Purchase" | "Humanitarian Consignment",
    selectedGrnRef: "",
    referenceNumber: "",
    dateReceived: new Date().toISOString().split("T")[0],
    storeId: "",
    storeName: "",
    poNumber: "",
    supplier: "",
    invoiceNumber: "",
    invoiceDocument: "",
    donor: "",
    consignmentNumber: "",
    deliveryDocument: "",
    estimatedValue: "",
    programme: "",
    remarks: "",
    items: [] as ReceiptItemRow[],
  });

  const [isReverseReceiptModalOpen, setIsReverseReceiptModalOpen] = useState(false);
  const [reversingTxn, setReversingTxn] = useState<InventoryTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalApprover, setReversalApprover] = useState("");
  const [isSubmittingReversal, setIsSubmittingReversal] = useState(false);
  const [reversalError, setReversalError] = useState("");

  const [isPrintReceiptVoucherOpen, setIsPrintReceiptVoucherOpen] = useState(false);
  const [voucherReceiptTxns, setVoucherReceiptTxns] = useState<InventoryTransaction[]>([]);
  const [isApprovingReceipt, setIsApprovingReceipt] = useState(false);

  const loadReceiptOptions = async () => {
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/receipt-options", {
        headers: { "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" }
      });
      if (res.ok) {
        const d = await res.json();
        setReceiptOptions(d);
        return d;
      }
    } catch (err) {
      console.error("Failed to load receipt options", err);
    }
    return null;
  };

  const openRecordReceiptModal = async () => {
    setReceiptError("");
    const opts = await loadReceiptOptions();
    const todayIso = new Date().toISOString().split("T")[0];
    const activeStores = stores.filter((s) => s.status === "Active" || s.status === "active");
    const preselectedStore = activeStores.length === 1 ? activeStores[0] : (activeStores[0] || null);

    const initialRow: ReceiptItemRow = {
      rowId: `ROW-${Date.now()}-1`,
      itemId: "",
      itemName: "",
      stockCode: "",
      unit: "",
      orderedQuantity: 0,
      alreadyReceivedQuantity: 0,
      outstandingQuantity: 0,
      quantityReceived: "",
      quantityRejected: 0,
      acceptedQuantity: 0,
      condition: "Good",
      batchNumber: "",
      expiryDate: "",
      unitCost: "",
      totalValue: "",
      remarks: "",
    };

    setReceiptForm({
      source: "GRN",
      selectedGrnRef: "",
      referenceNumber: "",
      dateReceived: todayIso,
      storeId: preselectedStore ? preselectedStore.id : "",
      storeName: preselectedStore ? preselectedStore.storeName : "",
      poNumber: "",
      supplier: "",
      invoiceNumber: "",
      invoiceDocument: "",
      donor: "",
      consignmentNumber: "",
      deliveryDocument: "",
      estimatedValue: "",
      programme: "",
      remarks: "",
      items: [initialRow],
    });
    setIsRecordReceiptOpen(true);
  };

  const handleSelectGRN = (val: string) => {
    if (val === "NO_GRN") {
      const year = new Date().getFullYear();
      const countRcv = transactions.filter((t) => t.type === "RECEIPT").length;
      const autoRef = `BCF-RCV-${year}-${String(countRcv + 1).padStart(6, "0")}`;
      setReceiptForm((prev) => ({
        ...prev,
        source: prev.source === "GRN" ? "Local Purchase" : prev.source,
        selectedGrnRef: "NO_GRN",
        referenceNumber: autoRef,
        poNumber: "",
        supplier: "",
        items: [
          {
            rowId: `ROW-${Date.now()}-1`,
            itemId: "",
            itemName: "",
            stockCode: "",
            unit: "",
            orderedQuantity: 0,
            alreadyReceivedQuantity: 0,
            outstandingQuantity: 0,
            quantityReceived: "",
            quantityRejected: 0,
            acceptedQuantity: 0,
            condition: "Good",
            batchNumber: "",
            expiryDate: "",
            unitCost: "",
            totalValue: "",
            remarks: "",
          },
        ],
      }));
      return;
    }

    const grn = receiptOptions?.grns.find((g) => g.referenceNumber === val);
    if (!grn) return;

    const storeMatch = stores.find((s) => s.id === grn.storeId) || stores.find((s) => s.storeName === grn.storeName);

    const mappedItems: ReceiptItemRow[] = grn.items.map((gi: any, idx: number) => {
      const masterItem = items.find((it) => it.stockCode === gi.stockCode || it.name === gi.name);
      return {
        rowId: `ROW-${Date.now()}-${idx + 1}`,
        itemId: masterItem?.id || gi.stockCode,
        itemName: gi.name,
        stockCode: gi.stockCode,
        unit: gi.unit || masterItem?.unit || "Pieces",
        orderedQuantity: gi.orderedQty || 0,
        alreadyReceivedQuantity: gi.alreadyReceivedQty || 0,
        outstandingQuantity: gi.outstandingQty || 0,
        quantityReceived: gi.outstandingQty || 0,
        quantityRejected: 0,
        acceptedQuantity: gi.outstandingQty || 0,
        condition: "Good",
        batchNumber: "",
        expiryDate: "",
        unitCost: gi.unitCost || masterItem?.unitCost || 0,
        totalValue: (gi.outstandingQty || 0) * (gi.unitCost || masterItem?.unitCost || 0),
        remarks: "",
        isFixedAsset: masterItem?.itemClass === "Fixed Asset",
        isPerishable: masterItem?.isPerishable,
      };
    });

    setReceiptForm((prev) => ({
      ...prev,
      source: "GRN",
      selectedGrnRef: grn.referenceNumber,
      referenceNumber: grn.referenceNumber,
      poNumber: grn.poNumber || "",
      supplier: grn.supplier || "",
      storeId: storeMatch ? storeMatch.id : prev.storeId,
      storeName: storeMatch ? storeMatch.storeName : prev.storeName,
      items: mappedItems.length > 0 ? mappedItems : prev.items,
    }));
  };

  const handleSelectItemInRow = (rowIndex: number, selectedItemName: string) => {
    const masterItem = items.find((it) => it.name === selectedItemName);
    if (!masterItem) return;

    if (masterItem.itemClass === "Fixed Asset" || masterItem.isFixedAsset) {
      setReceiptForm((prev) => {
        const updated = [...prev.items];
        updated[rowIndex] = {
          ...updated[rowIndex],
          itemId: "",
          itemName: "",
          stockCode: "",
          unit: "",
          fixedAssetWarning: "This is a fixed asset. Use Asset Management.",
        };
        return { ...prev, items: updated };
      });
      return;
    }

    setReceiptForm((prev) => {
      const updated = [...prev.items];
      const curRow = updated[rowIndex];
      const qRcv = parseFloat(curRow.quantityReceived as string) || 0;
      const uCost = masterItem.unitCost || 0;
      updated[rowIndex] = {
        ...curRow,
        itemId: masterItem.id,
        itemName: masterItem.name,
        stockCode: masterItem.stockCode,
        unit: masterItem.unit || "Unit",
        unitCost: curRow.unitCost || uCost,
        totalValue: qRcv * (parseFloat(curRow.unitCost as string) || uCost),
        isFixedAsset: false,
        isPerishable: masterItem.isPerishable,
        fixedAssetWarning: undefined,
      };
      return { ...prev, items: updated };
    });
  };

  const updateReceiptItemRow = (rowIndex: number, patch: Partial<ReceiptItemRow>) => {
    setReceiptForm((prev) => {
      const updated = [...prev.items];
      const row = { ...updated[rowIndex], ...patch };
      const qRcv = parseFloat(row.quantityReceived as string) || 0;
      const uCost = parseFloat(row.unitCost as string) || 0;
      row.totalValue = qRcv * uCost;
      updated[rowIndex] = row;
      return { ...prev, items: updated };
    });
  };

  const handleAddMoreItems = () => {
    const newRow: ReceiptItemRow = {
      rowId: `ROW-${Date.now()}-${receiptForm.items.length + 1}`,
      itemId: "",
      itemName: "",
      stockCode: "",
      unit: "",
      orderedQuantity: 0,
      alreadyReceivedQuantity: 0,
      outstandingQuantity: 0,
      quantityReceived: "",
      quantityRejected: 0,
      acceptedQuantity: 0,
      condition: "Good",
      batchNumber: "",
      expiryDate: "",
      unitCost: "",
      totalValue: "",
      remarks: "",
    };
    setReceiptForm((prev) => ({
      ...prev,
      items: [...prev.items, newRow],
    }));
  };

  const handleRemoveItemRow = (rowIndex: number) => {
    setReceiptForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== rowIndex),
    }));
  };

  const handleCancelReceipt = () => {
    const hasData =
      receiptForm.selectedGrnRef !== "" ||
      receiptForm.supplier !== "" ||
      receiptForm.items.some((it) => it.itemId !== "" || it.quantityReceived !== "");
    if (hasData) {
      if (!window.confirm("You have entered receipt details. Are you sure you want to cancel? Any unsaved changes will be lost.")) {
        return;
      }
    }
    setIsRecordReceiptOpen(false);
  };

  const isReceiptFormValid = useMemo(() => {
    if (!receiptForm.dateReceived) return false;
    const todayIso = new Date().toISOString().split("T")[0];
    if (receiptForm.dateReceived > todayIso) return false;
    if (!receiptForm.storeId) return false;

    if (receiptForm.source === "Local Purchase") {
      if (!receiptForm.supplier?.trim() || !receiptForm.invoiceNumber?.trim()) return false;
    } else if (receiptForm.source === "Humanitarian Consignment") {
      if (!receiptForm.donor?.trim() || (!receiptForm.consignmentNumber?.trim() && !(receiptForm as any).waybillNumber?.trim())) return false;
    }

    if (receiptForm.items.length === 0) return false;

    const seen = new Set<string>();
    for (const row of receiptForm.items) {
      if (!row.itemId) return false;
      if (row.fixedAssetWarning) return false;
      const key = `${row.itemId}__${receiptForm.storeId}`;
      if (seen.has(key)) return false;
      seen.add(key);

      const qRcv = parseFloat(row.quantityReceived as string) || 0;
      if (qRcv <= 0) return false;

      if (receiptForm.source === "GRN" && row.outstandingQuantity > 0) {
        if (qRcv > row.outstandingQuantity) return false;
      }

      const masterItem = items.find((it) => it.id === row.itemId || it.stockCode === row.stockCode);
      const isPerishOrBatch = masterItem?.isPerishable || masterItem?.isBatchTracked;
      if (isPerishOrBatch && (!row.batchNumber?.trim() || !row.expiryDate?.trim())) {
        return false;
      }

      if (row.orderedQuantity > 0 && qRcv !== row.orderedQuantity && !row.remarks?.trim() && !receiptForm.remarks?.trim()) {
        return false;
      }
      if (row.condition !== "Good" && !row.remarks?.trim() && !receiptForm.remarks?.trim()) {
        return false;
      }
    }

    return true;
  }, [receiptForm, items]);

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReceiptFormValid || isSubmittingReceipt) return;

    try {
      setIsSubmittingReceipt(true);
      setReceiptError("");
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);

      const payload = {
        type: "RECEIPT",
        source: receiptForm.source,
        referenceNumber: receiptForm.referenceNumber,
        grnNumber: receiptForm.selectedGrnRef !== "NO_GRN" ? receiptForm.selectedGrnRef : undefined,
        dateReceived: receiptForm.dateReceived,
        storeId: receiptForm.storeId,
        storeName: receiptForm.storeName,
        poNumber: receiptForm.poNumber,
        supplier: receiptForm.supplier,
        invoiceNumber: receiptForm.invoiceNumber,
        invoiceDocument: receiptForm.invoiceDocument || (receiptForm.source === "Local Purchase" ? "invoice_receipt.pdf" : undefined),
        donor: receiptForm.donor,
        consignmentNumber: receiptForm.consignmentNumber,
        deliveryDocument: receiptForm.deliveryDocument || (receiptForm.source === "Humanitarian Consignment" ? "consignment_waybill.pdf" : undefined),
        estimatedValue: parseFloat(receiptForm.estimatedValue) || 0,
        programme: receiptForm.programme,
        remarks: receiptForm.remarks,
        items: receiptForm.items.map((r) => ({
          itemId: r.itemId,
          stockCode: r.stockCode,
          itemName: r.itemName,
          quantityReceived: parseFloat(r.quantityReceived as string) || 0,
          quantityRejected: parseFloat(r.quantityRejected as string) || 0,
          condition: r.condition,
          batchNumber: r.batchNumber,
          expiryDate: r.expiryDate,
          unitCost: parseFloat(r.unitCost as string) || 0,
          totalValue: (parseFloat(r.quantityReceived as string) || 0) * (parseFloat(r.unitCost as string) || 0),
          orderedQuantity: r.orderedQuantity,
          alreadyReceivedQuantity: r.alreadyReceivedQuantity,
          outstandingQuantity: r.outstandingQuantity,
          remarks: r.remarks,
        })),
      };

      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setReceiptError(data.error || "Failed to record stock receipt.");
        return;
      }

      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        setTransactions((prev) => [...data.transactions, ...prev]);
        setVoucherReceiptTxns(data.transactions);
      }

      setReceiptSuccessRef(data.referenceNumber);
      setIsRecordReceiptOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Submit receipt error:", err);
      setReceiptError(err.message || "Failed to save receipt.");
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  const handleOpenReverseReceipt = (txn: InventoryTransaction) => {
    setReversingTxn(txn);
    setReversalReason("");
    setReversalApprover(user?.name || "Procurement Director");
    setReversalError("");
    setIsReverseReceiptModalOpen(true);
  };

  const handleConfirmReverseReceipt = async () => {
    if (!reversingTxn || !reversalReason.trim() || isSubmittingReversal) return;

    try {
      setIsSubmittingReversal(true);
      setReversalError("");
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);

      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          action: "REVERSE_RECEIPT",
          referenceNumber: reversingTxn.referenceNumber,
          reason: reversalReason.trim(),
          approverName: reversalApprover.trim() || u?.name,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setReversalError(d.error || "Failed to reverse receipt.");
        return;
      }

      setIsReverseReceiptModalOpen(false);
      setReversingTxn(null);
      fetchData();
    } catch (err: any) {
      setReversalError(err.message || "Failed to reverse receipt.");
    } finally {
      setIsSubmittingReversal(false);
    }
  };

  const handleApproveReceipt = async (refNum: string) => {
    try {
      setIsApprovingReceipt(true);
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);

      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          action: "APPROVE_RECEIPT",
          referenceNumber: refNum,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Failed to approve receipt.");
        return;
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to approve receipt.");
    } finally {
      setIsApprovingReceipt(false);
    }
  };

  const handleRejectReceipt = async (refNum: string) => {
    const reason = window.prompt("Please enter the reason for rejecting this stock receipt:");
    if (!reason || !reason.trim()) return;

    try {
      setIsApprovingReceipt(true);
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);

      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          action: "REJECT_RECEIPT",
          referenceNumber: refNum,
          reason: reason.trim(),
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Failed to reject receipt.");
        return;
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to reject receipt.");
    } finally {
      setIsApprovingReceipt(false);
    }
  };

  const handleOpenPrintVoucher = (refNum: string) => {
    const matching = transactions.filter((t) => t.type === "RECEIPT" && t.referenceNumber === refNum);
    if (matching.length > 0) {
      setVoucherReceiptTxns(matching);
      setIsPrintReceiptVoucherOpen(true);
    }
  };

  const handleExportReceiptsCSV = () => {
    const receiptTxns = transactions.filter((t) => t.type === "RECEIPT");
    const headers = ["GRN / REF", "DATE", "STOCK ITEM", "WAREHOUSE", "QTY RECEIVED", "NEW BALANCE", "RECEIVED BY"];
    const rows = receiptTxns.map((t) => [
      `"${t.referenceNumber || ""}"`,
      `"${t.date || ""}"`,
      `"${t.itemName || ""}"`,
      `"${t.storeName || ""}"`,
      `"${t.quantity || 0}"`,
      `"${t.newBalance || 0}"`,
      `"${t.receivedBy?.name || t.requestedBy?.name || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BCF_Stock_Receipts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── STOCK RETURN FEATURE STATE & HELPERS ───
  const BCF_PROGRAMMES = [
    "Girls Primary Education Initiative",
    "Water & Sanitation Hygiene (WASH) Program",
    "Emergency Relief & Food Distribution",
    "Community Health & Nutrition Outreach",
    "Youth Livelihoods & Vocational Training",
    "Climate Resilience & Agriculture Project",
    "BCF Head Office & Field Operations Support",
    "Post-Disaster Rehabilitation Initiative",
  ];

  interface ReturnRowItem {
    id: string;
    itemId: string;
    itemName: string;
    stockCode: string;
    storeId: string;
    storeName: string;
    issueNumber: string;
    qtyIssued: number;
    qtyReturned: number;
    unit: string;
    unitCost: number;
    condition: "Good" | "Damaged";
    remarks: string;
    fixedAssetWarning?: string;
  }

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [returnSuccessRef, setReturnSuccessRef] = useState<string | null>(null);
  const [selectedReturnForView, setSelectedReturnForView] = useState<InventoryTransaction | null>(null);

  const [returnForm, setReturnForm] = useState({
    employeeName: "",
    staffId: "",
    department: "",
    isNonStaff: false,
    contact: "",
    programme: "Girls Primary Education Initiative",
    reason: "Unused",
    reasonDetails: "",
    conditionVerified: "Good" as "Good" | "Damaged" | "Expired" | "Incomplete",
    inventoryUpdated: "Yes" as "Yes" | "No",
    items: [
      {
        id: "ret-row-1",
        itemId: "",
        itemName: "",
        stockCode: "",
        storeId: "",
        storeName: "",
        issueNumber: "",
        qtyIssued: 0,
        qtyReturned: 1,
        unit: "Units",
        unitCost: 0,
        condition: "Good" as "Good" | "Damaged",
        remarks: "",
        fixedAssetWarning: "",
      },
    ],
  });
  const [employeeSearchText, setEmployeeSearchText] = useState("");
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const openReturnModal = () => {
    setReturnForm({
      employeeName: "",
      staffId: "",
      department: "",
      isNonStaff: false,
      contact: "",
      programme: "Girls Primary Education Initiative",
      reason: "Unused",
      reasonDetails: "",
      conditionVerified: "Good",
      inventoryUpdated: "Yes",
      items: [
        {
          id: `ret-row-${Date.now()}-1`,
          itemId: "",
          itemName: "",
          stockCode: "",
          storeId: "",
          storeName: "",
          issueNumber: "",
          qtyIssued: 0,
          qtyReturned: 1,
          unit: "Units",
          unitCost: 0,
          condition: "Good",
          remarks: "",
          fixedAssetWarning: "",
        },
      ],
    });
    setEmployeeSearchText("");
    setIsEmployeeDropdownOpen(false);
    setReturnError("");
    setIsReturnModalOpen(true);
  };

  const getEmployeeIssuedItems = (empName: string) => {
    if (!empName) return [];
    const normalized = empName.toLowerCase().trim();
    const issueTxns = transactions.filter(
      (t) =>
        t.type === "ISSUE" &&
        t.recipient &&
        t.recipient.toLowerCase().trim() === normalized
    );

    return issueTxns
      .map((t) => {
        const returned = t.returnedQuantity || 0;
        const outstanding = Math.max(0, (t.quantity || 0) - returned);
        return {
          issueNumber: t.referenceNumber,
          itemId: t.itemId,
          itemName: t.itemName,
          stockCode: t.stockCode,
          storeId: t.storeId,
          storeName: t.storeName,
          programme: t.programme,
          qtyIssued: outstanding,
          unit: t.unit || "Units",
          unitCost: t.unitCost || 0,
        };
      })
      .filter((iss) => iss.qtyIssued > 0);
  };

  const calculatedHeaderStore = useMemo(() => {
    const selectedStores = returnForm.items
      .map((it) => it.storeName)
      .filter((s) => Boolean(s && s.trim()));
    if (selectedStores.length === 0) return "Auto-filled from selected items";
    const unique = Array.from(new Set(selectedStores));
    if (unique.length === 1) return unique[0];
    return "Multiple stores";
  }, [returnForm.items]);

  const handleCancelReturn = () => {
    const hasData =
      returnForm.employeeName.trim() !== "" ||
      returnForm.contact.trim() !== "" ||
      returnForm.reasonDetails.trim() !== "" ||
      returnForm.items.some((it) => it.itemId !== "");

    if (hasData) {
      if (
        !window.confirm(
          "You have entered return details. Are you sure you want to cancel? Any unsaved changes will be lost."
        )
      ) {
        return;
      }
    }
    setIsReturnModalOpen(false);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError("");

    const returner = returnForm.employeeName.trim();
    if (!returner) {
      setReturnError("Please select or enter Returned By / Employee Name.");
      return;
    }
    if (!returnForm.programme.trim()) {
      setReturnError("Please select a Programme / Project.");
      return;
    }
    if (!returnForm.reason) {
      setReturnError("Please select a Reason for Return.");
      return;
    }
    if (returnForm.reason === "Other" && !returnForm.reasonDetails.trim()) {
      setReturnError("Details are required when 'Other' reason is chosen.");
      return;
    }

    if (returnForm.conditionVerified !== "Good" && returnForm.inventoryUpdated === "Yes") {
      setReturnError("Damaged, expired or incomplete stock cannot be added back to available stock.");
      return;
    }

    if (returnForm.items.length === 0) {
      setReturnError("Please add at least one item to return.");
      return;
    }

    const seenItemIds = new Set<string>();
    for (let i = 0; i < returnForm.items.length; i++) {
      const it = returnForm.items[i];
      if (!it.itemId) {
        setReturnError(`Row ${i + 1}: Please select an item to return.`);
        return;
      }
      if (seenItemIds.has(it.itemId)) {
        setReturnError(
          `The same item cannot be selected twice in the same return (${it.itemName || it.stockCode}).`
        );
        return;
      }
      seenItemIds.add(it.itemId);

      if (it.qtyReturned <= 0) {
        setReturnError(`Row ${i + 1} (${it.itemName}): Quantity returned must be greater than zero.`);
        return;
      }
      if (it.qtyIssued > 0 && it.qtyReturned > it.qtyIssued) {
        setReturnError(
          `Row ${i + 1} (${it.itemName}): Cannot return more than was issued (Max: ${it.qtyIssued}).`
        );
        return;
      }
      if (it.condition === "Damaged" && !it.remarks.trim()) {
        setReturnError(`Row ${i + 1} (${it.itemName}): Remarks are required when condition is Damaged.`);
        return;
      }
    }

    try {
      setIsSubmittingReturn(true);
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          type: "RETURN",
          returnedBy: returner,
          employeeName: returner,
          staffId: returnForm.isNonStaff ? "N/A" : returnForm.staffId,
          isNonStaff: returnForm.isNonStaff,
          contact: returnForm.contact,
          department: returnForm.isNonStaff ? "N/A" : returnForm.department,
          programme: returnForm.programme,
          reason: returnForm.reason,
          reasonDetails: returnForm.reasonDetails,
          conditionVerified: returnForm.conditionVerified,
          inventoryUpdated: returnForm.inventoryUpdated,
          items: returnForm.items.map((it) => ({
            itemId: it.itemId,
            itemName: it.itemName,
            stockCode: it.stockCode,
            storeId: it.storeId,
            storeName: it.storeName,
            issueNumber: it.issueNumber || undefined,
            qtyIssued: it.qtyIssued,
            qtyReturned: Number(it.qtyReturned),
            unit: it.unit,
            unitCost: it.unitCost,
            condition: it.condition,
            remarks: it.remarks,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setReturnError(data.error || "Failed to process stock return.");
        setIsSubmittingReturn(false);
        return;
      }

      if (data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
        setSelectedReturnForView(data.transaction);
        setReturnSuccessRef(data.returnReference || data.transaction.referenceNumber);
      }

      fetchData();
      setIsReturnModalOpen(false);
    } catch (err: any) {
      setReturnError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  useEffect(() => {
    const u = getUser();
    setUser(u);
    const roleCode = normalizeRole(u?.role, u?.username, u?.email);
    // SA and PRC have Full access (Issue vouchers, adjust, transfer, etc.)
    setCanFull(
      roleCode === "SA" ||
        roleCode === "PRC" ||
        !u ||
        (u as any)?.role === "Admin" ||
        (u as any)?.role === "Procurement Director"
    );
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const headers = { "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" };

      // Ensure seed data exists
      await fetch("/api/procurement/seed", { headers }).catch(() => {});

      const [itemsRes, storesRes, txnsRes, dashRes, recipientsRes] = await Promise.all([
        fetch("/api/procurement/inventory/items", { headers }),
        fetch("/api/procurement/inventory/stores", { headers }),
        fetch("/api/procurement/inventory/transactions", { headers }),
        fetch("/api/procurement/inventory/dashboard", { headers }),
        fetch("/api/procurement/inventory/recipients", { headers }),
      ]);

      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setItems(d.items || []);
        if (d.permissions) {
          setCanFull(
            d.permissions.canFull ||
              roleCode === "SA" ||
              roleCode === "PRC"
          );
        }
      }
      if (storesRes.ok) {
        const d = await storesRes.json();
        setStores(d.stores || []);
      }
      if (txnsRes.ok) {
        const d = await txnsRes.json();
        setTransactions(d.transactions || []);
      }
      if (dashRes.ok) {
        const d = await dashRes.json();
        setMetrics(d.metrics || null);
      }
      if (recipientsRes && recipientsRes.ok) {
        const d = await recipientsRes.json();
        setRecipientsDirectory(d.recipients || []);
      }
    } catch (err) {
      console.error("Error loading inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.stockCode.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q);
      const matchesClass = classFilter === "ALL" || it.itemClass === classFilter;
      const matchesStatus = statusFilter === "ALL" || it.status === statusFilter;
      const matchesWh = warehouseFilter === "ALL" || it.warehouseId === warehouseFilter;
      return matchesSearch && matchesClass && matchesStatus && matchesWh;
    });
  }, [items, searchQuery, classFilter, statusFilter, warehouseFilter]);

  // Handle Add Item Submit
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull) return;

    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify(newItem),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to create item.");
        return;
      }

      setIsAddItemOpen(false);
      fetchData();
      alert(`Item "${newItem.name}" added successfully.`);
    } catch (err) {
      alert("Network error creating item.");
    }
  };

  // Open Issue Voucher Modal
  const openIssueModal = (preselectedStoreId?: string, preselectedItemId?: string) => {
    const activeStores = stores.filter((s) => s.status === "Active");
    const targetStore = preselectedStoreId
      ? activeStores.find((s) => s.id === preselectedStoreId)
      : activeStores.length === 1
      ? activeStores[0]
      : null;

    setIssueForm({
      storeId: targetStore?.id || "",
      storeName: targetStore?.storeName || "",
      itemId: preselectedItemId || "",
      itemSearch: "",
      quantityRequested: 1,
      quantity: 1,
      recipient: "",
      location: "",
      department: "Programs Department",
      programme: "Girls Primary Education Initiative",
      donor: "UNICEF Sierra Leone",
      purpose: "Community distribution",
    });
    setRecipientSearch("");
    setIsRecipientDropdownOpen(false);
    setIssueError("");
    setIsIssueModalOpen(true);
  };

  // Handle Stock Issue Submit
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rCode = normalizeRole(user?.role, user?.username, user?.email);
    if (rCode !== "SA" && rCode !== "PRC" && (user as any)?.role !== "Admin") return;

    if (!issueForm.storeId) {
      setIssueError("Please select a Store / Facility.");
      return;
    }
    if (!issueForm.itemId) {
      setIssueError("Please select an inventory item to issue.");
      return;
    }
    if (!issueForm.recipient.trim()) {
      setIssueError("Recipient / Beneficiary is required.");
      return;
    }
    if (!issueForm.location.trim()) {
      setIssueError("Location / Office Address is required.");
      return;
    }
    if (issueForm.quantityRequested <= 0 || issueForm.quantity <= 0) {
      setIssueError("Quantities must be greater than zero.");
      return;
    }
    if (issueForm.quantity > issueForm.quantityRequested) {
      setIssueError("Issue Quantity cannot exceed Qty Requested.");
      return;
    }

    try {
      setIsSubmittingIssue(true);
      setIssueError("");
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          type: "ISSUE",
          storeId: issueForm.storeId,
          storeName: issueForm.storeName,
          itemId: issueForm.itemId,
          quantityRequested: issueForm.quantityRequested,
          quantity: issueForm.quantity,
          recipient: issueForm.recipient.trim(),
          location: issueForm.location.trim(),
          department: issueForm.department,
          programme: issueForm.programme,
          donor: issueForm.donor,
          purpose: issueForm.purpose,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setIssueError(data.error || "Failed to process stock issue voucher.");
        setIsSubmittingIssue(false);
        return;
      }

      setIsIssueModalOpen(false);
      setIsSubmittingIssue(false);
      setConfirmedVoucher(data.transaction || null);
      fetchData();
    } catch (err: any) {
      setIsSubmittingIssue(false);
      setIssueError(err.message || "Network error processing stock issue voucher.");
    }
  };

  // Handle Stock Adjustment Submit
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull) return;

    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          type: "ADJUSTMENT",
          ...adjForm,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to adjust stock.");
        return;
      }

      setIsAdjustmentModalOpen(false);
      fetchData();
      alert("Stock Adjustment approved and logged in audit trail.");
    } catch (err) {
      alert("Network error processing adjustment.");
    }
  };

  // Handle Stock Transfer Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transferForm.itemId) {
      alert("Please select an inventory item to transfer.");
      return;
    }
    if (!transferForm.destStoreId) {
      alert("Please select a destination warehouse.");
      return;
    }
    if (transferForm.sourceStoreId === transferForm.destStoreId) {
      alert("Source and destination warehouses must be different.");
      return;
    }

    const itemToTransfer = items.find((i) => i.id === transferForm.itemId);
    if (!itemToTransfer) {
      alert("Selected item was not found.");
      return;
    }

    if (transferForm.quantity > (itemToTransfer.currentBalance || 0)) {
      alert(
        `Transfer quantity (${transferForm.quantity}) exceeds available stock (${itemToTransfer.currentBalance || 0} ${itemToTransfer.unit}) in the source warehouse.`
      );
      return;
    }

    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const destStore = stores.find((s) => s.id === transferForm.destStoreId);
      const srcStore = stores.find((s) => s.id === transferForm.sourceStoreId);

      const res = await fetch("/api/procurement/inventory/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          type: "TRANSFER",
          itemId: transferForm.itemId,
          quantity: Number(transferForm.quantity),
          sourceStoreId: transferForm.sourceStoreId,
          sourceStoreName: srcStore?.storeName || transferForm.sourceStoreName || "BCF Central Warehouse, Freetown",
          destStoreId: transferForm.destStoreId,
          destStoreName: destStore?.storeName || transferForm.destStoreName,
          referenceNumber:
            transferForm.referenceNumber ||
            `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          reason: transferForm.reason,
          notes: transferForm.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to process transfer.");
        return;
      }

      setIsTransferModalOpen(false);
      await fetchData();
      alert(
        `Stock Transfer completed successfully! ${transferForm.quantity} unit(s) of "${itemToTransfer.name}" transferred from ${srcStore?.storeName || "source warehouse"} to ${destStore?.storeName || "destination warehouse"}.`
      );
    } catch (err) {
      alert("Network error processing transfer.");
    }
  };

  // Handle Create Store Submit
  const handleCreateStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull) return;

    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify(newStore),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to create store.");
        return;
      }

      setIsAddStoreOpen(false);
      setNewStore({
        storeName: "",
        location: "",
        district: "Western Area Urban",
        chiefdom: "Central",
        storekeeper: "",
        contact: "",
        storageType: "Regional Depot",
        capacity: 5000,
        status: "Active",
        securityName: "",
        securityAddress: "",
        securityPhone: "",
        securityAgency: "",
        securitySupervisorName: "",
        securitySupervisorPhone: "",
        securitySupervisorAddress: "",
      });
      fetchData();
      alert(`Store "${newStore.storeName}" created successfully! A notification email has been dispatched to the CEO.`);
    } catch (err) {
      alert("Network error creating store.");
    }
  };

  // Open Edit Store Modal
  const handleOpenEditStore = (s: InventoryStore) => {
    setEditingStore(s);
    setEditStoreForm({
      storeName: s.storeName || "",
      location: s.location || "",
      district: s.district || "Western Area Urban",
      chiefdom: s.chiefdom || "",
      storekeeper: s.storekeeper || "",
      contact: s.contact || "",
      storageType: s.storageType || "Regional Depot",
      capacity: s.capacity || 1000,
      status: (s.status as any) || "Active",
      securityName: s.securityName || "",
      securityAddress: s.securityAddress || "",
      securityPhone: s.securityPhone || "",
      securityAgency: s.securityAgency || "",
      securitySupervisorName: s.securitySupervisorName || "",
      securitySupervisorPhone: s.securitySupervisorPhone || "",
      securitySupervisorAddress: s.securitySupervisorAddress || "",
    });
  };

  // Submit Edit Store
  const handleEditStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull || !editingStore) return;

    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/stores", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          id: editingStore.id,
          ...editStoreForm,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update store.");
        return;
      }

      const d = await res.json();
      const updatedStore: InventoryStore = d.store;

      setStores((prev) =>
        prev.map((s) => (s.id === editingStore.id ? updatedStore : s))
      );
      if (selectedStoreForStock && selectedStoreForStock.id === editingStore.id) {
        setSelectedStoreForStock(updatedStore);
      }
      setEditingStore(null);
      alert(`Store "${updatedStore.storeName}" details updated successfully.`);
    } catch (err) {
      alert("Network error updating store.");
    }
  };

  // Handle Update Store Status (Active, Inactive, Suspended, Closed)
  const handleUpdateStoreStatus = async (
    store: InventoryStore,
    newStatus: "Active" | "Inactive" | "Suspended" | "Closed"
  ) => {
    if (!canFull) {
      alert("Only authorized Procurement Officers or System Administrators can change store status.");
      return;
    }
    if (store.status === newStatus) return;

    if (
      !confirm(
        `Are you sure you want to change the status of "${store.storeName}" to "${newStatus}"? This will alert the CEO via email.`
      )
    ) {
      return;
    }

    try {
      setUpdatingStoreId(store.id);
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/inventory/stores", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify({
          id: store.id,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update store status.");
        return;
      }

      setStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, status: newStatus } : s))
      );
      if (selectedStoreForStock && selectedStoreForStock.id === store.id) {
        setSelectedStoreForStock({ ...selectedStoreForStock, status: newStatus });
      }
      alert(`Store "${store.storeName}" status updated to ${newStatus}. Notification email sent to CEO.`);
    } catch (err) {
      alert("Network error updating status.");
    } finally {
      setUpdatingStoreId(null);
    }
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    if (items.length === 0) return;
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Stock Code,Item Name,Classification,Category,Unit,Current Balance,Unit Cost,Total Value,Warehouse,Status\n";
    items.forEach((it) => {
      csv += `"${it.stockCode}","${(it.name || "").replace(/"/g, '""')}","${it.itemClass}","${it.category}","${it.unit}","${it.currentBalance}","${it.unitCost}","${it.totalValue}","${it.warehouseName || ""}","${it.status}"\n`;
    });
    const uri = encodeURI(csv);
    const link = document.createElement("a");
    link.href = uri;
    link.download = `BCF_SL_Inventory_Stock_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* ─── INTERNAL SUB-SECTION TABS ─── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: "dashboard", label: "Dashboard", icon: "insights" },
            { id: "items", label: "Item Master", icon: "inventory_2" },
            { id: "stores", label: "Stores & Warehouses", icon: "warehouse" },
            { id: "issues", label: "Stock Issues", icon: "outbox" },
            { id: "transfers", label: "Stock Transfers", icon: "sync_alt" },
            { id: "returns", label: "Stock Returns", icon: "assignment_return" },
            { id: "receipts", label: "Stock Receipts", icon: "move_to_inbox" },
            { id: "adjustments", label: "Stock Adjustments", icon: "tune" },
            { id: "counts", label: "Stock Counts", icon: "fact_check" },
            { id: "reorder", label: "Low Stock Alerts", icon: "warning" },
            { id: "expiry", label: "Expiry Tracking", icon: "event_busy" },
            { id: "reports", label: "Reports & Feeds", icon: "summarize" },
          ].map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as SubSection)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── SUB-SECTION: DASHBOARD ─── */}
      {activeSection === "dashboard" && (
        <div className="space-y-6">
          {/* Top KPI Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                Total Stock Items
              </span>
              <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                {metrics?.totalStockItems ?? items.length}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Master catalog items</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                Total Units on Hand
              </span>
              <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {metrics?.totalStockQuantity?.toLocaleString() ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Across 4 regional warehouses</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                Current Inventory Value
              </span>
              <span className="text-3xl font-black text-primary dark:text-blue-400 font-mono">
                NLe {metrics?.totalStockValue ? Number(metrics.totalStockValue).toLocaleString() : "0"}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">FIFO accounting valuation</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                Low / Out of Stock
              </span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-amber-600 font-mono">
                  {metrics?.lowStockItems ?? 0}
                </span>
                <span className="text-xs text-slate-400">Low /</span>
                <span className="text-3xl font-black text-rose-600 font-mono">
                  {metrics?.outOfStockItems ?? 0}
                </span>
                <span className="text-xs text-slate-400">Out</span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">Immediate reorder required</span>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddItemOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add_box</span>
              <span>Register New Item</span>
            </button>
            {canIssue && (
              <button
                type="button"
                onClick={() => openIssueModal()}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">outbox</span>
                <span>Create Issue Voucher</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openTransferModal()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">sync_alt</span>
              <span>Transfer Between Stores</span>
            </button>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>Request Stock Adjustment</span>
              </button>
              {canIssue && (
                <button
                  type="button"
                  onClick={() => openReturnModal()}
                  className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">assignment_return</span>
                  <span>Stock Return</span>
                </button>
              )}
              {canRecordReceipt && (
                <button
                  type="button"
                  onClick={() => openRecordReceiptModal()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">move_to_inbox</span>
                  <span>Stock Receipt</span>
                </button>
              )}
            </div>

          {/* Recent Movement Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">
              Recent Inventory Stock Movements
            </h3>
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Store</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Balance After</th>
                      <th className="py-2.5 px-3">Authorized By</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transactions.slice(0, 8).map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                              txn.type === "RECEIPT"
                                ? "bg-emerald-100 text-emerald-800"
                                : txn.type === "ISSUE"
                                ? "bg-blue-100 text-blue-800"
                                : txn.type === "TRANSFER"
                                ? "bg-purple-100 text-purple-800"
                                : txn.type === "ADJUSTMENT"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {txn.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {txn.referenceNumber}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          {txn.itemName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{txn.storeName}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {txn.quantity}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          {txn.newBalance}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{txn.requestedBy?.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{txn.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── SUB-SECTION: ITEM MASTER ─── */}
      {activeSection === "items" && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search stock code, item name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="ALL">All Classes</option>
                <option value="Consumable">Consumable</option>
                <option value="Programme Material">Programme Material</option>
                <option value="Spare Part">Spare Part</option>
                <option value="Controlled Item">Controlled Item</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="ALL">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                <span>Export CSV</span>
              </button>
              {canFull && (
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>New Item</span>
                </button>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Stock Code</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Current Balance</th>
                  <th className="py-2.5 px-3">Reorder Point</th>
                  <th className="py-2.5 px-3">Unit Cost</th>
                  <th className="py-2.5 px-3">Total Value</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {item.stockCode}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{item.itemClass}</td>
                    <td className="py-2.5 px-3 text-slate-400">{item.unit}</td>
                    <td className="py-2.5 px-3 font-mono font-black text-slate-900 dark:text-white">
                      {item.currentBalance}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{item.reorderLevel}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                      NLe {item.unitCost}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      NLe {item.totalValue?.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          item.status === "In Stock"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "Low Stock"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SUB-SECTION: STORES ─── */}
      {activeSection === "stores" && (
        <div className="space-y-4">
          {/* Sub-section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-2xl">warehouse</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Stores &amp; Warehouses Directory
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {stores.length} Facilities
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any store card to see all items held in that facility. Operational status changes notify the CEO via email.
              </p>
            </div>

            {canFull && (
              <button
                type="button"
                onClick={() => setIsAddStoreOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span>
                <span>Add Store / Warehouse</span>
              </button>
            )}
          </div>

          {/* Stores Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stores.map((s) => {
              const storeItems = items.filter(
                (it) =>
                  it.warehouseId === s.id ||
                  it.warehouseName === s.storeName ||
                  (s.id === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central"))
              );
              const storeTotalUnits = storeItems.reduce((acc, it) => acc + (it.currentBalance || 0), 0);
              const storeTotalValue = storeItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);

              const statusBadgeStyles = {
                Active: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
                Inactive: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
                Suspended: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
                Closed: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
              }[s.status] || "bg-slate-100 text-slate-800 border-slate-300";

              return (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* Clickable Card Body to view items */}
                  <div
                    onClick={() => {
                      setStoreStockSearch("");
                      setSelectedStoreForStock(s);
                    }}
                    className="cursor-pointer"
                    title="Click to view all stock items stored in this warehouse"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {s.id}
                        </span>
                        {/* Explicit VIEW button on warehouse card */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStoreStockSearch("");
                            setSelectedStoreForStock(s);
                          }}
                          title="View all stock items stored in this warehouse"
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[13px]">visibility</span>
                          <span>View</span>
                        </button>
                        {/* Explicit TRANSFER button on warehouse card */}
                        {canFull && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTransferModal(s.id);
                            }}
                            title="Transfer stock out of this warehouse to another facility"
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[13px]">sync_alt</span>
                            <span>Transfer</span>
                          </button>
                        )}
                        {canFull && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditStore(s);
                            }}
                            title="Edit facility details & security info"
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 flex items-center gap-0.5 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[13px]">edit</span>
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadgeStyles}`}>
                        {s.status}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {s.storeName}
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">{s.location}</p>

                    <div className="space-y-1.5 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>District:</span>
                        <strong className="text-slate-800 dark:text-slate-200">{s.district}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Storekeeper:</span>
                        <strong className="text-slate-800 dark:text-slate-200">{s.storekeeper}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Contact:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">{s.contact}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Capacity:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {s.capacity?.toLocaleString()} Units
                        </strong>
                      </div>
                      {(s.securityAgency || s.securityName) && (
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1 text-slate-500">
                            <span className="material-symbols-outlined text-[12px] text-amber-600">shield</span>
                            <span>Security:</span>
                          </span>
                          <strong className="text-slate-800 dark:text-slate-200 truncate max-w-[140px]" title={`${s.securityAgency || s.securityName} (${s.securityPhone || s.securitySupervisorPhone || 'Guarded'})`}>
                            {s.securityAgency || s.securityName}
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 text-emerald-700 dark:text-emerald-400 border-t border-dashed border-slate-200 dark:border-slate-800">
                        <span className="font-semibold">Stock In Facility:</span>
                        <strong className="font-mono font-bold">
                          {storeItems.length} SKUs ({storeTotalUnits.toLocaleString()} units)
                        </strong>
                      </div>
                    </div>

                    {/* View items button banner */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStoreStockSearch("");
                        setSelectedStoreForStock(s);
                      }}
                      className="w-full mt-3 py-1.5 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-bold transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px]">inventory_2</span>
                        <span>View Stock in Store ({storeItems.length} SKUs)</span>
                      </span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>

                  {/* Status Switcher Button Row (Active, Inactive, Suspended, Closed) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Status Control:</span>
                      {updatingStoreId === s.id ? (
                        <span className="text-emerald-600 animate-pulse text-[10px] font-bold">Updating...</span>
                      ) : (
                        <span className="text-slate-400 text-[9px]">(Notifies CEO)</span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["Active", "Inactive", "Suspended", "Closed"] as const).map((st) => {
                        const isCurrent = s.status === st;
                        const btnStyle = {
                          Active: isCurrent
                            ? "bg-emerald-700 text-white font-extrabold shadow-xs ring-1 ring-emerald-700"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
                          Inactive: isCurrent
                            ? "bg-slate-700 text-white font-extrabold shadow-xs ring-1 ring-slate-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-300",
                          Suspended: isCurrent
                            ? "bg-amber-600 text-white font-extrabold shadow-xs ring-1 ring-amber-600"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
                          Closed: isCurrent
                            ? "bg-rose-700 text-white font-extrabold shadow-xs ring-1 ring-rose-700"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
                        }[st];

                        return (
                          <button
                            key={st}
                            type="button"
                            disabled={!canFull || updatingStoreId === s.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStoreStatus(s, st);
                            }}
                            title={
                              !canFull
                                ? "Status changes restricted to Procurement / Admin"
                                : isCurrent
                                ? `Facility is currently ${st}`
                                : `Change status to ${st} and notify CEO`
                            }
                            className={`px-1 py-1 rounded-lg text-[10px] text-center font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${btnStyle}`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── SUB-SECTION: STOCK TRANSFERS (Inter-Warehouse Transfers) ─── */}
      {activeSection === "transfers" && (() => {
        const transferTransactions = transactions.filter((t) => t.type === "TRANSFER");
        const filteredTransfers = transferTransactions.filter((t) => {
          const q = transferSearch.toLowerCase().trim();
          const matchesSearch =
            !q ||
            t.stockCode?.toLowerCase().includes(q) ||
            t.itemName?.toLowerCase().includes(q) ||
            t.referenceNumber?.toLowerCase().includes(q) ||
            t.sourceStoreName?.toLowerCase().includes(q) ||
            t.destStoreName?.toLowerCase().includes(q) ||
            t.reason?.toLowerCase().includes(q);

          const matchesSource =
            transferSourceFilter === "ALL" ||
            t.sourceStoreId === transferSourceFilter ||
            t.storeId === transferSourceFilter;

          const matchesDest =
            transferDestFilter === "ALL" ||
            t.destStoreId === transferDestFilter;

          return matchesSearch && matchesSource && matchesDest;
        });

        const totalTransferUnits = transferTransactions.reduce((acc, t) => acc + (t.quantity || 0), 0);
        const totalTransferValuation = transferTransactions.reduce((acc, t) => acc + (t.totalValue || 0), 0);
        const participatingFacilities = new Set(
          transferTransactions.flatMap((t) => [t.sourceStoreId, t.destStoreId, t.storeId].filter(Boolean))
        ).size;

        return (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">sync_alt</span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Inter-Warehouse Stock Transfers
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {transferTransactions.length} Transfers Logged
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Dispatch and transfer stock between BCF-SL central and regional warehouse facilities with live stock decrement, receiving balances, and waybills.
                </p>
              </div>

              {canFull && (
                <button
                  type="button"
                  onClick={() => openTransferModal()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add_box</span>
                  <span>Initiate Stock Transfer</span>
                </button>
              )}
            </div>

            {/* Transfer KPI Telemetry Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                  Total Transfers
                </span>
                <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                  {transferTransactions.length}
                </span>
                <span className="text-[11px] text-blue-600 block mt-1 font-semibold">
                  Dispatched consignments
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                  Units Transferred
                </span>
                <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {totalTransferUnits.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Rebalanced inventory units
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                  Valuation Dispatched
                </span>
                <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                  NLe {totalTransferValuation.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  FIFO inventory valuation
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                  Connected Depots
                </span>
                <span className="text-3xl font-black text-purple-700 dark:text-purple-400 font-mono">
                  {participatingFacilities}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Active transfer network
                </span>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="relative flex-1 w-full">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search by transfer code, item name, destination, or reason..."
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={transferSourceFilter}
                  onChange={(e) => setTransferSourceFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                >
                  <option value="ALL">All Source Stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      From: {s.storeName}
                    </option>
                  ))}
                </select>

                <select
                  value={transferDestFilter}
                  onChange={(e) => setTransferDestFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                >
                  <option value="ALL">All Destination Stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      To: {s.storeName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transfers Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-lg">local_shipping</span>
                  Transfer History &amp; Dispatch Register ({filteredTransfers.length})
                </h4>
                {canFull && (
                  <button
                    type="button"
                    onClick={() => openTransferModal()}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    <span>New Transfer</span>
                  </button>
                )}
              </div>

              {filteredTransfers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-2 block">
                    sync_alt
                  </span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No stock transfers recorded yet.
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Transfer items from one warehouse to another to automatically rebalance inventory and decrement source balances.
                  </p>
                  {canFull && (
                    <button
                      type="button"
                      onClick={() => openTransferModal()}
                      className="mt-4 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>Initiate First Stock Transfer</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Waybill / Ref</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Stock Item</th>
                        <th className="py-2.5 px-3">Source Store</th>
                        <th className="py-2.5 px-3">Destination Store</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Total Value</th>
                        <th className="py-2.5 px-3">Authorized By</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTransfers.map((txn) => {
                        return (
                          <tr key={txn.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                              {txn.referenceNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                              {txn.date}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {txn.itemName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {txn.stockCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                                {txn.sourceStoreName || txn.storeName || "Central Warehouse"}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {txn.sourceStoreId || txn.storeId}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400 block">
                                &rarr; {txn.destStoreName || txn.destStoreId || "Destination"}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {txn.destStoreId}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                              {txn.quantity} units
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                              NLe {txn.totalValue?.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                              {txn.authorizedBy || txn.requestedBy?.name || "Procurement Officer"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                {txn.status || "Completed"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedTransferForView(txn)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">receipt_long</span>
                                <span>Waybill</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── SUB-SECTION: STOCK RECEIPTS ─── */}
      {activeSection === "receipts" && (() => {
        const receiptTxns = transactions.filter((t) => t.type === "RECEIPT");
        const pendingReceipts = receiptTxns.filter((t) => t.status === "Pending Approval");

        return (
          <div className="space-y-4">
            {/* Success notification banner with Print Voucher link */}
            {receiptSuccessRef && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-emerald-800 dark:text-emerald-200 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-600 text-2xl">check_circle</span>
                  <div>
                    <h4 className="text-sm font-bold">Stock Receipt Recorded Successfully</h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Receipt reference <span className="font-mono font-bold">{receiptSuccessRef}</span> has been saved and inventory balances updated.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPrintVoucher(receiptSuccessRef)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    Print Goods Received Voucher
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptSuccessRef(null)}
                    className="text-emerald-700 hover:text-emerald-900 dark:hover:text-white text-xs font-bold px-2 py-1 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Pending Approvals Short Queue (Local Purchases > limit) */}
            {pendingReceipts.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                    <span className="material-symbols-outlined text-amber-600">hourglass_top</span>
                    Pending Local Purchase Approvals ({pendingReceipts.length})
                  </div>
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    High-value local purchases require dual authorization before stock is added
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingReceipts.map((pt) => {
                    const isOwn = (pt.requestedBy?.name || pt.receivedBy?.name || "").toLowerCase() === (user?.name || "").toLowerCase();
                    return (
                      <div
                        key={pt.id}
                        className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 rounded-xl p-3 shadow-xs space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-800 dark:text-amber-400">{pt.referenceNumber}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                            Pending Approval
                          </span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">{pt.itemName}</div>
                        <div className="text-slate-500 flex justify-between">
                          <span>Qty: +{pt.quantity}</span>
                          <span>Value: NLe {(pt.totalValue || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Recorded by: <span className="font-medium text-slate-700 dark:text-slate-300">{pt.requestedBy?.name || "Officer"}</span>
                        </div>
                        <div className="pt-1 flex items-center justify-end gap-2">
                          {canRecordReceipt && !isOwn && (
                            <>
                              <button
                                type="button"
                                disabled={isApprovingReceipt}
                                onClick={() => handleApproveReceipt(pt.referenceNumber)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isApprovingReceipt}
                                onClick={() => handleRejectReceipt(pt.referenceNumber)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {isOwn && (
                            <span className="text-[11px] italic text-amber-700 dark:text-amber-300">
                              Awaiting 2nd officer approval (You submitted this receipt)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-xl">move_to_inbox</span>
                    Stock Receipts &amp; Goods Inward ({receiptTxns.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Receipts from Goods Received Notes (GRN), local purchases, and humanitarian consignments.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportReceiptsCSV}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Export CSV
                  </button>
                  {canRecordReceipt && (
                    <button
                      type="button"
                      onClick={openRecordReceiptModal}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">add_box</span>
                      Record Stock Receipt
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">GRN / Ref</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Stock Item</th>
                      <th className="py-2.5 px-3">Warehouse</th>
                      <th className="py-2.5 px-3 text-right">Qty Received</th>
                      <th className="py-2.5 px-3 text-right">New Balance</th>
                      <th className="py-2.5 px-3">Received By</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {receiptTxns.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          <div className="flex items-center gap-1.5">
                            <span>{t.referenceNumber}</span>
                            {t.status === "Pending Approval" && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold">
                                Pending
                              </span>
                            )}
                            {t.status === "Reversed" && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 font-bold">
                                Reversed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{t.date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{t.itemName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{t.storeName}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-black ${t.quantity < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                          {t.quantity > 0 ? `+${t.quantity}` : `${t.quantity}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {t.newBalance}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {t.receivedBy?.name
                            ? `${t.receivedBy.name} (${t.receivedBy.role === "PRC" ? "Procurement Director" : t.receivedBy.role === "SA" ? "Super Administrator" : t.receivedBy.role || "Officer"})`
                            : t.requestedBy?.name || "Storekeeper"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              title="Print Goods Received Voucher"
                              onClick={() => handleOpenPrintVoucher(t.referenceNumber)}
                              className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-base">print</span>
                            </button>
                            {canRecordReceipt && t.status === "Completed" && (
                              <button
                                type="button"
                                title="Reverse Receipt"
                                onClick={() => handleOpenReverseReceipt(t)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-base">undo</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {receiptTxns.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          No stock receipts recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── SUB-SECTION: STOCK ISSUES ─── */}
      {activeSection === "issues" && (() => {
        const issueTxns = transactions.filter((t) => t.type === "ISSUE");
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-xl">outbox</span>
                  Stock Issues &amp; Distribution ({issueTxns.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Materials issued to projects, departments, and community beneficiaries with strict stock decrement rules.
                </p>
              </div>
              {canIssue && (
                <button
                  type="button"
                  onClick={() => openIssueModal()}
                  className="px-3.5 py-2 rounded-xl bg-primary hover:bg-blue-800 text-white text-xs font-bold cursor-pointer"
                >
                  Issue Stock to Programme
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Issue Ref</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Stock Item</th>
                    <th className="py-2.5 px-3">Programme / Dept</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3 text-right">Qty Issued</th>
                    <th className="py-2.5 px-3 text-right">Remaining Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {issueTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{t.referenceNumber}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{t.date}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{t.itemName}</td>
                      <td className="py-2.5 px-3 text-slate-500">{t.programme || t.department}</td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{t.recipient || "Beneficiary"}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600">-{t.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">{t.newBalance}</td>
                    </tr>
                  ))}
                  {issueTxns.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No stock issues recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─── SUB-SECTION: STOCK RETURNS ─── */}
      {activeSection === "returns" && (() => {
        const returnTxns = transactions.filter((t) => t.type === "RETURN");
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-600 text-xl">assignment_return</span>
                  Stock Returns &amp; Restitutions ({returnTxns.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Unused materials returned from completed projects, staff, and field activities back into facility custody.
                </p>
              </div>
              {canIssue && (
                <button
                  type="button"
                  onClick={() => openReturnModal()}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">assignment_return</span>
                  <span>Stock Return</span>
                </button>
              )}
              {canRecordReceipt && (
                <button
                  type="button"
                  onClick={() => openRecordReceiptModal()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">move_to_inbox</span>
                  <span>Stock Receipt</span>
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Return Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Programme/Project</th>
                    <th className="py-2.5 px-3">Store</th>
                    <th className="py-2.5 px-3 text-center">Items</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Received By</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnTxns.map((t) => {
                    const itemCount = t.returnItems && t.returnItems.length > 0 ? t.returnItems.length : 1;
                    const recBy = typeof t.receivedBy === "object" ? t.receivedBy?.name : (t.receivedBy || "Alie Kamara");
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-purple-700 dark:text-purple-400">
                          {t.referenceNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {t.date}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          <div>{t.employeeName || t.recipient || "N/A"}</div>
                          {t.staffId && t.staffId !== "N/A" && (
                            <span className="text-[10px] font-mono text-slate-400 font-normal">{t.staffId}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {t.department || "N/A"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {t.programme || "N/A"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                          {t.storeName}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold text-[11px]">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-900 dark:text-white">{t.reason || "Unused"}</span>
                          {t.reasonDetails && (
                            <span className="block text-[10px] text-slate-400 truncate max-w-[150px]">{t.reasonDetails}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {recBy}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {t.status || "Completed"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedReturnForView(t)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-800 dark:hover:bg-purple-950/60 text-slate-700 hover:text-purple-700 dark:text-slate-300 dark:hover:text-purple-300 text-[11px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">print</span>
                            <span>View / Print</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {returnTxns.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-slate-400">
                        No stock returns recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─── SUB-SECTION: STOCK ADJUSTMENTS ─── */}
      {activeSection === "adjustments" && (() => {
        const adjTxns = transactions.filter((t) => t.type === "ADJUSTMENT");
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-xl">tune</span>
                  Stock Adjustments Ledger (Dual Authorization) ({adjTxns.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Mandatory dual-authorization write-offs and ledger corrections for damages, theft, and counting discrepancies.
                </p>
              </div>
              {canFull && (
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                >
                  Request Dual Adjustment
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Adjustment Ref</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Stock Item</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Adjustment Qty</th>
                    <th className="py-2.5 px-3">Requested By</th>
                    <th className="py-2.5 px-3">Approved By</th>
                    <th className="py-2.5 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adjTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{t.referenceNumber}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{t.date}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{t.itemName}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          {t.adjustmentType || "Correction"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">-{t.quantity}</td>
                      <td className="py-2.5 px-3 text-slate-500">{t.requestedBy?.name}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{t.approvedBy?.name || "Director"}</td>
                      <td className="py-2.5 px-3 text-slate-500">{t.reason}</td>
                    </tr>
                  ))}
                  {adjTxns.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No stock adjustments logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─── SUB-SECTION: STOCK COUNTS ─── */}
      {activeSection === "counts" && (() => {
        const countTxns = transactions.filter((t) => t.type === "STOCK_COUNT");
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-xl">fact_check</span>
              Physical Stock Count &amp; Reconciliation Audits ({countTxns.length})
            </h3>
            <p className="text-xs text-slate-500">
              Cyclic count logs and end-of-quarter physical audit variance reconciliations.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Count Ref</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Stock Item</th>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3 text-right">Physical Counted Balance</th>
                    <th className="py-2.5 px-3">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {countTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{t.referenceNumber}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{t.date}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{t.itemName}</td>
                      <td className="py-2.5 px-3 text-slate-500">{t.storeName}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">{t.newBalance}</td>
                      <td className="py-2.5 px-3 text-slate-500">{t.authorizedBy || "Internal Auditor"}</td>
                    </tr>
                  ))}
                  {countTxns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No physical stock count audits recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      {activeSection === "reorder" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Low Stock &amp; Reorder Telemetry
              </h3>
              <p className="text-xs text-slate-500">
                Items currently at or below mandatory safety reorder levels requiring Procurement action.
              </p>
            </div>
            {canFull && (
              <button
                type="button"
                onClick={() => alert("Reorder batch requisition transmitted to Procurement Director.")}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                Generate Purchase Requisitions
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Stock Code</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Current Stock</th>
                  <th className="py-2.5 px-3">Reorder Point</th>
                  <th className="py-2.5 px-3">Recommended Reorder Qty</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items
                  .filter((it) => it.currentBalance <= it.reorderLevel)
                  .map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{it.stockCode}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{it.name}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-rose-600">
                        {it.currentBalance} {it.unit}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{it.reorderLevel}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        +{it.reorderQuantity}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                          {it.currentBalance === 0 ? "OUT OF STOCK" : "LOW STOCK"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SUB-SECTION: EXPIRY TRACKING ─── */}
      {activeSection === "expiry" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Perishables &amp; Expiry Countdown Monitor
          </h3>
          <p className="text-xs text-slate-500">
            Medical kits, food supplies, and chemicals monitored within the 60-day warning period.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Stock Code</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Stock Quantity</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items
                  .filter((it) => it.expiryDate)
                  .map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-purple-700">{it.stockCode}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{it.name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{it.warehouseName}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{it.expiryDate}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{it.currentBalance}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                          Active Monitoring
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SUB-SECTION: REPORTS & FEEDS ─── */}
      {activeSection === "reports" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                Programme Materials Report
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Materials issued &amp; distributed to registered project beneficiaries in targeted districts.
              </p>
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Download Programme Stock Report
              </button>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                Donor &amp; Grant-Funded Inventory
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Full audit trace of grant-funded consignments received and field balances remaining.
              </p>
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Download Donor Stock Audit
              </button>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1">
                Finance Stock Valuation Ledger
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Comprehensive FIFO stock valuation ledger feed connecting to Finance Director reporting.
              </p>
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Export Valuation Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD INVENTORY ITEM (Only for Full users) ─── */}
      {isAddItemOpen && canFull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Register New Inventory Item Master
              </h3>
              <button
                type="button"
                onClick={() => setIsAddItemOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Stock Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BCF-ICT-0001"
                    value={newItem.stockCode}
                    onChange={(e) => setNewItem({ ...newItem, stockCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Item Class *
                  </label>
                  <select
                    value={newItem.itemClass}
                    onChange={(e) => setNewItem({ ...newItem, itemClass: e.target.value as ItemClass })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="Consumable">Consumable</option>
                    <option value="Programme Material">Programme Material</option>
                    <option value="Spare Part">Spare Part</option>
                    <option value="Controlled Item">Controlled Item</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Student School Bags with Stationery"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    value={newItem.currentBalance}
                    onChange={(e) => setNewItem({ ...newItem, currentBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Unit Cost (NLe)
                  </label>
                  <input
                    type="number"
                    value={newItem.unitCost}
                    onChange={(e) => setNewItem({ ...newItem, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Reorder Point
                  </label>
                  <input
                    type="number"
                    value={newItem.reorderLevel}
                    onChange={(e) => setNewItem({ ...newItem, reorderLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Warehouse
                  </label>
                  <select
                    value={newItem.warehouseId}
                    onChange={(e) => {
                      const sel = stores.find((s) => s.id === e.target.value);
                      setNewItem({
                        ...newItem,
                        warehouseId: e.target.value,
                        warehouseName: sel?.storeName || "",
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.storeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold cursor-pointer"
                >
                  Register Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: UPGRADED STOCK ISSUE VOUCHER (Only for SA and PRC) ─── */}
      {isIssueModalOpen && canIssue && (() => {
        const activeStores = stores.filter((s) => s.status === "Active");
        const selectedStore = stores.find((s) => s.id === issueForm.storeId);

        // Exclude items classed as Fixed Asset
        const nonFixedAssetItems = items.filter((it) => it.itemClass !== "Fixed Asset");

        // Items matching the selected store
        const storeStockItems = nonFixedAssetItems.filter(
          (it) =>
            it.warehouseId === issueForm.storeId ||
            it.warehouseName === selectedStore?.storeName ||
            (issueForm.storeId === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central"))
        );

        // Search query within items
        const itemQ = issueForm.itemSearch.toLowerCase().trim();
        const filteredStoreItems = storeStockItems.filter(
          (it) => !itemQ || it.name.toLowerCase().includes(itemQ) || it.stockCode.toLowerCase().includes(itemQ)
        );

        // Master items not in this facility
        const otherItems = nonFixedAssetItems.filter(
          (it) =>
            it.warehouseId !== issueForm.storeId &&
            it.warehouseName !== selectedStore?.storeName &&
            !(issueForm.storeId === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central")) &&
            (!itemQ || it.name.toLowerCase().includes(itemQ) || it.stockCode.toLowerCase().includes(itemQ))
        );

        // Fixed Asset detection in search query
        const hasFixedAssetSearchMatch =
          itemQ.length >= 2 &&
          items.some(
            (it) =>
              it.itemClass === "Fixed Asset" &&
              (it.name.toLowerCase().includes(itemQ) || it.stockCode.toLowerCase().includes(itemQ))
          );

        // Selected item object
        const selectedItem = items.find((it) => it.id === issueForm.itemId);
        const isItemInSelectedStore = selectedItem
          ? selectedItem.warehouseId === issueForm.storeId ||
            selectedItem.warehouseName === selectedStore?.storeName ||
            (issueForm.storeId === "BCF-STORE-001" && (!selectedItem.warehouseId || selectedItem.warehouseId === "Central"))
          : false;

        const currentStoreBalance = selectedItem && isItemInSelectedStore ? (selectedItem.currentBalance || 0) : 0;
        const itemUnit = selectedItem?.unit || "Units";

        // Availability Calculation (Section 5)
        type AvailStatus = "NONE" | "AVAILABLE" | "INSUFFICIENT" | "OUT_OF_STOCK" | "NOT_IN_STORE";
        let availStatus: AvailStatus = "NONE";
        let availMessage = "";
        let availBadgeClass = "";

        if (issueForm.storeId && issueForm.itemId && selectedItem) {
          if (!isItemInSelectedStore) {
            availStatus = "NOT_IN_STORE";
            availMessage = `Item is not available in ${selectedStore?.storeName || issueForm.storeId}`;
            availBadgeClass = "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
          } else if (currentStoreBalance === 0) {
            availStatus = "OUT_OF_STOCK";
            availMessage = `Out of stock in ${selectedStore?.storeName || issueForm.storeId}`;
            availBadgeClass = "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
          } else if (currentStoreBalance < (issueForm.quantity || 0)) {
            availStatus = "INSUFFICIENT";
            availMessage = `Only ${currentStoreBalance} ${itemUnit} available in ${selectedStore?.storeName || issueForm.storeId}`;
            availBadgeClass = "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
          } else {
            availStatus = "AVAILABLE";
            availMessage = `Available in ${selectedStore?.storeName || issueForm.storeId}: ${currentStoreBalance} ${itemUnit}`;
            availBadgeClass = "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
          }
        }

        // Section 6 validation rules
        const isAvailable = availStatus === "AVAILABLE";
        const exceedsRequested = (issueForm.quantity || 0) > (issueForm.quantityRequested || 0);
        const isQtyValid =
          (issueForm.quantity || 0) > 0 &&
          (issueForm.quantityRequested || 0) > 0 &&
          !exceedsRequested &&
          (issueForm.quantity || 0) <= currentStoreBalance;

        const isFormValid = Boolean(
          issueForm.storeId &&
          issueForm.itemId &&
          isAvailable &&
          isQtyValid &&
          issueForm.recipient.trim() &&
          issueForm.location.trim()
        );

        let disabledReason = "";
        if (!issueForm.storeId) disabledReason = "Select Store / Facility first";
        else if (!issueForm.itemId) disabledReason = "Select an inventory item";
        else if (availStatus === "NOT_IN_STORE") disabledReason = "Cannot confirm: item is not available in this store";
        else if (availStatus === "OUT_OF_STOCK") disabledReason = "Cannot confirm: item is out of stock in this store";
        else if (availStatus === "INSUFFICIENT") disabledReason = `Cannot confirm: only ${currentStoreBalance} ${itemUnit} available in ${selectedStore?.storeName || "store"}`;
        else if (exceedsRequested) disabledReason = "Cannot confirm: Issue Quantity cannot exceed Qty Requested";
        else if (!issueForm.recipient.trim()) disabledReason = "Recipient / Beneficiary is required";
        else if (!issueForm.location.trim()) disabledReason = "Location / Office Address is required";

        const isPartial = (issueForm.quantity || 0) < (issueForm.quantityRequested || 0);
        const remainingPending = Math.max(0, (issueForm.quantityRequested || 0) - (issueForm.quantity || 0));

        // Authenticated Session Staff Label for Section 7
        const loggedInStaffLabel = user
          ? `${user.name || "Alie Kamara"}, ${user.role || (currentRoleCode === "PRC" ? "Procurement Director" : "Super Administrator")}`
          : "Alie Kamara, Procurement Director";

        // Filtered recipients
        const rSearch = (recipientSearch || issueForm.recipient).toLowerCase().trim();
        const matchingRecipients = recipientsDirectory.filter((r) => {
          if (!rSearch) return true;
          return (
            r.name.toLowerCase().includes(rSearch) ||
            r.department.toLowerCase().includes(rSearch) ||
            r.location.toLowerCase().includes(rSearch)
          );
        }).slice(0, 5);

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300">
                    <span className="material-symbols-outlined text-xl">outbox</span>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Process Stock Issue Voucher
                    </h3>
                    <p className="text-xs text-slate-500">
                      Issue verified store items to authorised recipients with real-time balance reconciliation
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {issueError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{issueError}</span>
                </div>
              )}

              <form onSubmit={handleIssueSubmit} className="space-y-3.5 text-xs">
                {/* 1. Store / Facility Name * */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Store / Facility Name *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {activeStores.length} active stores available
                    </span>
                  </div>
                  <select
                    required
                    value={issueForm.storeId}
                    onChange={(e) => {
                      const newStoreId = e.target.value;
                      const st = stores.find((s) => s.id === newStoreId);
                      setIssueForm({
                        ...issueForm,
                        storeId: newStoreId,
                        storeName: st?.storeName || "",
                        itemId: "",
                        itemSearch: "",
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs"
                  >
                    <option value="">Select Store / Facility...</option>
                    {activeStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.storeName} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Item * (Filtered by selected store) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Select Item *
                    </label>
                    {issueForm.storeId && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {storeStockItems.length} items catalogued in {selectedStore?.storeName || issueForm.storeId}
                      </span>
                    )}
                  </div>

                  {/* Searchable filter input */}
                  {issueForm.storeId && (
                    <div className="relative mb-1.5">
                      <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-xs">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Type to filter items by code or name..."
                        value={issueForm.itemSearch}
                        onChange={(e) => setIssueForm({ ...issueForm, itemSearch: e.target.value })}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs placeholder:text-slate-400"
                      />
                    </div>
                  )}

                  {/* Fixed Asset Warning Banner */}
                  {hasFixedAssetSearchMatch && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">info</span>
                      <span className="font-bold">This is a fixed asset. Use Asset Management &gt; Assignment.</span>
                    </div>
                  )}

                  <select
                    required
                    disabled={!issueForm.storeId}
                    value={issueForm.itemId}
                    onChange={(e) => {
                      const newItId = e.target.value;
                      setIssueForm({
                        ...issueForm,
                        itemId: newItId,
                      });
                    }}
                    className={`w-full px-3 py-2 border rounded-xl font-bold text-xs ${
                      !issueForm.storeId
                        ? "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    }`}
                  >
                    <option value="">
                      {!issueForm.storeId
                        ? "Select Store / Facility first..."
                        : "-- Select Item --"}
                    </option>

                    {issueForm.storeId && (
                      <>
                        {/* Group: Items available in this store */}
                        {filteredStoreItems.length > 0 && (
                          <optgroup label={`In ${selectedStore?.storeName || issueForm.storeId} (${filteredStoreItems.length})`}>
                            {filteredStoreItems.map((it) => {
                              const bal = it.currentBalance || 0;
                              const isZero = bal === 0;
                              return (
                                <option
                                  key={it.id}
                                  value={it.id}
                                  disabled={isZero}
                                  className={isZero ? "text-slate-400 dark:text-slate-500 italic" : "font-bold text-slate-900 dark:text-white"}
                                >
                                  {it.stockCode} — {it.name} {isZero ? "(Out of stock)" : `(Available: ${bal} ${it.unit})`}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}

                        {/* Group: Items not in this store */}
                        {otherItems.length > 0 && (
                          <optgroup label="Other Master Items (Not In This Facility)">
                            {otherItems.map((it) => (
                              <option
                                key={it.id}
                                value={it.id}
                                disabled
                                className="text-slate-400 dark:text-slate-500 italic"
                              >
                                {it.stockCode} — {it.name} (Not in this store)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    )}
                  </select>
                </div>

                {/* 3. Item Availability Status (Automatic Read-only Badge) */}
                {availStatus !== "NONE" && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${availBadgeClass}`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">
                        {availStatus === "AVAILABLE"
                          ? "check_circle"
                          : availStatus === "INSUFFICIENT"
                          ? "warning"
                          : "cancel"}
                      </span>
                      <span>{availMessage}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/30">
                      {availStatus === "AVAILABLE"
                        ? "Available"
                        : availStatus === "INSUFFICIENT"
                        ? "Insufficient"
                        : availStatus === "OUT_OF_STOCK"
                        ? "Out of Stock"
                        : "Not in Store"}
                    </span>
                  </div>
                )}

                {/* 4 & 5. Qty Requested * and Issue Quantity * (Side-by-side desktop, single column phone) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Qty Requested * {selectedItem && <span className="font-normal text-slate-400">({itemUnit})</span>}
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={issueForm.quantityRequested}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        setIssueForm({
                          ...issueForm,
                          quantityRequested: val,
                          quantity: issueForm.quantity > val ? val : issueForm.quantity,
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Issue Quantity * {selectedItem && <span className="font-normal text-slate-400">({itemUnit})</span>}
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={issueForm.quantityRequested}
                      value={issueForm.quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        setIssueForm({
                          ...issueForm,
                          quantity: val,
                        });
                      }}
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-xs font-bold ${
                        exceedsRequested
                          ? "border-rose-500 text-rose-600"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                    />
                    {exceedsRequested && (
                      <span className="text-[10px] text-rose-600 font-bold block mt-1">
                        Issue Quantity cannot exceed Qty Requested ({issueForm.quantityRequested})
                      </span>
                    )}
                    {isPartial && !exceedsRequested && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-1">
                        Partial issue: remaining {remainingPending} {itemUnit} will remain pending.
                      </span>
                    )}
                    {/* Quick Helper buttons */}
                    {currentStoreBalance > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIssueForm({ ...issueForm, quantity: issueForm.quantityRequested })}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Match Requested ({issueForm.quantityRequested})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setIssueForm({
                              ...issueForm,
                              quantity: Math.min(issueForm.quantityRequested, currentStoreBalance),
                            })
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 text-blue-700 dark:text-blue-300 cursor-pointer"
                        >
                          Max Avail ({Math.min(issueForm.quantityRequested, currentStoreBalance)})
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6 & 7. Recipient / Beneficiary * and Location / Office Address * (Side-by-side desktop, single column phone) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                  <div className="relative">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Recipient / Beneficiary *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alimamy Bangura / Kenema School District"
                      value={issueForm.recipient}
                      onFocus={() => setIsRecipientDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIssueForm({ ...issueForm, recipient: val });
                        setRecipientSearch(val);
                        setIsRecipientDropdownOpen(true);
                      }}
                      onBlur={() => {
                        // Apply proper case and trim
                        setTimeout(() => {
                          setIsRecipientDropdownOpen(false);
                          const trimmed = issueForm.recipient.trim();
                          const proper = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
                          if (proper !== issueForm.recipient) {
                            setIssueForm((prev) => ({ ...prev, recipient: proper }));
                          }
                        }, 200);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    />

                    {/* Auto-suggest dropdown from staff directory & beneficiaries */}
                    {isRecipientDropdownOpen && matchingRecipients.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {matchingRecipients.map((rec, idx) => (
                          <div
                            key={rec.id || idx}
                            onMouseDown={() => {
                              setIssueForm({
                                ...issueForm,
                                recipient: rec.name,
                                location: rec.location || issueForm.location,
                                department: rec.department || issueForm.department,
                              });
                              setIsRecipientDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 dark:text-white text-xs">{rec.name}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rec.type === "Staff" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                                {rec.type}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {rec.title} &bull; {rec.location}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Location / Office Address *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kenema District Office / Head Office"
                      value={issueForm.location}
                      onChange={(e) => setIssueForm({ ...issueForm, location: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* 8. Issued By (Automatic, read-only) */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Issued By
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-bold">
                    <span className="material-symbols-outlined text-sm text-slate-400">lock</span>
                    <span>{loggedInStaffLabel}</span>
                    <span className="text-[10px] text-slate-400 font-normal ml-auto">
                      Authenticated Session (Server Verified)
                    </span>
                  </div>
                </div>

                {/* Optional Workflow Fields (Collapsible) */}
                <div className="pt-1">
                  <details className="group rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-xs">
                    <summary className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer list-none flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs">tune</span>
                        <span>Additional Workflow Details (Purpose, Programme, Donor)</span>
                      </span>
                      <span className="material-symbols-outlined text-xs group-open:rotate-180 transition-transform">
                        expand_more
                      </span>
                    </summary>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                          Issue Purpose
                        </label>
                        <input
                          type="text"
                          value={issueForm.purpose}
                          onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                          Department
                        </label>
                        <input
                          type="text"
                          value={issueForm.department}
                          onChange={(e) => setIssueForm({ ...issueForm, department: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                          Programme / Project
                        </label>
                        <input
                          type="text"
                          value={issueForm.programme}
                          onChange={(e) => setIssueForm({ ...issueForm, programme: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                          Donor / Grant
                        </label>
                        <input
                          type="text"
                          value={issueForm.donor}
                          onChange={(e) => setIssueForm({ ...issueForm, donor: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </details>
                </div>

                {/* Modal Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">
                    {!isFormValid && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">info</span>
                        {disabledReason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsIssueModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isFormValid || isSubmittingIssue}
                      title={!isFormValid ? disabledReason : "Confirm stock issue voucher"}
                      className={`px-4 py-2 rounded-xl text-white font-extrabold flex items-center gap-1.5 transition-all ${
                        isFormValid && !isSubmittingIssue
                          ? "bg-primary hover:bg-blue-800 shadow-md cursor-pointer"
                          : "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      {isSubmittingIssue ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Confirm Issue</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL: ISSUE VOUCHER CONFIRMATION & PRINT ─── */}
      {confirmedVoucher && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 my-8">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 mx-auto mb-2">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Stock Issue Voucher Confirmed
              </h3>
              <p className="text-xs text-slate-500">
                Ledger inventory balance deducted and official issue voucher registered.
              </p>
            </div>

            {/* Voucher Slip Details */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Issue Voucher Number:</span>
                <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-extrabold">
                  {confirmedVoucher.referenceNumber}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{confirmedVoucher.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Store / Facility:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{confirmedVoucher.storeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Stock Item:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  [{confirmedVoucher.stockCode}] {confirmedVoucher.itemName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity Issued:</span>
                <strong className="font-mono text-slate-900 dark:text-white font-bold">
                  {confirmedVoucher.quantity} {confirmedVoucher.unit || "Units"}
                </strong>
              </div>
              {confirmedVoucher.isPartial && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>Partial Issue Status:</span>
                  <span className="font-bold">
                    Pending: {confirmedVoucher.remainingQuantity} {confirmedVoucher.unit || "Units"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Remaining Store Balance:</span>
                <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  {confirmedVoucher.newBalance} {confirmedVoucher.unit || "Units"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient / Beneficiary:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{confirmedVoucher.recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location / Office:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{confirmedVoucher.location}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-500">Issued By:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {confirmedVoucher.issuedBy?.name} ({confirmedVoucher.issuedBy?.title || confirmedVoucher.issuedBy?.role})
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-200"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Print Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmedVoucher(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: STOCK ADJUSTMENT (Dual Authorization Required) ─── */}
      {isAdjustmentModalOpen && canFull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
              Stock Adjustment (Dual Authorization)
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Requester and approver must be different users. Creates mandatory audit trail record.
            </p>

            <form onSubmit={handleAdjustmentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Item to Adjust *
                </label>
                <select
                  required
                  value={adjForm.itemId}
                  onChange={(e) => setAdjForm({ ...adjForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">Select item...</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.stockCode} — {it.name} (Balance: {it.currentBalance})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Adjustment Type *
                  </label>
                  <select
                    value={adjForm.adjustmentType}
                    onChange={(e) => setAdjForm({ ...adjForm, adjustmentType: e.target.value as AdjustmentType })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Damage">Damage</option>
                    <option value="Loss">Loss</option>
                    <option value="Theft">Theft</option>
                    <option value="Expired">Expired</option>
                    <option value="Counting Error">Counting Error</option>
                    <option value="Returned Stock">Returned Stock</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={adjForm.quantity}
                    onChange={(e) => setAdjForm({ ...adjForm, quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Requested By (User 1) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Requester Name"
                    value={adjForm.requestedByName || user?.name || ""}
                    onChange={(e) => setAdjForm({ ...adjForm, requestedByName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Approved By (User 2 - Different) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Approver Director Name"
                    value={adjForm.approvedByName}
                    onChange={(e) => setAdjForm({ ...adjForm, approvedByName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason &amp; Justification *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Justification note for audit trail record..."
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-extrabold cursor-pointer"
                >
                  Approve Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: TRANSFER STOCK BETWEEN WAREHOUSES ─── */}
      {isTransferModalOpen && (() => {
        const srcStore = stores.find((s) => s.id === transferForm.sourceStoreId);
        const sourceItems = items.filter(
          (it) =>
            (it.warehouseId === transferForm.sourceStoreId ||
              it.warehouseName === srcStore?.storeName ||
              (transferForm.sourceStoreId === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central"))) &&
            (it.currentBalance || 0) > 0
        );

        const otherItems = items.filter(
          (it) =>
            !sourceItems.some((si) => si.id === it.id) &&
            (it.currentBalance || 0) > 0
        );

        const allAvailableItems = sourceItems.length > 0 ? [...sourceItems, ...otherItems] : items;
        const selectedItemObj =
          items.find((it) => it.id === transferForm.itemId) ||
          sourceItems[0] ||
          allAvailableItems[0] ||
          null;
        const availableBalance = selectedItemObj?.currentBalance || 0;
        const totalEstimatedValue = (transferForm.quantity || 0) * (selectedItemObj?.unitCost || 0);
        const destStores = stores.filter((s) => s.id !== transferForm.sourceStoreId);

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">sync_alt</span>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Inter-Warehouse Stock Transfer
                    </h3>
                    <p className="text-xs text-slate-500">
                      Transfer stock items between BCF-SL store facilities with automated ledger balance reconciliation
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
                {/* 1. Choose Stock From (Source Warehouse) */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Choose Stock From (Source Warehouse) *
                  </label>
                  <select
                    required
                    value={transferForm.sourceStoreId}
                    onChange={(e) => {
                      const newSrc = e.target.value;
                      const nextDest = stores.find((s) => s.id !== newSrc);
                      const newSrcStore = stores.find((s) => s.id === newSrc);
                      const newAvailable = items.filter(
                        (it) =>
                          (it.warehouseId === newSrc ||
                            it.warehouseName === newSrcStore?.storeName ||
                            (newSrc === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central"))) &&
                          (it.currentBalance || 0) > 0
                      );
                      setTransferForm({
                        ...transferForm,
                        sourceStoreId: newSrc,
                        sourceStoreName: newSrcStore?.storeName || "",
                        destStoreId: nextDest?.id || "",
                        destStoreName: nextDest?.storeName || "",
                        itemId: newAvailable[0]?.id || transferForm.itemId,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} — {s.storeName} ({s.location})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Choose Item to Transfer */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Select Item to Transfer *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {sourceItems.length > 0
                        ? `${sourceItems.length} items in origin facility`
                        : "Select from master stock"}
                    </span>
                  </div>

                  <select
                    required
                    value={transferForm.itemId}
                    onChange={(e) => {
                      const newItId = e.target.value;
                      setTransferForm({
                        ...transferForm,
                        itemId: newItId,
                        quantity: 1,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-xs"
                  >
                    <option value="">-- Choose Stock Item to Transfer --</option>
                    {sourceItems.length > 0 && (
                      <optgroup label={`Available in ${srcStore?.storeName || transferForm.sourceStoreId} (${sourceItems.length})`}>
                        {sourceItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            [{it.stockCode}] {it.name} (Balance: {it.currentBalance} {it.unit} &bull; NLe {it.unitCost}/unit)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherItems.length > 0 && (
                      <optgroup label="Other Available Master Stock Items">
                        {otherItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            [{it.stockCode}] {it.name} (Balance: {it.currentBalance} {it.unit} &bull; {it.warehouseName || "Central"})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {sourceItems.length === 0 && otherItems.length === 0 && (
                      <optgroup label="All Inventory SKUs">
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            [{it.stockCode}] {it.name} (Balance: {it.currentBalance} {it.unit})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Item Details Info Banner */}
                {selectedItemObj && (
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Available Stock for Transfer:</span>
                      <strong className="text-blue-800 dark:text-blue-300 font-mono font-bold text-xs">
                        {availableBalance} {selectedItemObj.unit}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unit Valuation &amp; Class:</span>
                      <strong className="text-slate-700 dark:text-slate-300 font-mono">
                        NLe {selectedItemObj.unitCost} &bull; {selectedItemObj.itemClass}
                      </strong>
                    </div>
                  </div>
                )}

                {/* 3. Choose Stock To (Destination Warehouse) */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Choose Stock To (Destination Warehouse) *
                  </label>
                  <select
                    required
                    value={transferForm.destStoreId}
                    onChange={(e) => {
                      const ds = stores.find((s) => s.id === e.target.value);
                      setTransferForm({
                        ...transferForm,
                        destStoreId: e.target.value,
                        destStoreName: ds?.storeName || "",
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="">-- Select Destination Facility --</option>
                    {destStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} — {s.storeName} ({s.location})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Quantity & Reference */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Quantity to Transfer *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={availableBalance || 1}
                      value={transferForm.quantity}
                      onChange={(e) =>
                        setTransferForm({
                          ...transferForm,
                          quantity: parseFloat(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-bold"
                    />
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {[1, 5, 10, 25].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() =>
                            setTransferForm({
                              ...transferForm,
                              quantity: Math.min(q, Math.max(1, availableBalance)),
                            })
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          +{q}
                        </button>
                      ))}
                      {availableBalance > 0 && (
                        <button
                          key="all"
                          type="button"
                          onClick={() => setTransferForm({ ...transferForm, quantity: availableBalance })}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 text-blue-700 dark:text-blue-300 cursor-pointer"
                        >
                          All ({availableBalance})
                        </button>
                      )}
                    </div>
                    {selectedItemObj && transferForm.quantity > availableBalance && (
                      <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                        Exceeds available stock ({availableBalance})
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Waybill / Voucher #
                    </label>
                    <input
                      type="text"
                      value={transferForm.referenceNumber}
                      onChange={(e) => setTransferForm({ ...transferForm, referenceNumber: e.target.value })}
                      placeholder="TRF-2026-..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                {/* 5. Transfer Reason */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Transfer Reason &amp; Authorization Justification *
                  </label>
                  <select
                    value={transferForm.reason}
                    onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Inter-district stock rebalancing">Inter-district stock rebalancing</option>
                    <option value="Emergency humanitarian relief dispatch">Emergency humanitarian relief dispatch</option>
                    <option value="Central depot replenishment">Central depot replenishment</option>
                    <option value="Regional prepositioning for upcoming programme">Regional prepositioning for upcoming programme</option>
                    <option value="Facility consolidation">Facility consolidation</option>
                    <option value="Defective / repair transfer to central workshop">Defective / repair transfer to central workshop</option>
                  </select>
                </div>

                {/* 6. Transport / Driver notes */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Transport &amp; Vehicle Dispatch Details (Optional)
                  </label>
                  <input
                    type="text"
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                    placeholder="e.g. BCF Vehicle SL-041; Driver: Mohamed Sesay; ETA: 4 hours"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                {/* Summary Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Transfer Route:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {srcStore?.storeName || transferForm.sourceStoreId} &rarr; {stores.find((s) => s.id === transferForm.destStoreId)?.storeName || transferForm.destStoreId || "Destination"}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Valuation in Transit:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                      NLe {totalEstimatedValue.toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedItemObj || transferForm.quantity > availableBalance || !transferForm.destStoreId}
                    className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-extrabold cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    <span>Confirm &amp; Dispatch Transfer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL: VIEW WAYBILL / DISPATCH VOUCHER ─── */}
      {selectedTransferForView && (() => {
        const t = selectedTransferForView;
        const originStore = stores.find((s) => s.id === (t.sourceStoreId || t.storeId));
        const destinationStore = stores.find((s) => s.id === t.destStoreId);

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 my-8">
              {/* Official Waybill Header */}
              <div className="border-b-2 border-slate-900 dark:border-white pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black tracking-wider text-slate-900 dark:text-white uppercase">
                      Bandama Charity Foundation (BCF-SL)
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold">
                      Procurement &amp; Logistics Directorate &bull; Inter-Facility Stock Transfer Waybill
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTransferForView(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Waybill Voucher #</span>
                    <strong className="font-mono text-sm text-blue-700 dark:text-blue-400">{t.referenceNumber}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Date of Dispatch</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">{t.date}</strong>
                  </div>
                </div>
              </div>

              {/* Facility Route Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Originating Store (Dispatching)
                  </span>
                  <strong className="text-slate-900 dark:text-white block font-bold text-sm">
                    {t.sourceStoreName || originStore?.storeName || "Central Warehouse"}
                  </strong>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Location: {originStore?.location || "Freetown Central"}, {originStore?.district || "Western Area"}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Storekeeper: {originStore?.storekeeper || "Duty Storekeeper"} ({originStore?.contact || "N/A"})
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-600 block mb-1">
                    Receiving Facility (Destination)
                  </span>
                  <strong className="text-emerald-700 dark:text-emerald-400 block font-bold text-sm">
                    {t.destStoreName || destinationStore?.storeName || t.destStoreId}
                  </strong>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Location: {destinationStore?.location || "Regional Depot"}, {destinationStore?.district || "Provinces"}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Receiving Storekeeper: {destinationStore?.storekeeper || "Designated Storekeeper"} ({destinationStore?.contact || "N/A"})
                  </p>
                </div>
              </div>

              {/* Consignment Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-extrabold">
                    <tr>
                      <th className="py-2.5 px-3">Stock SKU</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Value</th>
                      <th className="py-2.5 px-3 text-right">Total Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">{t.stockCode}</td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-900 dark:text-white block">{t.itemName}</strong>
                        <span className="text-slate-400 text-[10px]">{t.reason || "Inter-facility stock transfer"}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        {t.quantity} units
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        NLe {t.unitCost?.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        NLe {t.totalValue?.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Dual Verification & Signoff Boxes */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] mb-4">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">1. Dispatched By</span>
                  <strong className="text-slate-800 dark:text-slate-200 block mt-0.5">{t.requestedBy?.name || "Warehouse Officer"}</strong>
                  <span className="text-slate-400 text-[10px]">Verified &amp; Inspected</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">2. Authorized By</span>
                  <strong className="text-slate-800 dark:text-slate-200 block mt-0.5">{t.authorizedBy || "Procurement Director"}</strong>
                  <span className="text-emerald-600 text-[10px] font-bold">&check; System Validated</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">3. Status</span>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mt-0.5">
                    {t.status || "Completed"}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono">
                  Ref ID: {t.id}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">print</span>
                    <span>Print Waybill Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTransferForView(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL: PROCESS STOCK RETURN (DESKTOP MODAL / MOBILE FULL-SCREEN) ─── */}
      {isReturnModalOpen && canIssue && (() => {
        const todayIso = new Date().toISOString().split("T")[0];
        const staffList = recipientsDirectory.filter((r) => r.type === "Staff");
        const activeStaff =
          staffList.length > 0
            ? staffList
            : [
                { id: "BCF-EMP-001", name: "Alie Kamara", department: "Procurement Directorate", type: "Staff" },
                { id: "BCF-EMP-002", name: "Mariama Bangura", department: "Programs Directorate", type: "Staff" },
                { id: "BCF-EMP-003", name: "Mohamed Sesay", department: "Finance & Accounts", type: "Staff" },
                { id: "BCF-EMP-004", name: "Fatmata Conteh", department: "Human Resources", type: "Staff" },
                { id: "BCF-EMP-005", name: "Sorie Ibrahim Koroma", department: "Logistics & Transport", type: "Staff" },
                { id: "BCF-EMP-006", name: "Kadiatu Turay", department: "Education & Field Operations", type: "Staff" },
                { id: "BCF-EMP-007", name: "Ibrahim Mansaray", department: "Health & Nutrition Unit", type: "Staff" },
              ];

        const employeeIssued = getEmployeeIssuedItems(returnForm.employeeName);
        const masterItems = items.filter((it) => it.itemClass !== "Fixed Asset");
        const fixedAssets = items.filter((it) => it.itemClass === "Fixed Asset");

        // Filtered staff for searchable dropdown
        const filteredStaff = activeStaff.filter((s) => {
          if (!employeeSearchText) return true;
          const q = employeeSearchText.toLowerCase();
          return (
            s.name.toLowerCase().includes(q) ||
            (s.id && s.id.toLowerCase().includes(q)) ||
            (s.department && s.department.toLowerCase().includes(q))
          );
        });

        // Validation calculations
        const hasExceededQty = returnForm.items.some(
          (it) => it.qtyIssued > 0 && it.qtyReturned > it.qtyIssued
        );
        const hasInvalidQty = returnForm.items.some((it) => it.qtyReturned <= 0);
        const hasMissingItem = returnForm.items.some((it) => !it.itemId);
        const hasMissingDamagedRemarks = returnForm.items.some(
          (it) => it.condition === "Damaged" && !it.remarks.trim()
        );
        const isConditionInvalid =
          returnForm.conditionVerified !== "Good" && returnForm.inventoryUpdated === "Yes";
        const isOtherWithoutDetails =
          returnForm.reason === "Other" && !returnForm.reasonDetails.trim();
        const isFormValid =
          returnForm.employeeName.trim() !== "" &&
          returnForm.programme.trim() !== "" &&
          !hasMissingItem &&
          !hasExceededQty &&
          !hasInvalidQty &&
          !hasMissingDamagedRemarks &&
          !isConditionInvalid &&
          !isOtherWithoutDetails;

        const loggedInUserLabel = user?.name || "Alie Kamara";
        const loggedInPosition =
          user?.role || (currentRoleCode === "PRC" ? "Procurement Director" : "Super Administrator");

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 sm:rounded-2xl w-full max-w-5xl min-h-screen sm:min-h-0 sm:max-h-[92vh] shadow-2xl p-4 sm:p-6 my-0 sm:my-8 flex flex-col">
              {/* Form Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-300">
                    <span className="material-symbols-outlined text-2xl">assignment_return</span>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Stock Return Voucher
                    </h3>
                    <p className="text-xs text-slate-500">
                      Record restitution of issued inventory materials into warehouse custody
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelReturn}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleReturnSubmit} className="space-y-6 overflow-y-auto pr-1 flex-1">
                {/* Header Automatic Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1">Return Date</span>
                    <input
                      type="text"
                      readOnly
                      value={todayIso}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1">
                      Stock Return Reference (Auto-Generated)
                    </span>
                    <input
                      type="text"
                      readOnly
                      value="Auto-generated (BCF-RET-YYYY-NNNNNN)"
                      className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-purple-700 dark:text-purple-300 font-bold cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* SECTION 1: Return Information */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">badge</span>
                      <span>Section 1: Return Information</span>
                    </h4>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={returnForm.isNonStaff}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setReturnForm((prev) => ({
                            ...prev,
                            isNonStaff: checked,
                            employeeName: checked ? "" : prev.employeeName,
                            staffId: checked ? "N/A" : "",
                            department: checked ? "N/A" : "",
                            contact: "",
                          }));
                          setEmployeeSearchText("");
                        }}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>Non-staff / Other (Beneficiary / Partner)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {/* Returned By */}
                    {!returnForm.isNonStaff ? (
                      <div className="relative">
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Returned By / Employee Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={employeeSearchText || returnForm.employeeName}
                          onChange={(e) => {
                            setEmployeeSearchText(e.target.value);
                            setIsEmployeeDropdownOpen(true);
                          }}
                          onFocus={() => setIsEmployeeDropdownOpen(true)}
                          placeholder="Search active staff directory..."
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                        />
                        {isEmployeeDropdownOpen && filteredStaff.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredStaff.map((staff) => (
                              <div
                                key={staff.id}
                                onMouseDown={() => {
                                  // Find prior issue to prefill programme
                                  const priorIssue = transactions.find(
                                    (t) =>
                                      t.type === "ISSUE" &&
                                      t.recipient &&
                                      t.recipient.toLowerCase().trim() === staff.name.toLowerCase().trim()
                                  );
                                  setReturnForm((prev) => ({
                                    ...prev,
                                    employeeName: staff.name,
                                    staffId: staff.id || "N/A",
                                    department: staff.department || "BCF Operations",
                                    programme: priorIssue?.programme || prev.programme,
                                  }));
                                  setEmployeeSearchText(staff.name);
                                  setIsEmployeeDropdownOpen(false);
                                }}
                                className="p-2.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                                    {staff.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                                    {staff.id}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{staff.department}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Non-Staff / Partner Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={returnForm.employeeName}
                            onChange={(e) => setReturnForm({ ...returnForm, employeeName: e.target.value })}
                            placeholder="Name of returning beneficiary or entity..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Contact Phone / Address *
                          </label>
                          <input
                            type="text"
                            required
                            value={returnForm.contact}
                            onChange={(e) => setReturnForm({ ...returnForm, contact: e.target.value })}
                            placeholder="+232 ... / Location"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                          />
                        </div>
                      </>
                    )}

                    {/* Staff ID */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Staff ID (Read-only)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={returnForm.isNonStaff ? "N/A" : returnForm.staffId || "Select staff member"}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-600 dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>

                    {/* Department / Unit */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Department / Unit (Read-only)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={returnForm.isNonStaff ? "N/A" : returnForm.department || "Auto-filled on employee select"}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>

                    {/* Programme / Project */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Programme / Project *
                      </label>
                      <select
                        required
                        value={returnForm.programme}
                        onChange={(e) => setReturnForm({ ...returnForm, programme: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                      >
                        {BCF_PROGRAMMES.map((prog) => (
                          <option key={prog} value={prog}>
                            {prog}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Header Store / Facility Name */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Store / Facility Name * (Read-only)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={calculatedHeaderStore}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>

                    {/* Reason for Return */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Reason for Return *
                      </label>
                      <select
                        required
                        value={returnForm.reason}
                        onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                      >
                        <option value="Unused">Unused</option>
                        <option value="Excess">Excess</option>
                        <option value="Project ended">Project ended</option>
                        <option value="Wrong item">Wrong item</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Expired">Expired</option>
                        <option value="Rejected by recipient">Rejected by recipient</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Reason details */}
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Reason Details {returnForm.reason === "Other" ? "*" : "(Optional)"}
                      </label>
                      <input
                        type="text"
                        required={returnForm.reason === "Other"}
                        value={returnForm.reasonDetails}
                        onChange={(e) => setReturnForm({ ...returnForm, reasonDetails: e.target.value })}
                        placeholder={
                          returnForm.reason === "Other"
                            ? "Please specify details for 'Other' return reason..."
                            : "Additional context on return justification..."
                        }
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl ${
                          returnForm.reason === "Other" && !returnForm.reasonDetails.trim()
                            ? "border-amber-400 bg-amber-50/20"
                            : "border-slate-300 dark:border-slate-700"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Stock Details (Multiple Items Table) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                      <span>Section 2: Stock Details ({returnForm.items.length} {returnForm.items.length === 1 ? "item" : "items"})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        if (returnForm.items.length >= 25) {
                          alert("Maximum of 25 items allowed per return voucher.");
                          return;
                        }
                        setReturnForm((prev) => ({
                          ...prev,
                          items: [
                            ...prev.items,
                            {
                              id: `ret-row-${Date.now()}-${prev.items.length + 1}`,
                              itemId: "",
                              itemName: "",
                              stockCode: "",
                              storeId: "",
                              storeName: "",
                              issueNumber: "",
                              qtyIssued: 0,
                              qtyReturned: 1,
                              unit: "Units",
                              unitCost: 0,
                              condition: "Good",
                              remarks: "",
                              fixedAssetWarning: "",
                            },
                          ],
                        }));
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>+ Add More Items</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-extrabold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-2 text-center w-8">No.</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Item Description *</th>
                          <th className="py-2.5 px-3 min-w-[90px]">Stock Code</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Store</th>
                          <th className="py-2.5 px-2 text-center min-w-[70px]">Qty Issued</th>
                          <th className="py-2.5 px-2 min-w-[90px]">Qty Returned *</th>
                          <th className="py-2.5 px-2 min-w-[95px]">Condition *</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Remarks</th>
                          <th className="py-2.5 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {returnForm.items.map((row, rIdx) => {
                          const isDamaged = row.condition === "Damaged";
                          const isQtyTooHigh = row.qtyIssued > 0 && row.qtyReturned > row.qtyIssued;
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2 px-2 text-center font-mono font-bold text-slate-400">
                                {rIdx + 1}
                              </td>

                              {/* Item Description dropdown */}
                              <td className="py-2 px-3">
                                <select
                                  required
                                  value={
                                    row.issueNumber
                                      ? `ISSUE_${row.issueNumber}_${row.itemId}`
                                      : row.itemId
                                      ? `ITEM_${row.itemId}`
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) {
                                      setReturnForm((prev) => ({
                                        ...prev,
                                        items: prev.items.map((it, idx) =>
                                          idx === rIdx
                                            ? {
                                                ...it,
                                                itemId: "",
                                                itemName: "",
                                                stockCode: "",
                                                storeId: "",
                                                storeName: "",
                                                issueNumber: "",
                                                qtyIssued: 0,
                                                qtyReturned: 1,
                                                fixedAssetWarning: "",
                                              }
                                            : it
                                        ),
                                      }));
                                      return;
                                    }

                                    // Check duplicate item
                                    let targetItemId = "";
                                    if (val.startsWith("ISSUE_")) {
                                      const parts = val.split("_");
                                      targetItemId = parts.slice(2).join("_");
                                    } else if (val.startsWith("ITEM_")) {
                                      targetItemId = val.replace("ITEM_", "");
                                    }

                                    const isDuplicate = returnForm.items.some(
                                      (it, idx) => idx !== rIdx && it.itemId === targetItemId
                                    );
                                    if (isDuplicate) {
                                      alert(
                                        "The same item cannot be selected twice in the same return. Please select a different item or increase quantity on the existing row."
                                      );
                                      return;
                                    }

                                    if (val.startsWith("ISSUE_")) {
                                      const parts = val.split("_");
                                      const issNum = parts[1];
                                      const itId = parts.slice(2).join("_");
                                      const matchedIss = employeeIssued.find(
                                        (i) => i.issueNumber === issNum && i.itemId === itId
                                      );
                                      if (matchedIss) {
                                        setReturnForm((prev) => ({
                                          ...prev,
                                          programme: matchedIss.programme || prev.programme,
                                          items: prev.items.map((it, idx) =>
                                            idx === rIdx
                                              ? {
                                                  ...it,
                                                  itemId: matchedIss.itemId,
                                                  itemName: matchedIss.itemName,
                                                  stockCode: matchedIss.stockCode,
                                                  storeId: matchedIss.storeId,
                                                  storeName: matchedIss.storeName,
                                                  issueNumber: matchedIss.issueNumber,
                                                  qtyIssued: matchedIss.qtyIssued,
                                                  qtyReturned: Math.min(1, matchedIss.qtyIssued),
                                                  unit: matchedIss.unit,
                                                  unitCost: matchedIss.unitCost,
                                                  fixedAssetWarning: "",
                                                }
                                              : it
                                          ),
                                        }));
                                      }
                                    } else if (val.startsWith("ITEM_")) {
                                      const itId = val.replace("ITEM_", "");
                                      const matchedIt = items.find((i) => i.id === itId);
                                      if (matchedIt) {
                                        setReturnForm((prev) => ({
                                          ...prev,
                                          items: prev.items.map((it, idx) =>
                                            idx === rIdx
                                              ? {
                                                  ...it,
                                                  itemId: matchedIt.id,
                                                  itemName: matchedIt.name,
                                                  stockCode: matchedIt.stockCode,
                                                  storeId: matchedIt.warehouseId || stores[0]?.id || "BCF-STORE-001",
                                                  storeName:
                                                    matchedIt.warehouseName ||
                                                    stores[0]?.storeName ||
                                                    "BCF Central Warehouse, Freetown",
                                                  issueNumber: "",
                                                  qtyIssued: matchedIt.currentBalance || 100,
                                                  qtyReturned: 1,
                                                  unit: matchedIt.unit,
                                                  unitCost: matchedIt.unitCost,
                                                  fixedAssetWarning: "",
                                                }
                                              : it
                                          ),
                                        }));
                                      }
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                                >
                                  <option value="">-- Choose Returned Item --</option>
                                  {employeeIssued.length > 0 && (
                                    <optgroup label={`Issued to ${returnForm.employeeName || "Employee"} (First Priority)`}>
                                      {employeeIssued.map((iss) => (
                                        <option
                                          key={`${iss.issueNumber}_${iss.itemId}`}
                                          value={`ISSUE_${iss.issueNumber}_${iss.itemId}`}
                                        >
                                          [{iss.issueNumber}] {iss.itemName} (Issued: {iss.qtyIssued} {iss.unit})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="General Item Master (In Store)">
                                    {masterItems.map((it) => (
                                      <option key={it.id} value={`ITEM_${it.id}`}>
                                        {it.name} ({it.stockCode}) &bull; Stock: {it.currentBalance} {it.unit}
                                      </option>
                                    ))}
                                  </optgroup>
                                  {fixedAssets.length > 0 && (
                                    <optgroup label="Fixed Assets (Excluded — Return via Asset Management)">
                                      {fixedAssets.map((fa) => (
                                        <option key={fa.id} value={`ASSET_${fa.id}`} disabled>
                                          {fa.name} ({fa.stockCode}) — Fixed Asset (Use Asset Management &gt; Assignment)
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                                {row.issueNumber && (
                                  <div className="flex items-center gap-1 mt-1 text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                                    <span className="material-symbols-outlined text-[12px]">link</span>
                                    <span>Voucher: {row.issueNumber}</span>
                                  </div>
                                )}
                                {row.fixedAssetWarning && (
                                  <span className="text-[10px] text-rose-600 font-bold block mt-1">
                                    {row.fixedAssetWarning}
                                  </span>
                                )}
                              </td>

                              {/* Stock Code */}
                              <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                {row.stockCode || "—"}
                              </td>

                              {/* Store */}
                              <td className="py-2 px-3">
                                {row.issueNumber ? (
                                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate block max-w-[140px]" title={row.storeName}>
                                    {row.storeName || "—"}
                                  </span>
                                ) : row.itemId ? (
                                  <select
                                    value={row.storeId}
                                    onChange={(e) => {
                                      const st = stores.find((s) => s.id === e.target.value);
                                      setReturnForm((prev) => ({
                                        ...prev,
                                        items: prev.items.map((it, idx) =>
                                          idx === rIdx
                                            ? {
                                                ...it,
                                                storeId: e.target.value,
                                                storeName: st?.storeName || it.storeName,
                                              }
                                            : it
                                        ),
                                      }));
                                    }}
                                    className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px]"
                                  >
                                    {stores.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.storeName}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* Qty Issued */}
                              <td className="py-2 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                                {row.qtyIssued > 0 ? row.qtyIssued : "—"}
                              </td>

                              {/* Qty Returned */}
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  required
                                  min="1"
                                  max={row.qtyIssued > 0 ? row.qtyIssued : undefined}
                                  value={row.qtyReturned}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setReturnForm((prev) => ({
                                      ...prev,
                                      items: prev.items.map((it, idx) =>
                                        idx === rIdx ? { ...it, qtyReturned: val } : it
                                      ),
                                    }));
                                  }}
                                  className={`w-full px-2 py-1 bg-white dark:bg-slate-800 border rounded-lg font-mono font-bold text-center text-xs ${
                                    isQtyTooHigh
                                      ? "border-rose-500 text-rose-600 bg-rose-50/40"
                                      : "border-slate-300 dark:border-slate-700"
                                  }`}
                                />
                                {isQtyTooHigh && (
                                  <span className="text-[9px] text-rose-600 font-bold block mt-0.5 leading-tight">
                                    Cannot return more than was issued
                                  </span>
                                )}
                              </td>

                              {/* Condition */}
                              <td className="py-2 px-2">
                                <select
                                  value={row.condition}
                                  onChange={(e) => {
                                    const cond = e.target.value as "Good" | "Damaged";
                                    setReturnForm((prev) => ({
                                      ...prev,
                                      items: prev.items.map((it, idx) =>
                                        idx === rIdx ? { ...it, condition: cond } : it
                                      ),
                                    }));
                                  }}
                                  className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-xs"
                                >
                                  <option value="Good">Good</option>
                                  <option value="Damaged">Damaged</option>
                                </select>
                              </td>

                              {/* Remarks */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  required={isDamaged}
                                  value={row.remarks}
                                  onChange={(e) => {
                                    const rem = e.target.value;
                                    setReturnForm((prev) => ({
                                      ...prev,
                                      items: prev.items.map((it, idx) =>
                                        idx === rIdx ? { ...it, remarks: rem } : it
                                      ),
                                    }));
                                  }}
                                  placeholder={isDamaged ? "Remarks required *" : "Optional..."}
                                  className={`w-full px-2 py-1 bg-white dark:bg-slate-800 border rounded-lg text-xs ${
                                    isDamaged && !row.remarks.trim()
                                      ? "border-amber-400 bg-amber-50/30"
                                      : "border-slate-300 dark:border-slate-700"
                                  }`}
                                />
                              </td>

                              {/* Action: Remove */}
                              <td className="py-2 px-2 text-center">
                                {rIdx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReturnForm((prev) => ({
                                        ...prev,
                                        items: prev.items.filter((_, idx) => idx !== rIdx),
                                      }));
                                    }}
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                    title="Remove this item row"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 3: Store/Warehouse Verification */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>Section 3: Store / Warehouse Verification</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {/* Received By */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Received By * (Session User)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={loggedInUserLabel}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>

                    {/* Position */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Position / Role (Read-only)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={loggedInPosition}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>

                    {/* Date Received */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Date Received (Read-only)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={todayIso}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-600 dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>

                    {/* Condition Verified */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Condition Verified *
                      </label>
                      <select
                        required
                        value={returnForm.conditionVerified}
                        onChange={(e) => {
                          const cond = e.target.value as "Good" | "Damaged" | "Expired" | "Incomplete";
                          setReturnForm((prev) => ({
                            ...prev,
                            conditionVerified: cond,
                            inventoryUpdated: cond === "Good" ? "Yes" : "No",
                          }));
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                      >
                        <option value="Good">Good</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Expired">Expired</option>
                        <option value="Incomplete">Incomplete</option>
                      </select>
                    </div>

                    {/* Inventory Updated */}
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Inventory Updated *
                      </label>
                      <select
                        required
                        value={returnForm.inventoryUpdated}
                        onChange={(e) => {
                          const val = e.target.value as "Yes" | "No";
                          if (val === "Yes" && returnForm.conditionVerified !== "Good") {
                            alert("Damaged, expired or incomplete stock cannot be added back to available stock.");
                            return;
                          }
                          setReturnForm((prev) => ({ ...prev, inventoryUpdated: val }));
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                      {returnForm.conditionVerified !== "Good" && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-1">
                          Non-usable items go to store quarantine &amp; create pending stock adjustment.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Errors */}
                {returnError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{returnError}</span>
                  </div>
                )}

                {/* Form Footer Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={handleCancelReturn}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isFormValid || isSubmittingReturn}
                    className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white font-extrabold text-xs cursor-pointer shadow-md flex items-center gap-1.5 transition-all"
                  >
                    {isSubmittingReturn ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                        <span>Recording Return...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>Save Return</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL: PRINT RETURN VOUCHER (A4 LAYOUT) ─── */}
      {selectedReturnForView && (() => {
        const ret = selectedReturnForView;
        const itemsList =
          ret.returnItems && ret.returnItems.length > 0
            ? ret.returnItems
            : [
                {
                  itemIndex: 1,
                  itemId: ret.itemId,
                  itemName: ret.itemName,
                  stockCode: ret.stockCode,
                  storeId: ret.storeId,
                  storeName: ret.storeName,
                  issueNumber: ret.originalIssueNumber,
                  qtyIssued: ret.quantity,
                  qtyReturned: ret.quantity,
                  unit: ret.unit || "Units",
                  unitCost: ret.unitCost || 0,
                  totalValue: ret.totalValue || 0,
                  condition: (ret.condition as any) || "Good",
                  remarks: ret.remarks || "",
                  inventoryUpdated: ret.inventoryUpdated === "Yes",
                },
              ];

        const recBy =
          typeof ret.receivedBy === "object"
            ? ret.receivedBy?.name
            : (ret.receivedBy || "Alie Kamara");
        const recPos =
          typeof ret.receivedBy === "object"
            ? ret.receivedBy?.position || "Procurement Director"
            : "Procurement Director";

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white text-slate-900 border-0 sm:border border-slate-300 sm:rounded-2xl w-full max-w-4xl min-h-screen sm:min-h-0 sm:max-h-[92vh] shadow-2xl p-6 sm:p-8 my-0 sm:my-8 flex flex-col print:shadow-none print:border-none print:m-0 print:p-0">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">
                      Bandama Charity Foundation (BCF-SL)
                    </h2>
                    <p className="text-xs font-bold text-slate-600">
                      Procurement &amp; Logistics Directorate &bull; Inventory Custody Management
                    </p>
                    <p className="text-[11px] text-slate-500">
                      24 Regent Road, Hill Station, Freetown, Sierra Leone
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-purple-100 text-purple-900 font-mono font-black text-sm rounded-lg border border-purple-200">
                      {ret.referenceNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 block mt-1">
                      Return Date: <strong className="text-slate-800">{ret.date}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Title Banner */}
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 mb-4 text-center">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                  Official Stock Return Voucher &amp; Restitution Slip
                </h3>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-4">
                <div>
                  <span className="text-slate-500 font-semibold block">Returned By:</span>
                  <strong className="text-slate-900 font-bold">{ret.employeeName || ret.recipient || "N/A"}</strong>
                  {ret.contact && <span className="block text-[11px] text-slate-500">{ret.contact}</span>}
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Staff ID:</span>
                  <strong className="text-slate-900 font-mono">{ret.staffId || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Department / Unit:</span>
                  <strong className="text-slate-900">{ret.department || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Programme / Project:</span>
                  <strong className="text-slate-900">{ret.programme || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Store / Facility:</span>
                  <strong className="text-slate-900">{ret.storeName || "Central Store"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Return Reason:</span>
                  <strong className="text-slate-900">
                    {ret.reason || "Unused"}
                    {ret.reasonDetails ? ` (${ret.reasonDetails})` : ""}
                  </strong>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-slate-300 rounded-xl mb-4 flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">No.</th>
                      <th className="py-2 px-3">Stock Code</th>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-3">Store</th>
                      <th className="py-2 px-3">Orig. Issue #</th>
                      <th className="py-2 px-2 text-center">Qty Issued</th>
                      <th className="py-2 px-2 text-center">Qty Returned</th>
                      <th className="py-2 px-2 text-center">Condition</th>
                      <th className="py-2 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemsList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-2 text-center font-mono font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {item.stockCode}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {item.itemName}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {item.storeName}
                        </td>
                        <td className="py-2 px-3 font-mono text-purple-700">
                          {item.issueNumber || "—"}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-600">
                          {item.qtyIssued || "—"}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-purple-800">
                          {item.qtyReturned} {item.unit || "Units"}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.condition === "Good"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {item.condition}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {item.remarks || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warehouse Verification Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs mb-6">
                <div>
                  <span className="text-slate-500 block">Received By:</span>
                  <strong className="text-slate-900">{recBy}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Position / Role:</span>
                  <strong className="text-slate-900">{recPos}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Condition Verified:</span>
                  <strong className="text-purple-900 font-bold">
                    {ret.conditionVerified || "Good"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Inventory Updated:</span>
                  <strong className="text-purple-900 font-bold">
                    {ret.inventoryUpdated || "Yes"}
                  </strong>
                </div>
              </div>

              {/* Signatures Section (3 Columns) */}
              <div className="grid grid-cols-3 gap-6 pt-4 border-t-2 border-slate-300 text-xs mt-auto">
                <div>
                  <span className="font-bold text-slate-700 block mb-8 uppercase text-[10px]">
                    1. Returned By / Officer
                  </span>
                  <div className="border-b border-slate-400 pb-1 mb-1 font-signature text-sm">
                    {ret.employeeName || ret.recipient}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Name: {ret.employeeName || ret.recipient}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Date: {ret.date}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-8 uppercase text-[10px]">
                    2. Received By / Storekeeper
                  </span>
                  <div className="border-b border-slate-400 pb-1 mb-1 font-signature text-sm">
                    {recBy}
                  </div>
                  <span className="text-[10px] text-slate-500 block">Name: {recBy}</span>
                  <span className="text-[10px] text-slate-500 block">
                    Date: {ret.dateReceived || ret.date}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-8 uppercase text-[10px]">
                    3. Authorized / Head of Procurement
                  </span>
                  <div className="border-b border-slate-400 pb-1 mb-1 font-signature text-sm">
                    Alie Kamara
                  </div>
                  <span className="text-[10px] text-slate-500 block">Name: Alie Kamara</span>
                  <span className="text-[10px] text-slate-500 block">
                    Date: {ret.dateReceived || ret.date}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 mt-4 border-t border-slate-200 print:hidden shrink-0">
                <span className="text-xs font-mono text-slate-400">
                  Official Electronic Restitution Voucher &bull; BCF-SL Procurement Hub
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    <span>Print Return Voucher (A4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReturnForView(null);
                      setReturnSuccessRef(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {selectedItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-700">{selectedItem.stockCode}</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  {selectedItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <p className="text-slate-500 leading-relaxed">{selectedItem.description}</p>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                <div>Classification: <strong>{selectedItem.itemClass}</strong></div>
                <div>Category: <strong>{selectedItem.category}</strong></div>
                <div>Current Balance: <strong className="font-mono text-emerald-700">{selectedItem.currentBalance} {selectedItem.unit}</strong></div>
                <div>Reorder Point: <strong className="font-mono">{selectedItem.reorderLevel}</strong></div>
                <div>Unit Cost: <strong className="font-mono">NLe {selectedItem.unitCost}</strong></div>
                <div>Total Value: <strong className="font-mono">NLe {selectedItem.totalValue?.toLocaleString()}</strong></div>
                <div>Warehouse: <strong>{selectedItem.warehouseName || "Central Warehouse"}</strong></div>
                <div>Status: <strong className="text-emerald-700">{selectedItem.status}</strong></div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: RECORD STOCK RECEIPT (DESKTOP MODAL / MOBILE FULL-SCREEN) ─── */}
      {isRecordReceiptOpen && canRecordReceipt && (() => {
        const todayIso = new Date().toISOString().split("T")[0];
        const activeStores = stores.filter((s) => s.status === "Active" || s.status === "active");
        const availableItems = items.filter((it) => it.itemClass !== "Fixed Asset" && !it.isFixedAsset);
        const fixedAssetItems = items.filter((it) => it.itemClass === "Fixed Asset" || it.isFixedAsset);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 sm:rounded-2xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl shadow-2xl flex flex-col my-0 sm:my-6 overflow-hidden animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-2xl">move_to_inbox</span>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Record Stock Receipt &amp; Goods Inward
                    </h3>
                    <p className="text-xs text-slate-500">
                      Record stock receipt into warehouse facility. Feeds the Stock Receipts register.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelReceipt}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSubmitReceipt} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
                {receiptError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    {receiptError}
                  </div>
                )}

                {/* ROW 1: GRN / REF & DATE RECEIVED */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Column 1: GRN / REF */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      GRN / Reference <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={receiptForm.selectedGrnRef || ""}
                      onChange={(e) => handleSelectGRN(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden min-h-[44px]"
                    >
                      <option value="">-- Select GRN / PO or Manual --</option>
                      <option value="NO_GRN">No GRN (local purchase or consignment)</option>
                      {receiptOptions?.grns?.map((g) => (
                        <option key={g.referenceNumber} value={g.referenceNumber}>
                          {g.referenceNumber} - {g.supplier} ({g.items?.length || 1} items)
                        </option>
                      ))}
                      {receiptOptions?.pos?.map((p) => (
                        <option key={p.poNumber} value={p.poNumber}>
                          {p.poNumber} (Open PO) - {p.supplier}
                        </option>
                      ))}
                    </select>
                    {receiptForm.referenceNumber && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span>Generated / Assigned Ref:</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {receiptForm.referenceNumber}
                        </span>
                        {receiptForm.selectedGrnRef === "NO_GRN" && (
                          <span className="text-[10px] text-slate-400">(auto-generated, read-only)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 2: DATE */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      Date Received <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      max={todayIso}
                      value={receiptForm.dateReceived}
                      onChange={(e) => setReceiptForm({ ...receiptForm, dateReceived: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden min-h-[44px]"
                    />
                    {receiptForm.dateReceived > todayIso && (
                      <p className="text-[11px] text-rose-500 font-medium">Date Received cannot be in the future.</p>
                    )}
                  </div>
                </div>

                {/* ROW 2: STORE / FACILITY & SOURCE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Column 3: WAREHOUSE */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      Store / Facility Name <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={receiptForm.storeId}
                      onChange={(e) => {
                        const selStore = stores.find((s) => s.id === e.target.value);
                        setReceiptForm({
                          ...receiptForm,
                          storeId: e.target.value,
                          storeName: selStore?.storeName || "",
                        });
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden min-h-[44px]"
                    >
                      <option value="">-- Select Store / Warehouse --</option>
                      {activeStores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.storeName} ({s.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Column 4: SOURCE */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      Source <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={receiptForm.source}
                      onChange={(e) => setReceiptForm({ ...receiptForm, source: e.target.value as any })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden min-h-[44px]"
                    >
                      <option value="GRN">GRN (Goods Received Note)</option>
                      <option value="Local Purchase">Local Purchase</option>
                      <option value="Humanitarian Consignment">Humanitarian Consignment</option>
                    </select>
                  </div>
                </div>

                {/* ROW 3: ITEMS LIST TABLE */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-800/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-600 text-base">inventory_2</span>
                        Receipt Items ({receiptForm.items.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Add items received in this shipment. Live New Balance updates automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMoreItems}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      + Add More Items
                    </button>
                  </div>

                  {/* Items Rows */}
                  <div className="space-y-3">
                    {receiptForm.items.map((row, idx) => {
                      const masterItem = items.find((it) => it.id === row.itemId || it.stockCode === row.stockCode);
                      const currentBal = masterItem ? masterItem.currentBalance : 0;
                      const qRcv = parseFloat(row.quantityReceived as string) || 0;
                      const qRej = Math.max(0, parseFloat(row.quantityRejected as string) || 0);
                      const acceptedQty = Math.max(0, qRcv - qRej);
                      const computedNewBal = row.condition === "Good" ? currentBal + acceptedQty : currentBal;
                      const isPerishOrBatch = masterItem?.isPerishable || masterItem?.isBatchTracked;
                      const exceedsOutstanding =
                        receiptForm.source === "GRN" && row.outstandingQuantity > 0 && qRcv > row.outstandingQuantity;

                      return (
                        <div
                          key={row.rowId}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                              Item #{idx + 1}
                            </span>
                            {receiptForm.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md cursor-pointer transition-colors"
                                title="Remove item"
                              >
                                <span className="material-symbols-outlined text-base">close</span>
                              </button>
                            )}
                          </div>

                          {/* Fixed Asset Warning Banner if triggered */}
                          {row.fixedAssetWarning && (
                            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-base">warning</span>
                              {row.fixedAssetWarning}
                            </div>
                          )}

                          {/* 4 Core Item Columns: Stock Item, Stock Code, Qty Received, New Balance */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            {/* Stock Item */}
                            <div className="sm:col-span-2 space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Stock Item <span className="text-rose-500">*</span>
                              </label>
                              <select
                                value={row.itemName || ""}
                                onChange={(e) => handleSelectItemInRow(idx, e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden min-h-[40px]"
                              >
                                <option value="">-- Choose Stock Item --</option>
                                <optgroup label="Inventory Items">
                                  {availableItems.map((it) => (
                                    <option key={it.id} value={it.name}>
                                      {it.name}
                                    </option>
                                  ))}
                                </optgroup>
                                {fixedAssetItems.length > 0 && (
                                  <optgroup label="Fixed Assets (Excluded)">
                                    {fixedAssetItems.map((fa) => (
                                      <option key={fa.id} value={fa.name}>
                                        {fa.name} [Fixed Asset]
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>

                            {/* Stock Code & Unit (Read-only) */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Stock Code &amp; Unit
                              </label>
                              <input
                                type="text"
                                readOnly
                                value={row.stockCode ? `${row.stockCode} (${row.unit || "Unit"})` : "Auto-filled"}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-mono read-only:cursor-not-allowed min-h-[40px]"
                              />
                            </div>

                            {/* Qty Received */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Qty Received <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                placeholder="0"
                                value={row.quantityReceived}
                                onChange={(e) => updateReceiptItemRow(idx, { quantityReceived: e.target.value })}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden min-h-[40px]"
                              />
                            </div>
                          </div>

                          {/* Line 2 of Item Row: Outstanding pill & Live New Balance */}
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                            {/* PO / GRN Outstanding stats */}
                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              <span>
                                Ordered: <strong className="text-slate-800 dark:text-slate-200">{row.orderedQuantity || 0}</strong>
                              </span>
                              <span>
                                Already Received: <strong className="text-slate-800 dark:text-slate-200">{row.alreadyReceivedQuantity || 0}</strong>
                              </span>
                              <span>
                                Outstanding: <strong className="text-emerald-700 dark:text-emerald-400">{row.outstandingQuantity || 0}</strong>
                              </span>
                            </div>

                            {/* Live New Balance calculation */}
                            <div className="text-[11px]">
                              <span className="text-slate-500">Balance in Store: </span>
                              <strong className="font-mono text-slate-700 dark:text-slate-300">
                                Current: {currentBal},
                              </strong>{" "}
                              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
                                New Balance: {computedNewBal}
                              </span>
                            </div>
                          </div>

                          {/* Inline validation errors for item row */}
                          {exceedsOutstanding && (
                            <p className="text-[11px] text-rose-500 font-semibold">
                              Quantity received ({qRcv}) cannot exceed outstanding quantity ({row.outstandingQuantity}).
                            </p>
                          )}

                          {/* Item Sub-fields: Qty Rejected, Condition, Batch / Lot & Expiry, Unit Cost */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {/* Qty Rejected */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Qty Rejected (default 0)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={row.quantityRejected}
                                onChange={(e) => updateReceiptItemRow(idx, { quantityRejected: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono min-h-[38px]"
                              />
                              <p className="text-[10px] text-slate-400">
                                Accepted: <strong className="text-emerald-700 dark:text-emerald-400">{acceptedQty}</strong>
                              </p>
                            </div>

                            {/* Condition */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Condition <span className="text-rose-500">*</span>
                              </label>
                              <select
                                value={row.condition}
                                onChange={(e) => updateReceiptItemRow(idx, { condition: e.target.value as any })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[38px]"
                              >
                                <option value="Good">Good (Enters Stock)</option>
                                <option value="Damaged">Damaged (Quarantine / Pending Adj)</option>
                                <option value="Incomplete">Incomplete (Quarantine / Pending Adj)</option>
                              </select>
                            </div>

                            {/* Batch / Lot Number */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Batch / Lot Number {isPerishOrBatch && <span className="text-rose-500">*</span>}
                              </label>
                              <input
                                type="text"
                                placeholder={isPerishOrBatch ? "Required" : "Optional"}
                                value={row.batchNumber}
                                onChange={(e) => updateReceiptItemRow(idx, { batchNumber: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[38px]"
                              />
                            </div>

                            {/* Expiry Date */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Expiry Date {isPerishOrBatch && <span className="text-rose-500">*</span>}
                              </label>
                              <input
                                type="date"
                                value={row.expiryDate}
                                onChange={(e) => updateReceiptItemRow(idx, { expiryDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[38px]"
                              />
                            </div>
                          </div>

                          {/* Unit Cost & Total Value */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Unit Cost (NLe)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={row.unitCost}
                                onChange={(e) => updateReceiptItemRow(idx, { unitCost: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[38px]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Total Line Value (NLe)
                              </label>
                              <input
                                type="text"
                                readOnly
                                value={`NLe ${(qRcv * (parseFloat(row.unitCost as string) || 0)).toLocaleString()}`}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold read-only:cursor-not-allowed min-h-[38px]"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ROW 4: SOURCE DETAILS & ADDITIONAL FIELDS */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 space-y-4">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-600 text-base">description</span>
                    Source &amp; Allocation Details
                  </h4>

                  {/* Local Purchase Details */}
                  {receiptForm.source === "Local Purchase" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Supplier <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Supplier name"
                          value={receiptForm.supplier}
                          onChange={(e) => setReceiptForm({ ...receiptForm, supplier: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Invoice / Receipt Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. INV-2026-991"
                          value={receiptForm.invoiceNumber}
                          onChange={(e) => setReceiptForm({ ...receiptForm, invoiceNumber: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Invoice Document Upload <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="invoice_receipt.pdf"
                          value={receiptForm.invoiceDocument || "invoice_receipt.pdf"}
                          onChange={(e) => setReceiptForm({ ...receiptForm, invoiceDocument: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Humanitarian Consignment Details */}
                  {receiptForm.source === "Humanitarian Consignment" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Donor / Source Org <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. UNICEF Sierra Leone"
                          value={receiptForm.donor}
                          onChange={(e) => setReceiptForm({ ...receiptForm, donor: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Consignment / Waybill # <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. WBL-2026-778"
                          value={receiptForm.consignmentNumber}
                          onChange={(e) => setReceiptForm({ ...receiptForm, consignmentNumber: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Delivery Document Upload <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="delivery_waybill.pdf"
                          value={receiptForm.deliveryDocument || "delivery_waybill.pdf"}
                          onChange={(e) => setReceiptForm({ ...receiptForm, deliveryDocument: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                        />
                      </div>
                      <div className="sm:col-span-3 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                        ✓ Goods marked as donor-owned stock in inventory tracking.
                      </div>
                    </div>
                  )}

                  {/* Programme and Remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Programme / Project (Optional)
                      </label>
                      <select
                        value={receiptForm.programme}
                        onChange={(e) => setReceiptForm({ ...receiptForm, programme: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                      >
                        <option value="">-- Unallocated / General Stock --</option>
                        {BCF_PROGRAMMES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Remarks
                      </label>
                      <input
                        type="text"
                        placeholder="Required if quantity differs from order or condition is not Good"
                        value={receiptForm.remarks}
                        onChange={(e) => setReceiptForm({ ...receiptForm, remarks: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                      />
                    </div>
                  </div>
                </div>

                {/* MODAL FOOTER */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  {/* Received By: Session user (read-only) */}
                  <div className="text-[11px] text-slate-500">
                    Received By:{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {user?.name || "Albert J Bandama"} (
                      {currentRoleCode === "SA"
                        ? "Super Administrator"
                        : currentRoleCode === "PRC"
                        ? "Procurement Director"
                        : currentRoleCode}
                      )
                    </strong>
                    <span className="text-[10px] text-slate-400 ml-1">(session user, read-only)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelReceipt}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isReceiptFormValid || isSubmittingReceipt}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition-colors min-h-[44px]"
                    >
                      {isSubmittingReceipt ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                          Saving Receipt...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">save</span>
                          Save Receipt
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL: PRINT GOODS RECEIVED VOUCHER (A4 LAYOUT) ─── */}
      {isPrintReceiptVoucherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white dark:bg-slate-900 print:bg-white text-slate-900 dark:text-white print:text-black border border-slate-200 dark:border-slate-800 print:border-0 rounded-2xl w-full max-w-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-6">
            {/* Header / Brand */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-black tracking-wider text-emerald-800">
                  BANDAMA CHARITY FOUNDATION (BCF-SL)
                </h2>
                <p className="text-xs text-slate-500">
                  Administration Hub • Procurement &amp; Inventory Directorate • Freetown, Sierra Leone
                </p>
                <h3 className="text-sm font-extrabold text-slate-900 mt-2">
                  GOODS RECEIVED VOUCHER (GRV)
                </h3>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm text-emerald-700 block">
                  {voucherReceiptTxns[0]?.referenceNumber || "BCF-RCV"}
                </span>
                <span className="text-xs text-slate-500">
                  Date: {voucherReceiptTxns[0]?.date || new Date().toISOString().split("T")[0]}
                </span>
              </div>
            </div>

            {/* Meta Data */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 print:bg-slate-100 p-3 rounded-xl">
              <div>
                <span className="text-slate-500 block">Warehouse / Facility:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {voucherReceiptTxns[0]?.storeName || "Central Warehouse"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Source / Supplier / Donor:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {voucherReceiptTxns[0]?.supplier || voucherReceiptTxns[0]?.donor || voucherReceiptTxns[0]?.source || "Direct Delivery"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">PO / Reference:</span>
                <span className="font-mono">{voucherReceiptTxns[0]?.poNumber || voucherReceiptTxns[0]?.referenceNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Received By:</span>
                <strong>{voucherReceiptTxns[0]?.receivedBy?.name || user?.name || "Storekeeper"}</strong>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3 border-b">Stock Item</th>
                    <th className="py-2 px-3 border-b">Stock Code</th>
                    <th className="py-2 px-3 text-right border-b">Qty Accepted</th>
                    <th className="py-2 px-3 text-right border-b">New Balance</th>
                    <th className="py-2 px-3 border-b">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voucherReceiptTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 px-3 font-semibold">{t.itemName}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{t.stockCode}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">+{t.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{t.newBalance}</td>
                      <td className="py-2 px-3">{t.condition || "Good"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Lines */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 text-xs">
              <div className="space-y-4">
                <p className="font-semibold text-slate-700">Received By (Storekeeper):</p>
                <div className="border-b border-slate-400 h-6"></div>
                <p className="text-[10px] text-slate-500">Sign &amp; Date</p>
              </div>
              <div className="space-y-4">
                <p className="font-semibold text-slate-700">Inspected &amp; Verified By:</p>
                <div className="border-b border-slate-400 h-6"></div>
                <p className="text-[10px] text-slate-500">Sign &amp; Date</p>
              </div>
              <div className="space-y-4">
                <p className="font-semibold text-slate-700">Procurement Authorisation:</p>
                <div className="border-b border-slate-400 h-6"></div>
                <p className="text-[10px] text-slate-500">Sign &amp; Date</p>
              </div>
            </div>

            {/* Print & Close Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button
                type="button"
                onClick={() => setIsPrintReceiptVoucherOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Print Voucher (A4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: REVERSE STOCK RECEIPT ─── */}
      {isReverseReceiptModalOpen && canRecordReceipt && reversingTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <span className="material-symbols-outlined text-2xl">undo</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Reverse Stock Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReverseReceiptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Reversing receipt <strong className="font-mono text-emerald-700">{reversingTxn.referenceNumber}</strong> will deduct{" "}
              <strong>{reversingTxn.quantity} units</strong> of <strong>{reversingTxn.itemName}</strong> from warehouse{" "}
              <strong>{reversingTxn.storeName}</strong> and record a negative audit entry.
            </p>

            {reversalError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold">
                {reversalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Reversal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inward error, duplicate entry, supplier recall"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Authorised Approver Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={reversalApprover}
                  onChange={(e) => setReversalApprover(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReverseReceiptModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reversalReason.trim() || isSubmittingReversal}
                onClick={handleConfirmReverseReceipt}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {isSubmittingReversal ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE / ADD STORE OR WAREHOUSE ─── */}
      {isAddStoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-2xl">warehouse</span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Add Store / Warehouse Facility
                  </h3>
                  <p className="text-xs text-slate-500">Register new BCF-SL storage or humanitarian depot</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStoreOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStoreSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300">
                <span className="material-symbols-outlined text-base mt-0.5 shrink-0">mark_email_read</span>
                <p className="text-[11px] leading-relaxed">
                  <strong>CEO Notification Enabled:</strong> An automated dispatch email with facility details will be sent directly to <strong>Dr. Alimamy Koroma (ceo@bcf-sl.org)</strong> upon registration.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Store / Facility Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kono District Humanitarian Depot"
                  value={newStore.storeName}
                  onChange={(e) => setNewStore({ ...newStore, storeName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Storage Classification *
                  </label>
                  <select
                    value={newStore.storageType}
                    onChange={(e) => setNewStore({ ...newStore, storageType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Central Warehouse">Central Warehouse</option>
                    <option value="Regional Depot">Regional Depot</option>
                    <option value="Field Store">Field Store</option>
                    <option value="Buffer Warehouse">Buffer Warehouse</option>
                    <option value="Cold Storage Facility">Cold Storage Facility</option>
                    <option value="Emergency Transit Depot">Emergency Transit Depot</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Initial Operating Status *
                  </label>
                  <select
                    value={newStore.status}
                    onChange={(e) =>
                      setNewStore({
                        ...newStore,
                        status: e.target.value as "Active" | "Inactive" | "Suspended" | "Closed",
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="Active">Active (Operational)</option>
                    <option value="Inactive">Inactive (Dormant)</option>
                    <option value="Suspended">Suspended (Audit/Hold)</option>
                    <option value="Closed">Closed (Decommissioned)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Physical Address / Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 14 Post Office Road, Koidu Town"
                  value={newStore.location}
                  onChange={(e) => setNewStore({ ...newStore, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    District *
                  </label>
                  <select
                    value={newStore.district}
                    onChange={(e) => setNewStore({ ...newStore, district: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    {[
                      "Western Area Urban",
                      "Western Area Rural",
                      "Bo",
                      "Kenema",
                      "Bombali",
                      "Kono",
                      "Port Loko",
                      "Tonkolili",
                      "Kambia",
                      "Kailahun",
                      "Moyamba",
                      "Pujehun",
                      "Bonthe",
                      "Koinadugu",
                      "Falaba",
                      "Karene",
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Chiefdom
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gbense"
                    value={newStore.chiefdom}
                    onChange={(e) => setNewStore({ ...newStore, chiefdom: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Assigned Storekeeper *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sahr Tamba"
                    value={newStore.storekeeper}
                    onChange={(e) => setNewStore({ ...newStore, storekeeper: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +232 78 555 123"
                    value={newStore.contact}
                    onChange={(e) => setNewStore({ ...newStore, contact: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Holding Capacity (Units) *
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  value={newStore.capacity}
                  onChange={(e) => setNewStore({ ...newStore, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              {/* Security & Guard Personnel Details (Optional) */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-extrabold">
                  <span className="material-symbols-outlined text-amber-600 text-sm">shield</span>
                  <span>Security &amp; Guard Personnel Details (Optional)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Agency / Company
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. G4S / Mount Everest Security"
                      value={newStore.securityAgency}
                      onChange={(e) => setNewStore({ ...newStore, securityAgency: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +232 77 999 111"
                      value={newStore.securityPhone}
                      onChange={(e) => setNewStore({ ...newStore, securityPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Name of Security / Guard(s)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mohamed Bangura"
                      value={newStore.securityName}
                      onChange={(e) => setNewStore({ ...newStore, securityName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Station Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Gate 1 Security Post"
                      value={newStore.securityAddress}
                      onChange={(e) => setNewStore({ ...newStore, securityAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Supervisor Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Capt. James Fofanah"
                      value={newStore.securitySupervisorName}
                      onChange={(e) => setNewStore({ ...newStore, securitySupervisorName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Supervisor Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +232 76 888 222"
                      value={newStore.securitySupervisorPhone}
                      onChange={(e) => setNewStore({ ...newStore, securitySupervisorPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Supervisor Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Regional Security HQ"
                      value={newStore.securitySupervisorAddress}
                      onChange={(e) => setNewStore({ ...newStore, securitySupervisorAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStoreOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Register Store &amp; Notify CEO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT STORE / WAREHOUSE ─── */}
      {editingStore && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-2xl">edit_note</span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Edit Store / Warehouse Facility
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update facility data &bull; <strong className="font-mono text-emerald-700">{editingStore.id}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStore(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditStoreSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Store / Facility Name *
                </label>
                <input
                  type="text"
                  required
                  value={editStoreForm.storeName}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, storeName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Storage Classification *
                  </label>
                  <select
                    value={editStoreForm.storageType}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, storageType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Central Warehouse">Central Warehouse</option>
                    <option value="Regional Depot">Regional Depot</option>
                    <option value="Field Store">Field Store</option>
                    <option value="Buffer Warehouse">Buffer Warehouse</option>
                    <option value="Cold Storage Facility">Cold Storage Facility</option>
                    <option value="Emergency Transit Depot">Emergency Transit Depot</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Operating Status *
                  </label>
                  <select
                    value={editStoreForm.status}
                    onChange={(e) =>
                      setEditStoreForm({
                        ...editStoreForm,
                        status: e.target.value as "Active" | "Inactive" | "Suspended" | "Closed",
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="Active">Active (Operational)</option>
                    <option value="Inactive">Inactive (Dormant)</option>
                    <option value="Suspended">Suspended (Audit/Hold)</option>
                    <option value="Closed">Closed (Decommissioned)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Physical Address / Location *
                </label>
                <input
                  type="text"
                  required
                  value={editStoreForm.location}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    District *
                  </label>
                  <select
                    value={editStoreForm.district}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, district: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    {[
                      "Western Area Urban",
                      "Western Area Rural",
                      "Bo",
                      "Kenema",
                      "Bombali",
                      "Kono",
                      "Port Loko",
                      "Tonkolili",
                      "Kambia",
                      "Kailahun",
                      "Moyamba",
                      "Pujehun",
                      "Bonthe",
                      "Koinadugu",
                      "Falaba",
                      "Karene",
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Chiefdom
                  </label>
                  <input
                    type="text"
                    value={editStoreForm.chiefdom}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, chiefdom: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Assigned Storekeeper *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStoreForm.storekeeper}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, storekeeper: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStoreForm.contact}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, contact: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Holding Capacity (Units) *
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  value={editStoreForm.capacity}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              {/* Security & Guard Personnel Details (Optional) */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-extrabold">
                  <span className="material-symbols-outlined text-amber-600 text-sm">shield</span>
                  <span>Security &amp; Guard Personnel Details (Optional)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Agency / Company
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. G4S / Mount Everest Security"
                      value={editStoreForm.securityAgency}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, securityAgency: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +232 77 999 111"
                      value={editStoreForm.securityPhone}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, securityPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Name of Security / Guard(s)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mohamed Bangura"
                      value={editStoreForm.securityName}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, securityName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Station Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Gate 1 Security Post"
                      value={editStoreForm.securityAddress}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, securityAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Security Supervisor Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Capt. James Fofanah"
                      value={editStoreForm.securitySupervisorName}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, securitySupervisorName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Supervisor Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +232 76 888 222"
                      value={editStoreForm.securitySupervisorPhone}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, securitySupervisorPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Supervisor Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Regional Security HQ"
                      value={editStoreForm.securitySupervisorAddress}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, securitySupervisorAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: VIEW ITEMS IN STORE / WAREHOUSE (Clickable Store Card) ─── */}
      {selectedStoreForStock && (() => {
        const storeItems = items.filter(
          (it) =>
            it.warehouseId === selectedStoreForStock.id ||
            it.warehouseName === selectedStoreForStock.storeName ||
            (selectedStoreForStock.id === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central"))
        );

        const filteredStoreItems = storeItems.filter((it) => {
          if (!storeStockSearch.trim()) return true;
          const q = storeStockSearch.toLowerCase();
          return (
            it.stockCode.toLowerCase().includes(q) ||
            it.name.toLowerCase().includes(q) ||
            (it.category && it.category.toLowerCase().includes(q))
          );
        });

        const totalUnits = storeItems.reduce((acc, it) => acc + (it.currentBalance || 0), 0);
        const totalVal = storeItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
        const capacityUtilization = selectedStoreForStock.capacity
          ? Math.min(100, Math.round((totalUnits / selectedStoreForStock.capacity) * 100))
          : 0;

        const statusStyle = {
          Active: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
          Inactive: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
          Suspended: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
          Closed: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
        }[selectedStoreForStock.status] || "bg-slate-100 text-slate-800 border-slate-300";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-6 my-8 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700">
                    <span className="material-symbols-outlined text-2xl">warehouse</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {selectedStoreForStock.id}
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                        {selectedStoreForStock.storeName}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusStyle}`}>
                        {selectedStoreForStock.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedStoreForStock.location} &bull; {selectedStoreForStock.district} &bull; Storekeeper: <strong>{selectedStoreForStock.storekeeper}</strong> ({selectedStoreForStock.contact})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canFull && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditStore(selectedStoreForStock)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Edit Facility</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedStoreForStock(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              {/* Facility Metrics Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 shrink-0">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total SKUs</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {storeItems.length}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Stock In Hand</span>
                  <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 font-mono">
                    {totalUnits.toLocaleString()} Units
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Stock Valuation</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    NLe {totalVal.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Capacity Utilization</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {capacityUtilization}% <span className="text-[10px] font-normal text-slate-400">({selectedStoreForStock.capacity?.toLocaleString()} cap)</span>
                  </span>
                </div>
              </div>

              {/* Facility Security & Guard Personnel Details Panel */}
              <div className="mb-4 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 dark:text-amber-400 text-lg">shield</span>
                    <h4 className="font-extrabold text-slate-900 dark:text-white">
                      Facility Security &amp; Guard Personnel
                    </h4>
                  </div>
                  {canFull && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditStore(selectedStoreForStock)}
                      className="text-[11px] font-bold text-amber-800 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                      <span>{selectedStoreForStock.securityAgency || selectedStoreForStock.securityName ? "Update Security Info" : "Provision Security Details"}</span>
                    </button>
                  )}
                </div>

                {selectedStoreForStock.securityAgency || selectedStoreForStock.securityName || selectedStoreForStock.securitySupervisorName ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] pt-1">
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/30">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Security Agency / Firm</span>
                      <strong className="text-slate-900 dark:text-white">{selectedStoreForStock.securityAgency || "Internal BCF Security"}</strong>
                      {selectedStoreForStock.securityAddress && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{selectedStoreForStock.securityAddress}</p>
                      )}
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/30">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Guard(s) on Duty</span>
                      <strong className="text-slate-900 dark:text-white">{selectedStoreForStock.securityName || "Assigned Facility Guard"}</strong>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{selectedStoreForStock.securityPhone || "No direct phone"}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/30">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Security Supervisor</span>
                      <strong className="text-slate-900 dark:text-white">{selectedStoreForStock.securitySupervisorName || "Duty Commander"}</strong>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{selectedStoreForStock.securitySupervisorPhone || "No phone listed"}</p>
                      {selectedStoreForStock.securitySupervisorAddress && (
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{selectedStoreForStock.securitySupervisorAddress}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-slate-500 text-[11px] py-1">
                    <p>No external security firm or guard personnel recorded for this facility.</p>
                    {canFull && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditStore(selectedStoreForStock)}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
                      >
                        Provision Security Details
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Status change prompt inside modal */}
              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Facility Operating Status:
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${statusStyle}`}>
                    {selectedStoreForStock.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {canFull && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStoreForStock(null);
                        openTransferModal(selectedStoreForStock.id);
                      }}
                      className="px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer mr-2"
                      title="Transfer items from this facility to another warehouse"
                    >
                      <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                      <span>Transfer Stock Out</span>
                    </button>
                  )}
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Switch:</span>
                  {(["Active", "Inactive", "Suspended", "Closed"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={!canFull || updatingStoreId === selectedStoreForStock.id}
                      onClick={() => handleUpdateStoreStatus(selectedStoreForStock, st)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed transition-all ${
                        selectedStoreForStock.status === st
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                          : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-600"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Within Store Items */}
              <div className="mb-3 shrink-0">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder={`Search among ${storeItems.length} items in ${selectedStoreForStock.storeName}...`}
                    value={storeStockSearch}
                    onChange={(e) => setStoreStockSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Stock Items Table */}
              <div className="overflow-y-auto overflow-x-auto flex-1 rounded-xl border border-slate-200 dark:border-slate-800">
                {filteredStoreItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <span className="material-symbols-outlined text-3xl text-slate-400 mb-2 block">
                      inventory_2
                    </span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {storeItems.length === 0
                        ? "No items are currently stored in this warehouse."
                        : "No items match your search query."}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                      Items can be assigned to this store through Goods Received Notes (GRN), Stock Receipts, or Stock Transfers from other facilities.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400">Stock Code</th>
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400">Item Name</th>
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400">Category</th>
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400 text-right">Balance</th>
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400 text-right">Total Value</th>
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400">Stock Status</th>
                        <th className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-400 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredStoreItems.map((item) => {
                        const statusColor =
                          item.status === "In Stock"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : item.status === "Low Stock"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                              {item.stockCode}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-slate-400">{item.itemClass}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                              {item.category}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                              {item.currentBalance?.toLocaleString()} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                              NLe {item.unitCost?.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              NLe {item.totalValue?.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${statusColor}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedItem(item)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                                >
                                  View
                                </button>
                                {canFull && (item.currentBalance || 0) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedStoreForStock(null);
                                      openTransferModal(selectedStoreForStock.id, item.id);
                                    }}
                                    title="Transfer this stock item to another warehouse"
                                    className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">sync_alt</span>
                                    <span>Transfer</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <span className="text-[11px] text-slate-400">
                  Showing {filteredStoreItems.length} of {storeItems.length} items in facility
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStoreForStock(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
