export interface MetalPriceAttributes {
  id: number;
  open_date: Date;
  datetime: Date;
  metal_type: string;
  sale_rate: number;
  purity: number;
  exchange_rate: number;
  purity_description: string;
  purity_percentage: number;
  urd_rate: number;
  ecommerce_description?: string;
}
