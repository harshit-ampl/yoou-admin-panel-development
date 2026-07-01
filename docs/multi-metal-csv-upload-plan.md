# Multi-Metal CSV Upload — Admin Panel Changes

## Context

The Go middleware is being updated to support `silver_weight` and `platinum_weight` on gold variants for multi-metal price calculation. The admin panel needs to accept these new fields during CSV upload and expose them in the catalog export.

**Prerequisite**: The `jewelry_variants` DB table must already have `silver_weight` and `platinum_weight` columns (added via the middleware plan's Step 1 migration).

---

## Files to Modify

| File | Purpose |
|------|---------|
| `app/api/csv-upload/route.ts` | CSV parsing + DB insert (lines 69-188) |
| `components/product-information-manager.tsx` | Frontend validation (lines 43-83) |
| `app/api/get-all-uploaded-products/route.ts` | Catalog export query (lines 24-34) |
| `public/sample.csv` | Sample CSV template |

---

## Step 1: Update CSV Type Definition

**File**: `app/api/csv-upload/route.ts`

Add to the `CSVRow` type (or inline interface):

```typescript
SilverWeight?: number;    // NEW — optional, defaults to 0
PlatinumWeight?: number;  // NEW — optional, defaults to 0
```

---

## Step 2: Update CSV Parsing

**File**: `app/api/csv-upload/route.ts` — around lines 69-97

The current CSV has columns at indices 0-19. Add silver_weight and platinum_weight as **optional** columns at indices 20 and 21:

```typescript
SilverWeight: row[20] ? parseFloat(row[20]) || 0 : 0,      // NEW — column index 20
PlatinumWeight: row[21] ? parseFloat(row[21]) || 0 : 0,    // NEW — column index 21
```

**Backward compatible**: If the CSV has only 20 columns (no silver/platinum), both default to 0.

---

## Step 3: Update SQL INSERT

**File**: `app/api/csv-upload/route.ts` — around lines 165-188

### 3a. Add columns to INSERT statement:

```sql
INSERT INTO jewelry_variants (
    sku, parent_design_code, variant_id, barcode, net_wt, purity,
    making_charges_code, other_stone_charges, dcolor_id,
    dia_wt_1, dia_pc_1, dsizeid_1,
    dia_wt_2, dia_pc_2, dsizeid_2,
    dia_wt_3, dia_pc_3, dsizeid_3,
    discount_percentage_on_making_charge, discount_percentage_on_stone, markup, stone_count,
    silver_weight, platinum_weight    -- NEW
) VALUES ...
```

### 3b. Update placeholder count:

From 22 to 24 parameters per row (adjust `$N` placeholders accordingly).

### 3c. Add to ON CONFLICT upsert:

```sql
silver_weight = EXCLUDED.silver_weight,
platinum_weight = EXCLUDED.platinum_weight
```

### 3d. Add values to params array:

```typescript
row.SilverWeight ?? 0,
row.PlatinumWeight ?? 0,
```

---

## Step 4: Update Frontend Validation (Optional)

**File**: `components/product-information-manager.tsx` — around lines 43-83

Silver and platinum weights are **optional** fields, so no required validation is needed. However, if present, they should be valid numbers:

```typescript
// Optional: warn if silver_weight or platinum_weight contain non-numeric values
if (records[index][20] && isNaN(Number(records[index][20]))) {
    setMessage(`⚠️ Warning: Silver weight invalid on row ${index + 1}, will default to 0`);
}
if (records[index][21] && isNaN(Number(records[index][21]))) {
    setMessage(`⚠️ Warning: Platinum weight invalid on row ${index + 1}, will default to 0`);
}
```

---

## Step 5: Update Sample CSV

**File**: `public/sample.csv`

Add `silver_weight` and `platinum_weight` headers at the end:

**Current header:**
```
sku,barcode,net_wt,purity,making_charges_code,other_stone_charges,dcolor_id,dia_wt_1,dia_pc_1,dsizeid_1,dia_wt_2,dia_pc_2,dsizeid_2,dia_wt_3,dia_pc_3,dsizeid_3,discount_percentage_on_making_charge,discount_percentage_on_stone,markup,stone_count
```

**Updated header:**
```
sku,barcode,net_wt,purity,making_charges_code,other_stone_charges,dcolor_id,dia_wt_1,dia_pc_1,dsizeid_1,dia_wt_2,dia_pc_2,dsizeid_2,dia_wt_3,dia_pc_3,dsizeid_3,discount_percentage_on_making_charge,discount_percentage_on_stone,markup,stone_count,silver_weight,platinum_weight
```

Sample rows can leave these blank (backward compatible).

---

## Step 6: Update Catalog Export Query

**File**: `app/api/get-all-uploaded-products/route.ts` — around lines 24-34

Add `silver_weight, platinum_weight` to the SELECT:

```sql
SELECT sku, barcode, net_wt, purity, making_charges_code, other_stone_charges,
       dcolor_id, dia_wt_1, dia_pc_1, dsizeid_1, dia_wt_2, dia_pc_2, dsizeid_2,
       dia_wt_3, dia_pc_3, dsizeid_3, discount_percentage_on_making_charge,
       discount_percentage_on_stone, markup, stone_count,
       COALESCE(silver_weight, 0) as silver_weight,       -- NEW
       COALESCE(platinum_weight, 0) as platinum_weight     -- NEW
FROM jewelry_variants ORDER BY id LIMIT $1 OFFSET $2
```

---

## Verification Plan

1. **Backward compatibility**: Upload existing CSV (without silver/platinum columns) — should work with both values defaulting to 0
2. **New CSV**: Upload CSV with silver_weight=5 and platinum_weight=3 for a test SKU — verify values are stored in DB
3. **Catalog export**: Download catalog CSV — verify silver_weight and platinum_weight columns appear with correct values
4. **End-to-end**: Upload CSV → trigger sync → verify prices on Shopify include silver/platinum costs
