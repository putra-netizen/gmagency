/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  image_url: string;
  whatsapp_number: string;
  created_at?: string;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface Order {
  id: string;
  product_id: string;
  product_name: string;
  buyer_name: string;
  phone_number: string;
  notes?: string;
  target_link?: string;
  target_spam_phone?: string;
  quantity: number;
  total_price: number;
  payment_status: PaymentStatus;
  created_at: string;
  worker_id?: string;
  worker_status?: 'unassigned' | 'taken' | 'done';
  worker_proof_url?: string;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  revenueByProduct: { name: string; value: number }[];
  recentOrders: Order[];
}

export type Language = 'id' | 'en';

export interface ShopeeOrder {
  id: string;
  order_type: 'REPORT_ALL_SOSMED' | 'SPAM_WA';
  store_name: string;
  buyer_name: string;
  service_type: string;
  quantity: number;
  target_link: string;
  notes?: string;
  formatted_text: string;
  worker_id?: string;
  work_order?: string;
  created_at: string;
  status?: 'PENDING' | 'PROGRESS' | 'DONE';
  created_by?: string;
}

export interface MapsReview {
  id: string;
  client_name: string;
  maps_link: string;
  target_count: number;
  reviewer_accounts: string[];
  proof_link?: string;
  status: 'PENDING' | 'PROGRESS' | 'DONE';
  created_at: string;
  store_name?: string;
  notes?: string;
  review_type?: 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS';
  created_by?: string;
}

