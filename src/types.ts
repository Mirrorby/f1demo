export interface Background {
  mode: 'template' | 'color' | 'image';
  color: string;
  image: string;
  tone: 'auto' | 'light' | 'dark';
  overlay: number;
}
export interface Settings {
  backgrounds?: Partial<
    Record<'page' | 'hero' | 'catalog' | 'cards' | 'information' | 'footer', Background>
  >;
  language: import('./language').Language;
  theme: 'minimal' | 'fashion' | 'home' | 'beauty';
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
  priceOnRequest?: boolean;
  discountPercent: number;
  availability: 'available' | 'preorder' | 'unavailable';
  photos: string[];
  brand: string;
  collection: string;
  sku: string;
  attributes: { label: string; value: string }[];
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
  photo?: string;
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
