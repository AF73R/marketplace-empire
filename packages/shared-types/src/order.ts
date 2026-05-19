// ─── Order domain types ─────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_title: string;        // snapshot at purchase time
  product_image?: string;       // first image snapshot
  quantity: number;
  unit_price: number;           // cents
  total_price: number;          // cents
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;         // subtotal + shipping - discounts, in cents
  currency: string;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderRequest {
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
  shipping_address: ShippingAddress;
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}