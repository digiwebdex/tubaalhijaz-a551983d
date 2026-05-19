# Phase 1 Financial Contract (BDT/SAR Snapshot)

This document defines the API/schema contract expected by the Phase 1 admin redesign.

## Required write fields

All financial writes should accept and persist:

- `amount_bdt` (number)
- `amount_sar` (number)
- `fx_rate_sar_to_bdt` (number)
- `fx_locked_at` (ISO string)
- `fx_source` (string)

## Required ledger metadata fields

Financial writes should also accept:

- `party_type` (`customer | supplier | moallem | ...`)
- `party_id` (string UUID)
- `source_type` (`booking | transaction | supplier | moallem | ...`)
- `source_id` (string UUID)
- `entry_type` (`bill | payment | adjustment`)

## Statement read API

`GET /api/statements/customer` should support:

- `party_id`
- `date_from`
- `date_to`
- `service_type`
- `status`

Response rows should include at least:

- `date`
- `ref_no`
- `description`
- `service_type`
- `bill_bdt`
- `bill_sar`
- `pay_bdt`
- `pay_sar`
- `fx_rate_sar_to_bdt`
- `running_balance_bdt`
- `running_balance_sar`

## Backward compatibility

Frontend currently sends the fields above and retries without them when an older backend rejects unknown columns.
Backends should be upgraded to persist these fields to complete Phase 1 requirements.
