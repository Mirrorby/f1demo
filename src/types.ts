export interface Settings {
  description: string;
  accentColor: string;
  logo: string;
  whatsapp: string;
  telegram: string;
  instagram: string;
  currencies: string[];
  deliveryMethods: string[];
  deliveryHint: string;
  heroTitle: string;
  footerText: string;
  texts: Record<string, string>;
}
export interface StoreRow {
  id: string;
  slug: string;
  name: string;
  status: 'demo' | 'active';
  settings: string;
  owner_id: string | null;
  orders_enabled: number;
  version: number;
}
export interface Variant {
  id: string;
  label: string;
  stock: number | null;
}
export interface ProductData {
  name: string;
  category: string;
  description: string;
  prices: Record<string, number>;
  discountPercent: number;
  availability: 'available' | 'preorder' | 'unavailable';
  photos: string[];
  team: string;
  year: string;
  number: string;
  color: string;
}
export interface Product extends ProductData {
  id: string;
  version: number;
  variants: Variant[];
}
export interface ProductRow {
  id: string;
  store_id: string;
  data: string;
  version: number;
  deleted_at: number | null;
}
export interface OrderRow {
  id: string;
  store_id: string;
  number: number;
  idempotency_key: string;
  request_hash: string;
  customer: string;
  items: string;
  currency: string;
  total_minor: number;
  status: string;
  created_at: number;
}
export interface OrderItem {
  productId: string;
  variantId: string;
  name: string;
  variant: string;
  quantity: number;
  unitMinor: number;
  version: number;
  reserved: boolean;
}
export interface Customer {
  name: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  index: string;
  comment: string;
  deliveryMethod: string;
}
