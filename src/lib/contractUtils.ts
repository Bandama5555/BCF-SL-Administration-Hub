/**
 * contractUtils.ts — Client-safe utility helpers for Employee Contracts
 * Bandama Charity Foundation Sierra Leone (BCF-SL)
 */

import { contractHasEndDate } from "./documentTypes";

/**
 * Checks whether a contract end date is expiring within threshold days (default 60 days).
 * Strict rule: NEVER applies to Permanent or Volunteer contracts.
 */
export function isExpiringSoon(
  endDate?: string | null,
  contractType?: string | null,
  thresholdDays: number = 60
): boolean {
  if (contractType && !contractHasEndDate(contractType)) {
    return false;
  }
  if (!endDate) return false;
  const target = new Date(endDate);
  if (isNaN(target.getTime())) return false;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= thresholdDays;
}

/**
 * Computes remaining days until expiry (or negative if already expired).
 * Strict rule: ALWAYS returns null for Permanent or Volunteer contracts.
 */
export function getDaysUntilExpiry(
  endDate?: string | null,
  contractType?: string | null
): number | null {
  if (contractType && !contractHasEndDate(contractType)) {
    return null;
  }
  if (!endDate) return null;
  const target = new Date(endDate);
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
