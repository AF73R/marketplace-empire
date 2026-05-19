// ─── Product domain types ───────────────────────────────────────────

export interface Product {
    id: string;
    seller_id: string;
    title: string;
    description?: string | null;
    slug: string;
    price: number;          // in cents (always integer)
    currency: string;
    images: string[];       // array of URLs
    category: string[];
    tags: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }
  
  export interface CreateProductRequest {
    title: string;
    description?: string;
    price: number;
    currency?: string;
    images?: string[];
    category?: string[];
    tags?: string[];
  }
  
  export interface UpdateProductRequest {
    title?: string;
    description?: string;
    price?: number;
    currency?: string;
    images?: string[];
    category?: string[];
    tags?: string[];
    is_active?: boolean;
  }
  
  export interface ProductListResponse {
    products: Product[];
    total: number;
    page: number;
    limit: number;
  }