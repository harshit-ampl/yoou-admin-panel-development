export interface MakingChargeChangesInputAttr {
  name: string;
  wastage_rate_or_labour_charge: number;
  calculate_wastage_amount_on: "Per Pc" | "Per Gram" | "% Of NetWt";
}
