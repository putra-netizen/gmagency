/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Product, Order, Language, PaymentStatus, DashboardStats, ShopeeOrder, MapsReview } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { 
  dbGetProducts, dbCreateProduct, dbUpdateProduct, dbDeleteProduct,
  dbGetOrders, dbCreateOrder, dbUpdateOrder, dbDeleteOrder, dbGetDashboardStats,
  dbGetShopeeOrders, dbCreateShopeeOrder, dbUpdateShopeeOrder, dbDeleteShopeeOrder,
  dbGetMapsReviews, dbCreateMapsReview, dbGetMapsReviews as dbGetMapsReviewsOriginal, dbUpdateMapsReview, dbDeleteMapsReview,
  dbUploadProductImage
} from '../lib/supabase';
import { getAdminShpLogs, clearAdminShpLogs, AdminShpLog, logAdminShpAction } from '../utils/adminshpLogs';
import { formatRupiah } from './ProductCard';
import { getQrisConfig, saveQrisConfig, resetQrisConfig } from '../utils/qrisHelper';
import { toast } from '../utils/toast';
import { getSheetsSyncConfig, saveSheetsSyncConfig, getGoogleAppsScriptTemplate } from '../utils/sheetsSyncHelper';
import { generateMapsReportPDF } from '../utils/pdfGenerator';
import { MonthlyDateRangePicker, TimeFilterConfig, isWithinCustomTimeframe } from './MonthlyDateRangePicker';
import { FinanceView } from './FinanceView';
import { SpreadsheetManagerModal } from './SpreadsheetManagerModal';
import { DEFAULT_SPREADSHEET_URL, generateAppsScriptCode, parseAccountsList } from '../utils/spreadsheetIntegration';
import { 
  TrendingUp, ShoppingBag, DollarSign, Clock, CheckCircle2, 
  Plus, Edit, Trash2, Eye, Link2, Phone, Calendar, RefreshCw, 
  Briefcase, Save, AlertCircle, FileText, Check, Database, X, Globe,
  ExternalLink, Image as ImageIcon, Settings, ShoppingCart, Copy, ArrowLeft,
  Star, MapPin, Upload, Users, Key, ShieldAlert, Search, FileDown,
  FileSpreadsheet, Download, Menu, ChevronRight, ChevronLeft, Wallet
} from 'lucide-react';

interface AdminPanelProps {
  currentLang: Language;
  onInstallApp?: () => void;
}

const getSlotIndicatorName = (slot: string): string => {
  const clean = slot?.trim()?.toLowerCase();
  if (clean === 'adminshp1' || clean === 'adminera') return 'ERA';
  if (clean === 'adminshp2' || clean === 'admincika') return 'CIKA';
  if (clean === 'adminshp3' || clean === 'adminvira') return 'VIRA';
  if (clean === 'adminshp4' || clean === 'adminali') return 'ALI';
  return slot;
};

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onSave: (val: string) => void;
  debounceMs?: number;
}

const DebouncedInput: React.FC<DebouncedInputProps> = ({ value, onSave, debounceMs = 500, ...props }) => {
  const [localVal, setLocalVal] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const lastSavedValRef = useRef(value);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Sync with external value changes
  useEffect(() => {
    if (value !== lastSavedValRef.current) {
      lastSavedValRef.current = value;
      if (!isFocused) {
        setLocalVal(value);
      }
    }
  }, [value, isFocused]);

  // Debounce saving
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== lastSavedValRef.current) {
        lastSavedValRef.current = localVal;
        onSaveRef.current(localVal);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localVal, debounceMs]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (localVal !== lastSavedValRef.current) {
      lastSavedValRef.current = localVal;
      onSaveRef.current(localVal);
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  return (
    <input
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onSave: (val: string) => void;
  debounceMs?: number;
}

const DebouncedTextarea: React.FC<DebouncedTextareaProps> = ({ value, onSave, debounceMs = 500, ...props }) => {
  const [localVal, setLocalVal] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const lastSavedValRef = useRef(value);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Sync with external value changes
  useEffect(() => {
    if (value !== lastSavedValRef.current) {
      lastSavedValRef.current = value;
      if (!isFocused) {
        setLocalVal(value);
      }
    }
  }, [value, isFocused]);

  // Debounce saving
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== lastSavedValRef.current) {
        lastSavedValRef.current = localVal;
        onSaveRef.current(localVal);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localVal, debounceMs]);

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    if (localVal !== lastSavedValRef.current) {
      lastSavedValRef.current = localVal;
      onSaveRef.current(localVal);
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  return (
    <textarea
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeBgColor?: string;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, activeBgColor = 'bg-blue-600' }) => {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  const maxPagesToShow = 5;

  if (totalPages <= maxPagesToShow + 2) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push('...');
    }

    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-slate-100 bg-white">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p, idx) => {
        if (p === '...') {
          return (
            <span key={`ell-${idx}`} className="px-2 py-1 text-slate-400 text-xs font-bold select-none">
              ...
            </span>
          );
        }
        const pageNum = p as number;
        const isActive = pageNum === currentPage;
        return (
          <button
            key={`page-${pageNum}`}
            onClick={() => onPageChange(pageNum)}
            className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? `${activeBgColor} text-white shadow-sm`
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {pageNum}
          </button>
        );
      })}

      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

export default function AdminPanel({ currentLang, onInstallApp }: AdminPanelProps) {
  const t = TRANSLATIONS[currentLang];

  // Component States
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopeeOrders, setShopeeOrders] = useState<ShopeeOrder[]>([]);
  const [mapsReviews, setMapsReviews] = useState<MapsReview[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedShopeeId, setCopiedShopeeId] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [copiedReviewId, setCopiedReviewId] = useState<string | null>(null);
  const [tempAccountInput, setTempAccountInput] = useState<Record<string, string>>({});
  const [screenshotModalItem, setScreenshotModalItem] = useState<MapsReview | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'shopee_order' | 'order' | 'product' } | null>(null);
  
  // Tab states: 'orders' | 'shopee_orders' | 'maps_reviews' | 'keuangan' | 'settings'
  const [activeTab, setActiveTab] = useState<'orders' | 'shopee_orders' | 'maps_reviews' | 'keuangan' | 'settings'>('orders');
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);

  // Settings view nested tab states
  const [activeSettingsTab, setActiveSettingsTab] = useState<'products' | 'spreadsheet_integration' | 'account_access' | 'qris_config' | 'app_install'>('products');
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [spreadsheetModalTab, setSpreadsheetModalTab] = useState<'sync' | 'export' | 'import' | 'script'>('sync');

  // Google Sheets sync config state
  const [sheetsSyncConfig, setSheetsSyncConfigState] = useState(() => getSheetsSyncConfig());
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Custom credentials state for adminshp1..4
  const [adminshpCreds, setAdminshpCreds] = useState<Record<string, { username: string; password: string }>>(() => {
    const defaults = {
      adminshp1: { username: 'adminera', password: 'gmadminshp1' },
      adminshp2: { username: 'admincika', password: 'gmadminshp2' },
      adminshp3: { username: 'adminvira', password: 'gmadminshp3' },
      adminshp4: { username: 'adminali', password: 'gmadminshp4' }
    };
    try {
      const saved = localStorage.getItem('gm_adminshp_creds');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const result: any = {};
          for (const key of ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4']) {
            const u = parsed[key]?.username;
            const p = parsed[key]?.password;
            if (!u || u === key || u === 'adminshp1' || u === 'adminshp2' || u === 'adminshp3' || u === 'adminshp4') {
              result[key] = (defaults as any)[key];
            } else {
              result[key] = { username: u, password: p || (defaults as any)[key].password };
            }
          }
          return result;
        }
      }
    } catch (e) {}
    return defaults;
  });

  const [editingCreds, setEditingCreds] = useState(() => adminshpCreds);

  // Sync editingCreds when adminshpCreds changes
  useEffect(() => {
    setEditingCreds(adminshpCreds);
  }, [adminshpCreds]);

  // Synchronize validated credentials to localStorage on mount and changes
  useEffect(() => {
    try {
      localStorage.setItem('gm_adminshp_creds', JSON.stringify(adminshpCreds));
    } catch (e) {
      console.warn('Storage sync failed', e);
    }
  }, [adminshpCreds]);

  // Log activity logs state
  const [activityLogs, setActivityLogs] = useState<AdminShpLog[]>([]);

  // Function to reload logs
  const loadActivityLogs = () => {
    setActivityLogs(getAdminShpLogs());
  };

  // Reload activity logs on activeSettingsTab changes
  useEffect(() => {
    if (activeTab === 'settings' && activeSettingsTab === 'account_access') {
      loadActivityLogs();
    }
  }, [activeTab, activeSettingsTab]);

  const [selectedLogFilter, setSelectedLogFilter] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  const handleClearLogs = () => {
    if (confirm('Apakah Anda yakin ingin menghapus semua histori log aktifitas?')) {
      clearAdminShpLogs();
      setActivityLogs([]);
    }
  };

  // Filter logs reactively based on filter tabs and search input
  const filteredLogs = activityLogs.filter(log => {
    // 1. Filter by Slot
    if (selectedLogFilter !== 'all' && log.adminshp !== selectedLogFilter) {
      return false;
    }
    // 2. Filter by search query
    if (logSearchQuery.trim() !== '') {
      const q = logSearchQuery.toLowerCase();
      const actionMatch = log.action.toLowerCase().includes(q);
      const detailsMatch = (log.details || '').toLowerCase().includes(q);
      const slotMatch = log.adminshp.toLowerCase().includes(q);
      const customName = adminshpCreds[log.adminshp]?.username || '';
      const customNameMatch = customName.toLowerCase().includes(q);
      return actionMatch || detailsMatch || slotMatch || customNameMatch;
    }
    return true;
  });

  // Tab change lock ref to prevent hashchange resetting active tab back to orders
  const isTabClicking = useRef(false);

  // Search and Sort states for each table
  const [searchUnpaid, setSearchUnpaid] = useState('');
  const [sortUnpaid, setSortUnpaid] = useState<'all' | 'pending' | 'progress' | 'done'>('all');
  const [timeFilterUnpaid, setTimeFilterUnpaid] = useState<TimeFilterConfig>({ mode: 'all' });
  const [serviceFilterUnpaid, setServiceFilterUnpaid] = useState<string>('all');

  const [searchPaid, setSearchPaid] = useState('');
  const [sortPaid, setSortPaid] = useState<'all' | 'pending' | 'progress' | 'done'>('all');
  const [timeFilterPaid, setTimeFilterPaid] = useState<TimeFilterConfig>({ mode: 'all' });
  const [serviceFilterPaid, setServiceFilterPaid] = useState<string>('all');

  const [searchShopee, setSearchShopee] = useState('');
  const [sortShopee, setSortShopee] = useState<'all' | 'pending' | 'progress' | 'ready' | 'sudah_direkap' | 'done'>('all');
  const [timeFilterShopee, setTimeFilterShopee] = useState<TimeFilterConfig>({ mode: 'all' });
  const [shopeeTypeFilter, setShopeeTypeFilter] = useState<'all' | 'report' | 'spam_wa'>('all');

  const [searchReview, setSearchReview] = useState('');
  const [sortReview, setSortReview] = useState<'all' | 'pending' | 'progress' | 'ready' | 'sudah_direkap' | 'done'>('all');
  const [timeFilterReview, setTimeFilterReview] = useState<TimeFilterConfig>({ mode: 'all' });
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'SEMUA' | 'TRIPAD' | 'GMAPS' | 'REVIEW APPS'>('SEMUA');

  // Pagination states
  const [pageUnpaid, setPageUnpaid] = useState(1);
  const [pagePaid, setPagePaid] = useState(1);
  const [pageShopee, setPageShopee] = useState(1);
  const [pageReview, setPageReview] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => { setPageUnpaid(1); }, [searchUnpaid, serviceFilterUnpaid, sortUnpaid, timeFilterUnpaid]);
  useEffect(() => { setPagePaid(1); }, [searchPaid, serviceFilterPaid, sortPaid, timeFilterPaid]);
  useEffect(() => { setPageShopee(1); }, [searchShopee, shopeeTypeFilter, sortShopee, timeFilterShopee]);
  useEffect(() => { setPageReview(1); }, [searchReview, reviewTypeFilter, sortReview, timeFilterReview]);

  const isWithinTimeframe = (createdAtStr: string | undefined, timeframe: TimeFilterConfig | string) => {
    return isWithinCustomTimeframe(createdAtStr, timeframe);
  };

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('gm_admin_auth') === 'true' || localStorage.getItem('gm_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const recentLocalStatusUpdates = useRef<Map<string, { status: string; timestamp: number }>>(new Map());

  // Authentication handlers
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'gmadmin') {
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem('gm_admin_auth', 'true');
        localStorage.setItem('gm_admin_auth', 'true');
      } catch (err) {
        console.warn('Storage restricted', err);
      }
      setAuthError('');
      window.dispatchEvent(new CustomEvent('admin-auth-change'));
    } else {
      setAuthError(currentLang === 'id' ? 'Username atau password salah!' : 'Invalid username or password!');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem('gm_admin_auth');
      localStorage.removeItem('gm_admin_auth');
    } catch (err) {
      console.warn('Storage restricted', err);
    }
    setUsername('');
    setPassword('');
    window.dispatchEvent(new CustomEvent('admin-auth-change'));
  };

  // Listen to custom navbar events
  useEffect(() => {
    const onNavbarLogout = () => {
      handleLogout();
    };
    const onNavbarRefresh = () => {
      loadDashboardData();
    };
    const onNavigateKeuangan = () => {
      setActiveTab('keuangan');
      window.history.pushState(null, '', '/admin/keuangan');
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    const onNavigateKatalog = () => {
      setActiveTab('settings');
      setActiveSettingsTab('products');
      window.history.pushState(null, '', '/admin/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    const onNavigateSheets = () => {
      setActiveTab('settings');
      setActiveSettingsTab('spreadsheet_integration');
      window.history.pushState(null, '', '/admin/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
    };

    window.addEventListener('admin-logout', onNavbarLogout);
    window.addEventListener('admin-refresh', onNavbarRefresh);
    window.addEventListener('admin-navigate-keuangan', onNavigateKeuangan);
    window.addEventListener('admin-navigate-katalog', onNavigateKatalog);
    window.addEventListener('admin-navigate-sheets', onNavigateSheets);

    return () => {
      window.removeEventListener('admin-logout', onNavbarLogout);
      window.removeEventListener('admin-refresh', onNavbarRefresh);
      window.removeEventListener('admin-navigate-keuangan', onNavigateKeuangan);
      window.removeEventListener('admin-navigate-katalog', onNavigateKatalog);
      window.removeEventListener('admin-navigate-sheets', onNavigateSheets);
    };
  }, []);

  // Product CRUD Modal/Form states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodNameEn, setProdNameEn] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodDescEn, setProdDescEn] = useState('');
  const [prodPrice, setProdPrice] = useState(10000);
  const [prodImage, setProdImage] = useState('');
  const [prodWa, setProdWa] = useState('+6285921095666');
  const [prodTargetType, setProdTargetType] = useState<'link' | 'phone'>('link');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Order edit modal state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderBuyerName, setOrderBuyerName] = useState('');
  const [orderPhoneNumber, setOrderPhoneNumber] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderTargetLink, setOrderTargetLink] = useState('');
  const [orderTargetSpamPhone, setOrderTargetSpamPhone] = useState('');
  const [orderProductId, setOrderProductId] = useState('');
  const [orderTotalPrice, setOrderTotalPrice] = useState(0);

  const handleOpenEditOrder = (order: Order) => {
    setEditingOrder(order);
    setOrderBuyerName(order.buyer_name || '');
    setOrderPhoneNumber(order.phone_number || '');
    setOrderQuantity(order.quantity || 1);
    setOrderNotes(order.notes || '');
    setOrderTargetLink(order.target_link || '');
    setOrderTargetSpamPhone(order.target_spam_phone || '');
    setOrderProductId(order.product_id || '');
    setOrderTotalPrice(order.total_price || 0);
    setIsOrderModalOpen(true);
  };

  // Recalculate total price when product or quantity changes
  useEffect(() => {
    if (editingOrder && orderProductId) {
      const selectedProduct = products.find(p => p.id === orderProductId);
      if (selectedProduct) {
        setOrderTotalPrice(selectedProduct.price * orderQuantity);
      }
    }
  }, [orderProductId, orderQuantity, products, editingOrder]);

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    try {
      const selectedProduct = products.find(p => p.id === orderProductId);
      const updatedData: Partial<Order> = {
        buyer_name: orderBuyerName,
        phone_number: orderPhoneNumber,
        quantity: orderQuantity,
        notes: orderNotes,
        target_link: orderTargetLink,
        target_spam_phone: orderTargetSpamPhone,
        product_id: orderProductId,
        product_name: selectedProduct ? selectedProduct.name : editingOrder.product_name,
        total_price: orderTotalPrice,
      };

      await dbUpdateOrder(editingOrder.id, updatedData);
      toast.success(currentLang === 'id' ? 'Pesanan berhasil diperbarui' : 'Order updated successfully');
      setIsOrderModalOpen(false);
      setEditingOrder(null);
      
      // Reload order states
      const ordsData = await dbGetOrders();
      setOrders(ordsData);
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? 'Gagal memperbarui pesanan' : 'Failed to update order');
    }
  };

  // Shopee order edit state
  const [editingShopeeOrder, setEditingShopeeOrder] = useState<ShopeeOrder | null>(null);
  const [isShopeeModalOpen, setIsShopeeModalOpen] = useState(false);
  const [editShpStoreName, setEditShpStoreName] = useState('');
  const [editShpBuyerName, setEditShpBuyerName] = useState('');
  const [editShpServiceType, setEditShpServiceType] = useState('');
  const [editShpQuantity, setEditShpQuantity] = useState(1);
  const [editShpTargetLink, setEditShpTargetLink] = useState('');
  const [editShpNotes, setEditShpNotes] = useState('');

  // Maps review edit state
  const [editingMapsReview, setEditingMapsReview] = useState<MapsReview | null>(null);
  const [isMapsModalOpen, setIsMapsModalOpen] = useState(false);
  const [editMapsClientName, setEditMapsClientName] = useState('');
  const [editMapsStoreName, setEditMapsStoreName] = useState('');
  const [editMapsLink, setEditMapsLink] = useState('');
  const [editMapsTargetCount, setEditMapsTargetCount] = useState(5);
  const [editMapsNotes, setEditMapsNotes] = useState('');
  const [editMapsReviewType, setEditMapsReviewType] = useState<'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS'>('G_MAPS');
  const [editMapsAccounts, setEditMapsAccounts] = useState<string[]>([]);

  const handleOpenEditShopee = (order: ShopeeOrder) => {
    setEditingShopeeOrder(order);
    setEditShpStoreName(order.store_name || '');
    setEditShpBuyerName(order.buyer_name || '');
    setEditShpServiceType(order.service_type || '');
    setEditShpQuantity(order.quantity || 1);
    setEditShpTargetLink(order.target_link || '');
    setEditShpNotes(order.notes || '');
    setIsShopeeModalOpen(true);
  };

  const handleSaveShopeeOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShopeeOrder) return;
    try {
      const updated: Partial<ShopeeOrder> = {
        store_name: editShpStoreName,
        buyer_name: editShpBuyerName,
        service_type: editShpServiceType,
        quantity: editShpQuantity,
        target_link: editShpTargetLink,
        notes: editShpNotes
      };
      await dbUpdateShopeeOrder(editingShopeeOrder.id, updated);
      toast.success(currentLang === 'id' ? 'Pesanan Shopee berhasil diperbarui' : 'Shopee order updated successfully');
      setIsShopeeModalOpen(false);
      setEditingShopeeOrder(null);
      // Reload lists
      const data = await dbGetShopeeOrders();
      setShopeeOrders(data);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui pesanan Shopee');
    }
  };

  const handleOpenEditMaps = (review: MapsReview) => {
    setEditingMapsReview(review);
    setEditMapsClientName(review.client_name || '');
    setEditMapsStoreName(review.store_name || '');
    setEditMapsLink(review.maps_link || '');
    setEditMapsTargetCount(review.target_count || 5);
    setEditMapsNotes(review.notes || '');
    setEditMapsReviewType(review.review_type as any || 'G_MAPS');
    setEditMapsAccounts(review.reviewer_accounts || []);
    setIsMapsModalOpen(true);
  };

  const handleSaveMapsReviewEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMapsReview) return;
    try {
      const updated: Partial<MapsReview> = {
        client_name: editMapsClientName,
        store_name: editMapsStoreName,
        maps_link: editMapsLink,
        target_count: editMapsTargetCount,
        notes: editMapsNotes,
        review_type: editMapsReviewType,
        reviewer_accounts: editMapsAccounts,
        status: editingMapsReview.status
      };
      await dbUpdateMapsReview(editingMapsReview.id, updated);
      toast.success(currentLang === 'id' ? 'Review Maps berhasil diperbarui' : 'Maps review updated successfully');
      setIsMapsModalOpen(false);
      setEditingMapsReview(null);
      // Reload lists with forceRefresh
      const data = await dbGetMapsReviews(10000, true);
      setMapsReviews(data);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui review Maps');
    }
  };

  // Online Export Settings State
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportOrderType, setExportOrderType] = useState<'orders' | 'shopee_orders' | 'maps_reviews'>('orders');
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({
    id: true,
    created_at: true,
    buyer_name: true,
    whatsapp_number: true,
    product_name: true,
    target_link: true,
    status: true,
    payment_method: true,
    price: true,
    notes: true,
    created_by: true,
    store_name: true,
    service_type: true,
    quantity: true,
    job_status: true,
    worker_assigned: true,
    client_name: true,
    review_type: true,
    maps_link: true,
    progress: true,
    done_count: true,
    target_count: true,
    reviewer_accounts: true,
    worker: true,
    proof_link: true,
  });

  // Filtered exports based on Date Range
  const filteredOrdersExport = orders.filter(order => {
    if (!order.created_at) return true;
    const orderDate = order.created_at.substring(0, 10);
    if (exportStartDate && orderDate < exportStartDate) return false;
    if (exportEndDate && orderDate > exportEndDate) return false;
    return true;
  });

  const filteredShopeeExport = shopeeOrders.filter(order => {
    if (!order.created_at) return true;
    const orderDate = order.created_at.substring(0, 10);
    if (exportStartDate && orderDate < exportStartDate) return false;
    if (exportEndDate && orderDate > exportEndDate) return false;
    return true;
  });

  const filteredMapsExport = mapsReviews.filter(review => {
    if (!review.created_at) return true;
    const reviewDate = review.created_at.substring(0, 10);
    if (exportStartDate && reviewDate < exportStartDate) return false;
    if (exportEndDate && reviewDate > exportEndDate) return false;
    return true;
  });

  // Client-side automatic CSV download handler
  const handleDownloadCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let fileName = '';

    if (exportOrderType === 'orders') {
      fileName = `pesanan_layanan_umum_${new Date().toISOString().substring(0, 10)}.csv`;
      const colDefs = [
        { key: 'id', label: 'ID Pesanan' },
        { key: 'created_at', label: 'Tanggal Input' },
        { key: 'buyer_name', label: 'Nama Pembeli' },
        { key: 'whatsapp_number', label: 'No WhatsApp' },
        { key: 'product_name', label: 'Nama Layanan' },
        { key: 'target_link', label: 'Link Target' },
        { key: 'price', label: 'Harga' },
        { key: 'payment_method', label: 'Metode Bayar' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Catatan' },
        { key: 'created_by', label: 'Admin Input' },
      ];
      const activeCols = colDefs.filter(col => exportColumns[col.key]);
      headers = activeCols.map(c => c.label);

      rows = filteredOrdersExport.map(item => {
        return activeCols.map(col => {
          if (col.key === 'id') return item.id || '';
          if (col.key === 'created_at') return item.created_at ? item.created_at.substring(0, 16).replace('T', ' ') : '-';
          if (col.key === 'buyer_name') return item.buyer_name || '';
          if (col.key === 'whatsapp_number') return item.phone_number || '';
          if (col.key === 'product_name') return item.product_name || '';
          if (col.key === 'target_link') return item.target_link || item.target_spam_phone || '';
          if (col.key === 'price') return String(item.total_price || 0);
          if (col.key === 'payment_method') return item.payment_status || '';
          if (col.key === 'status') return item.worker_status || item.payment_status || '';
          if (col.key === 'notes') return item.notes || '';
          if (col.key === 'created_by') return getSlotIndicatorName(item.created_by || '');
          return '';
        });
      });
    } else if (exportOrderType === 'shopee_orders') {
      fileName = `pesanan_shopee_${new Date().toISOString().substring(0, 10)}.csv`;
      const colDefs = [
        { key: 'id', label: 'ID Pesanan' },
        { key: 'created_at', label: 'Tanggal Input' },
        { key: 'store_name', label: 'Nama Toko' },
        { key: 'buyer_name', label: 'Nama Pembeli' },
        { key: 'service_type', label: 'Tipe Jasa' },
        { key: 'quantity', label: 'Jumlah (Qty)' },
        { key: 'target_link', label: 'Target WA/Link' },
        { key: 'job_status', label: 'Status Kerja' },
        { key: 'worker_assigned', label: 'Pekerja' },
        { key: 'notes', label: 'Catatan' },
        { key: 'created_by', label: 'Admin Input' },
      ];
      const activeCols = colDefs.filter(col => exportColumns[col.key]);
      headers = activeCols.map(c => c.label);

      rows = filteredShopeeExport.map(item => {
        return activeCols.map(col => {
          if (col.key === 'id') return item.id || '';
          if (col.key === 'created_at') return item.created_at ? item.created_at.substring(0, 16).replace('T', ' ') : '-';
          if (col.key === 'store_name') return item.store_name || '';
          if (col.key === 'buyer_name') return item.buyer_name || '';
          if (col.key === 'service_type') return item.service_type || '';
          if (col.key === 'quantity') return String(item.quantity || 1);
          if (col.key === 'target_link') return item.target_link || '';
          if (col.key === 'job_status') return item.status || '';
          if (col.key === 'worker_assigned') return item.worker_id ? getSlotIndicatorName(item.worker_id) : '-';
          if (col.key === 'notes') return item.notes || '';
          if (col.key === 'created_by') return getSlotIndicatorName(item.created_by || '');
          return '';
        });
      });
    } else if (exportOrderType === 'maps_reviews') {
      fileName = `target_maps_reviews_${new Date().toISOString().substring(0, 10)}.csv`;
      const colDefs = [
        { key: 'worker', label: 'Worker' },
        { key: 'created_at', label: 'Tanggal Input' },
        { key: 'client_name', label: 'NAMA KLIEN' },
        { key: 'store_name', label: 'Nama Toko' },
        { key: 'review_type', label: 'Tipe Review' },
        { key: 'maps_link', label: 'Link MAPS' },
        { key: 'progress', label: 'PROGRES (Selesai/Target)' },
        { key: 'done_count', label: 'Jumlah Selesai' },
        { key: 'target_count', label: 'Target Akun' },
        { key: 'reviewer_accounts', label: 'Daftar Akun Reviewer' },
        { key: 'notes', label: 'Clue / Catatan' },
        { key: 'status', label: 'Status' },
        { key: 'created_by', label: 'ADMIN BY' },
        { key: 'proof_link', label: 'Link Bukti' },
      ];
      const activeCols = colDefs.filter(col => exportColumns[col.key]);
      headers = activeCols.map(c => c.label);

      rows = filteredMapsExport.map(item => {
        const rawAccounts: any = item.reviewer_accounts;
        const accounts: string[] = Array.isArray(rawAccounts)
          ? rawAccounts
          : (typeof rawAccounts === 'string' && rawAccounts
            ? rawAccounts.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean)
            : []);
        const doneCount = accounts.length;
        const targetCount = item.target_count || 1;
        const progressFormatted = `${doneCount}/${targetCount}`;

        return activeCols.map(col => {
          if (col.key === 'worker') return 'prima';
          if (col.key === 'created_at') return item.created_at ? item.created_at.substring(0, 19).replace('T', ' ') : '';
          if (col.key === 'client_name') return item.client_name || '';
          if (col.key === 'store_name') return item.store_name || '';
          if (col.key === 'review_type') return item.review_type || 'G_MAPS';
          if (col.key === 'maps_link') return item.maps_link || '';
          if (col.key === 'progress') return progressFormatted;
          if (col.key === 'done_count') return String(doneCount);
          if (col.key === 'target_count') return String(targetCount);
          if (col.key === 'reviewer_accounts') return accounts.join(', ');
          if (col.key === 'notes') return item.notes || '';
          if (col.key === 'status') return item.status || 'PENDING';
          if (col.key === 'created_by') return getSlotIndicatorName(item.created_by || '');
          if (col.key === 'proof_link') return item.proof_link || '';
          return '';
        });
      });
    }

    if (headers.length === 0) {
      toast.error('Harap pilih minimal satu kolom untuk diekspor!');
      return;
    }

    const escapeCSV = (val: string) => {
      let clean = val.replace(/"/g, '""');
      if (clean.includes(',') || clean.includes('\n') || clean.includes('\r') || clean.includes('"')) {
        clean = `"${clean}"`;
      }
      return clean;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Berhasil mengunduh file CSV: ${fileName}`);
  };

  // Load Admin Dashboard Data
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const loadDashboardData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const prodsData = await dbGetProducts();
      setProducts(prodsData);

      const ordsData = await dbGetOrders();
      setOrders(ordsData);

      const shopeeData = await dbGetShopeeOrders();
      setShopeeOrders(shopeeData);

      const mapsData = await dbGetMapsReviews();
      setMapsReviews(mapsData);

      const statsData = await dbGetDashboardStats();
      setStats(statsData);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(currentLang === 'id' ? 'Gagal memuat data dashboard.' : 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();

      // Clean old lock entries older than 60s
      recentLocalStatusUpdates.current.forEach((val, key) => {
        if (now - val.timestamp > 60000) {
          recentLocalStatusUpdates.current.delete(key);
        }
      });

      dbGetProducts(10000, true).then(prodsData => setProducts(prodsData)).catch(err => console.error(err));

      dbGetOrders(10000, true).then(ordsData => {
        setOrders(prev => {
          if (!prev || prev.length === 0) return ordsData;
          return ordsData.map(newItem => {
            const lock = recentLocalStatusUpdates.current.get(newItem.id);
            if (lock && (now - lock.timestamp < 60000)) {
              return { ...newItem, payment_status: lock.status as PaymentStatus };
            }
            return newItem;
          });
        });
      }).catch(err => console.error(err));

      dbGetShopeeOrders(10000, true).then(shopeeData => {
        setShopeeOrders(prev => {
          if (!prev || prev.length === 0) return shopeeData;
          return shopeeData.map(newItem => {
            const lock = recentLocalStatusUpdates.current.get(newItem.id);
            if (lock && (now - lock.timestamp < 60000)) {
              return { ...newItem, status: lock.status as any };
            }
            return newItem;
          });
        });
      }).catch(err => console.error(err));

      dbGetMapsReviews(10000, true).then(mapsData => {
        setMapsReviews(prev => {
          if (!prev || prev.length === 0) return mapsData;
          return mapsData.map(newItem => {
            const existing = prev.find(p => p.id === newItem.id);
            const lock = recentLocalStatusUpdates.current.get(newItem.id);
            let finalStatus = newItem.status;
            if (lock && (now - lock.timestamp < 60000)) {
              finalStatus = lock.status as any;
            }
            if (existing) {
              const existingAccounts = existing.reviewer_accounts || [];
              const newAccounts = newItem.reviewer_accounts || [];
              const mergedAccounts = existingAccounts.length > newAccounts.length ? existingAccounts : newAccounts;
              return {
                ...newItem,
                status: finalStatus,
                reviewer_accounts: mergedAccounts
              };
            }
            return {
              ...newItem,
              status: finalStatus
            };
          });
        });
      }).catch(err => console.error(err));

      dbGetDashboardStats().then(statsData => setStats(statsData)).catch(err => console.error(err));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkLocationRoute = () => {
      if (isTabClicking.current) return;
      const pathname = window.location.pathname;
      if (pathname === '/admin/settings' || pathname === '/admin/settings/') {
        setActiveTab('settings');
      } else if (pathname === '/admin/devpayroll' || pathname === '/admin/devpayroll/' || pathname === '/admin/keuangan' || pathname === '/admin/keuangan/') {
        setActiveTab('keuangan');
      } else if (pathname === '/admin' || pathname === '/admin/') {
        setActiveTab(prev => (prev === 'settings' || prev === 'keuangan') ? 'orders' : prev);
      }
    };
    checkLocationRoute();
    window.addEventListener('popstate', checkLocationRoute);
    return () => {
      window.removeEventListener('popstate', checkLocationRoute);
    };
  }, [isAuthenticated]);

  // Handle Order Status Update
  const handleUpdateOrderStatus = async (orderId: string, newStatus: PaymentStatus) => {
    // 1. Lock and optimistic update
    recentLocalStatusUpdates.current.set(orderId, { status: newStatus, timestamp: Date.now() });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: newStatus } : o));

    try {
      await dbUpdateOrder(orderId, { payment_status: newStatus });
      const updatedStats = await dbGetDashboardStats();
      setStats(updatedStats);
      toast.success(currentLang === 'id' ? `Status pesanan diubah ke ${newStatus}` : `Order status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      recentLocalStatusUpdates.current.delete(orderId);
      toast.error(currentLang === 'id' ? 'Gagal mengubah status.' : 'Failed to update status.');
    }
  };

  // Shopee Orders management handlers
  const handleUpdateShopeeWorker = async (id: string, workerId: string) => {
    try {
      await dbUpdateShopeeOrder(id, { worker_id: workerId });
      setShopeeOrders(prev => prev.map(o => o.id === id ? { ...o, worker_id: workerId } : o));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui worker Shopee');
    }
  };

  const handleUpdateShopeeWorkOrder = async (id: string, workOrder: string) => {
    try {
      await dbUpdateShopeeOrder(id, { work_order: workOrder });
      setShopeeOrders(prev => prev.map(o => o.id === id ? { ...o, work_order: workOrder } : o));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui work order Shopee');
    }
  };

  const handleUpdateShopeeStatus = async (id: string, status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE') => {
    // 1. Lock and optimistic update
    recentLocalStatusUpdates.current.set(id, { status, timestamp: Date.now() });
    setShopeeOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));

    try {
      const updated = await dbUpdateShopeeOrder(id, { status });
      if (updated) {
        setShopeeOrders(prev => prev.map(o => o.id === id ? { ...o, ...updated, status: updated.status || status } : o));
      }
      toast.success(currentLang === 'id' ? `Status Shopee diubah ke ${status}` : `Shopee status updated to ${status}`);
    } catch (err) {
      console.error(err);
      recentLocalStatusUpdates.current.delete(id);
      toast.error('Gagal memperbarui status Shopee');
    }
  };

  const handleUpdateMapsStatus = async (id: string, status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE') => {
    // 1. Lock and optimistic update
    recentLocalStatusUpdates.current.set(id, { status, timestamp: Date.now() });
    setMapsReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));

    try {
      const updated = await dbUpdateMapsReview(id, { status });
      if (updated) {
        setMapsReviews(prev => prev.map(r => r.id === id ? { ...r, ...updated, status: updated.status || status } : r));
      }
      toast.success(currentLang === 'id' ? `Status Review diubah ke ${status}` : `Review status updated to ${status}`);
    } catch (err) {
      console.error(err);
      recentLocalStatusUpdates.current.delete(id);
      toast.error('Gagal memperbarui status Review');
    }
  };

  const handleUpdateProofLink = async (reviewId: string, value: string) => {
    try {
      await dbUpdateMapsReview(reviewId, {
        proof_link: value
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, proof_link: value } : r));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNotes = async (reviewId: string, value: string) => {
    try {
      await dbUpdateMapsReview(reviewId, {
        notes: value
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, notes: value } : r));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMapsReview = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus laporan review ini?')) {
      try {
        await dbDeleteMapsReview(id);
        setMapsReviews(prev => prev.filter(r => r.id !== id));
        toast.success(currentLang === 'id' ? 'Laporan review berhasil dihapus!' : 'Review report successfully deleted!');
      } catch (err) {
        console.error(err);
        toast.error('Gagal menghapus laporan review');
      }
    }
  };

  // Add Reviewer Account Name to specific Maps Review item
  const handleAddReviewerAccount = async (reviewId: string) => {
    const rawInput = tempAccountInput[reviewId]?.trim();
    if (!rawInput) return;

    const targetReview = mapsReviews.find(r => r.id === reviewId);
    if (!targetReview) return;

    const parsedNames = parseAccountsList(rawInput);
    const namesToAdd = parsedNames.length > 0 ? parsedNames : [rawInput];

    const currentAccounts = Array.isArray(targetReview.reviewer_accounts) ? targetReview.reviewer_accounts : [];
    const updatedAccounts = [...currentAccounts, ...namesToAdd];

    // Optimistically update UI immediately so count & progress bar increment in real-time
    setMapsReviews(prev => prev.map(r => r.id === reviewId ? {
      ...r,
      reviewer_accounts: updatedAccounts,
      status: (r.status === 'PENDING' && updatedAccounts.length > 0) ? 'PROGRESS' : r.status
    } : r));
    setTempAccountInput(prev => ({ ...prev, [reviewId]: '' }));

    try {
      const saved = await dbUpdateMapsReview(reviewId, {
        reviewer_accounts: updatedAccounts
      });
      if (saved && Array.isArray(saved.reviewer_accounts)) {
        const finalAccounts = saved.reviewer_accounts.length >= updatedAccounts.length
          ? saved.reviewer_accounts
          : updatedAccounts;
        setMapsReviews(prev => prev.map(r => r.id === reviewId ? {
          ...r,
          ...saved,
          reviewer_accounts: finalAccounts
        } : r));
      }
      logAdminShpAction('Main Admin', 'Tambah Reviewer', `Menambahkan ${namesToAdd.length} akun reviewer ("${namesToAdd.join(', ')}") ke review store "${targetReview.store_name}"`);
    } catch (err) {
      console.error(err);
      // Revert optimistic update on failure
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reviewer_accounts: currentAccounts } : r));
      toast.error(currentLang === 'id' ? `Gagal menambah akun progres: ${err instanceof Error ? err.message : String(err)}` : `Failed to add progress account: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Remove Reviewer Account Name
  const handleRemoveReviewerAccount = async (reviewId: string, indexToRemove: number) => {
    const targetReview = mapsReviews.find(r => r.id === reviewId);
    if (!targetReview) return;

    const currentAccounts = Array.isArray(targetReview.reviewer_accounts) ? targetReview.reviewer_accounts : [];
    const updatedAccounts = currentAccounts.filter((_, idx) => idx !== indexToRemove);

    // Optimistically update UI immediately
    setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reviewer_accounts: updatedAccounts } : r));

    try {
      const saved = await dbUpdateMapsReview(reviewId, {
        reviewer_accounts: updatedAccounts
      });
      if (saved && Array.isArray(saved.reviewer_accounts)) {
        setMapsReviews(prev => prev.map(r => r.id === reviewId ? {
          ...r,
          ...saved,
          reviewer_accounts: saved.reviewer_accounts
        } : r));
      }
      logAdminShpAction('Main Admin', 'Hapus Reviewer', `Menghapus akun reviewer dari review store "${targetReview.store_name}"`);
    } catch (err) {
      console.error(err);
      // Revert optimistic update on failure
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reviewer_accounts: currentAccounts } : r));
      toast.error('Gagal menghapus akun progres.');
    }
  };

  // Helper to generate a highly polished single-page PDF of Google Maps Reviewers list
  const handleExportPDF = async (item: MapsReview) => {
    try {
      await generateMapsReportPDF(item, item.created_by);
      toast.success("PDF Laporan berhasil diunduh!");
    } catch (err) {
      console.error("Gagal mengekspor PDF:", err);
      toast.error("Terjadi kesalahan saat memproses PDF.");
    }
  };

  const handleDeleteShopeeOrder = (id: string) => {
    setDeleteConfirm({ id, type: 'shopee_order' });
  };

  const executeDeleteShopeeOrder = async (id: string) => {
    try {
      await dbDeleteShopeeOrder(id);
      setShopeeOrders(prev => prev.filter(o => o.id !== id));
      setDeleteConfirm(null);
      toast.success(currentLang === 'id' ? 'Pesanan Shopee berhasil dihapus!' : 'Shopee order successfully deleted!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus pesanan Shopee');
    }
  };

  // Handle manual worker assignment by admin
  const handleUpdateOrderWorker = async (orderId: string, workerId: string) => {
    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) return;
      const newStatus = workerId ? 'taken' : 'unassigned';
      const updatePayload: Partial<Order> = {
        worker_id: workerId || undefined,
        worker_status: newStatus
      };
      await dbUpdateOrder(orderId, updatePayload);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatePayload } : o));
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? 'Gagal mengupdate worker.' : 'Failed to update worker.');
    }
  };

  // Handle worker job status override by admin
  const handleUpdateWorkerStatus = async (orderId: string, status: 'unassigned' | 'taken' | 'done') => {
    try {
      const updatePayload: Partial<Order> = {
        worker_status: status,
      };
      await dbUpdateOrder(orderId, updatePayload);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatePayload } : o));
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? 'Gagal memperbarui status pengerjaan.' : 'Failed to update job status.');
    }
  };

  // Handle Order Delete
  const handleDeleteOrder = (orderId: string) => {
    setDeleteConfirm({ id: orderId, type: 'order' });
  };

  const executeDeleteOrder = async (orderId: string) => {
    try {
      await dbDeleteOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      
      const updatedStats = await dbGetDashboardStats();
      setStats(updatedStats);
      setDeleteConfirm(null);
      toast.success(currentLang === 'id' ? 'Pesanan berhasil dihapus!' : 'Order deleted successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Error deleting order');
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedImageFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
      } else {
        toast.error(currentLang === 'id' ? 'Hanya diperbolehkan mengunggah file gambar!' : 'Only image files are allowed!');
      }
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Translate text helper via Gemini API
  const translateText = async (text: string): Promise<string> => {
    if (!text) return '';
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        return data.translation;
      }
    } catch (err) {
      console.error('Translation error, using fallback:', err);
    }
    return text; // fallback to original if translation fails
  };

  // Handle Product Save (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodPrice) return;

    setIsSavingProduct(true);
    try {
      let imageUrl = prodImage || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80';

      // 1. Upload photo if selected
      if (selectedImageFile) {
        try {
          imageUrl = await dbUploadProductImage(selectedImageFile);
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          toast.error(currentLang === 'id' 
            ? 'Gagal mengunggah gambar ke Supabase Storage. Silakan coba lagi.' 
            : 'Failed to upload image to Supabase Storage. Please try again.'
          );
          setIsSavingProduct(false);
          return;
        }
      }

      // 2. Perform auto-translation for English fields if they are empty
      let finalNameEn = prodNameEn ? prodNameEn.trim() : '';
      let finalDescEn = prodDescEn ? prodDescEn.trim() : '';

      if (!finalNameEn && prodName) {
        finalNameEn = await translateText(prodName);
      }
      if (!finalDescEn && prodDesc) {
        finalDescEn = await translateText(prodDesc);
      }

      const payload: Partial<Product> = {
        name: prodName,
        name_en: finalNameEn,
        description: prodDesc,
        description_en: finalDescEn,
        price: Number(prodPrice),
        image_url: imageUrl,
        whatsapp_number: prodWa,
        target_type: prodTargetType
      };

      if (editingProduct) {
        await dbUpdateProduct(editingProduct.id, payload);
        toast.success(currentLang === 'id' ? 'Katalog berhasil diperbarui!' : 'Catalog updated successfully!');
      } else {
        await dbCreateProduct(payload);
        toast.success(currentLang === 'id' ? 'Katalog baru berhasil ditambahkan!' : 'New catalog added successfully!');
      }

      setIsProductModalOpen(false);
      setEditingProduct(null);
      setSelectedImageFile(null);
      setImagePreviewUrl('');
      // Reload everything
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' 
        ? `Gagal menyimpan produk: ${err instanceof Error ? err.message : String(err)}` 
        : `Error saving product: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Open Product modal for create
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdNameEn('');
    setProdDesc('');
    setProdDescEn('');
    setProdPrice(10000);
    setProdImage('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80');
    setProdWa('+6285921095666');
    setProdTargetType('link');
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setIsSavingProduct(false);
    setIsProductModalOpen(true);
  };

  // Open Product modal for edit
  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdNameEn(product.name_en);
    setProdDesc(product.description);
    setProdDescEn(product.description_en);
    setProdPrice(product.price);
    setProdImage(product.image_url);
    setProdWa(product.whatsapp_number);
    setProdTargetType(product.target_type || 'link');
    setSelectedImageFile(null);
    setImagePreviewUrl(product.image_url);
    setIsSavingProduct(false);
    setIsProductModalOpen(true);
  };

  // Handle Product Delete
  const handleDeleteProduct = (productId: string) => {
    setDeleteConfirm({ id: productId, type: 'product' });
  };

  const executeDeleteProduct = async (productId: string) => {
    try {
      await dbDeleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      
      const updatedStats = await dbGetDashboardStats();
      setStats(updatedStats);
      setDeleteConfirm(null);
      toast.success(currentLang === 'id' ? 'Produk katalog berhasil dihapus!' : 'Catalog product deleted successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Error deleting product');
    }
  };

  // Safe percentage calculator
  const getCompletedPercentage = () => {
    if (!stats || stats.totalOrders === 0) return 0;
    return Math.round((stats.completedOrders / stats.totalOrders) * 100);
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8" id="admin-login-wrapper">
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-2">
              <Database className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight font-sans">
              Admin Portal
            </h2>
            <p className="text-xs text-slate-400 font-medium font-sans">
              GM AGENCY Internal Database Access
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {authError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3.5 text-xs font-bold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer mt-2 font-sans"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered and Sorted Web Orders
  const filteredUnpaidOrders = orders
    .filter(o => o.payment_status !== 'PAID')
    .filter(o => isWithinTimeframe(o.created_at, timeFilterUnpaid))
    .filter(o => {
      if (serviceFilterUnpaid === 'all') return true;
      const prodName = products.find(p => p.id === serviceFilterUnpaid)?.name || '';
      return o.product_id === serviceFilterUnpaid || o.product_name === prodName;
    })
    .filter(o => {
      const isPending = !o.worker_status || o.worker_status === 'unassigned';
      const isProgress = o.worker_status === 'taken';
      const isDone = o.worker_status === 'done';
      if (sortUnpaid === 'pending') return isPending;
      if (sortUnpaid === 'progress') return isProgress;
      if (sortUnpaid === 'done') return isDone;
      return true;
    })
    .filter(o => {
      if (!searchUnpaid) return true;
      const q = searchUnpaid.toLowerCase();
      return (
        (o.id || '').toLowerCase().includes(q) ||
        (o.buyer_name || '').toLowerCase().includes(q) ||
        (o.phone_number || '').toLowerCase().includes(q) ||
        (o.product_name || '').toLowerCase().includes(q) ||
        (o.notes || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredPaidOrders = orders
    .filter(o => o.payment_status === 'PAID')
    .filter(o => isWithinTimeframe(o.created_at, timeFilterPaid))
    .filter(o => {
      if (serviceFilterPaid === 'all') return true;
      const prodName = products.find(p => p.id === serviceFilterPaid)?.name || '';
      return o.product_id === serviceFilterPaid || o.product_name === prodName;
    })
    .filter(o => {
      const isPending = !o.worker_status || o.worker_status === 'unassigned';
      const isProgress = o.worker_status === 'taken';
      const isDone = o.worker_status === 'done';
      if (sortPaid === 'pending') return isPending;
      if (sortPaid === 'progress') return isProgress;
      if (sortPaid === 'done') return isDone;
      return true;
    })
    .filter(o => {
      if (!searchPaid) return true;
      const q = searchPaid.toLowerCase();
      return (
        (o.id || '').toLowerCase().includes(q) ||
        (o.buyer_name || '').toLowerCase().includes(q) ||
        (o.phone_number || '').toLowerCase().includes(q) ||
        (o.product_name || '').toLowerCase().includes(q) ||
        (o.notes || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filtered and Sorted Shopee Orders
  const filteredShopeeOrders = shopeeOrders
    .filter(o => isWithinTimeframe(o.created_at, timeFilterShopee))
    .filter(o => {
      const stat = o.status || 'PENDING';
      if (sortShopee === 'pending') return stat === 'PENDING';
      if (sortShopee === 'progress') return stat === 'PROGRESS';
      if (sortShopee === 'ready') return stat === 'READY';
      if (sortShopee === 'sudah_direkap') return stat === 'SUDAH DIREKAP';
      if (sortShopee === 'done') return stat === 'DONE';
      return true;
    })
    .filter(o => {
      if (shopeeTypeFilter === 'report') return o.order_type === 'REPORT_ALL_SOSMED';
      if (shopeeTypeFilter === 'spam_wa') return o.order_type === 'SPAM_WA';
      return true;
    })
    .filter(o => {
      if (!searchShopee) return true;
      const q = searchShopee.toLowerCase();
      return (
        (o.id || '').toLowerCase().includes(q) ||
        (o.store_name || '').toLowerCase().includes(q) ||
        (o.buyer_name || '').toLowerCase().includes(q) ||
        (o.service_type || '').toLowerCase().includes(q) ||
        (o.target_link || '').toLowerCase().includes(q) ||
        (o.notes || '').toLowerCase().includes(q) ||
        (o.worker_id || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filtered and Sorted Maps Reviews
  const filteredMapsReviews = mapsReviews
    .filter(r => isWithinTimeframe(r.created_at, timeFilterReview))
    .filter(r => {
      const stat = r.status || 'PENDING';
      if (sortReview === 'pending') return stat === 'PENDING';
      if (sortReview === 'progress') return stat === 'PROGRESS';
      if (sortReview === 'ready') return stat === 'READY';
      if (sortReview === 'sudah_direkap') return stat === 'SUDAH DIREKAP';
      if (sortReview === 'done') return stat === 'DONE';
      return true;
    })
    .filter(r => {
      if (reviewTypeFilter === 'TRIPAD') {
        return r.review_type === 'TRIPAD';
      }
      if (reviewTypeFilter === 'GMAPS') {
        return r.review_type === 'G_MAPS' || !r.review_type;
      }
      if (reviewTypeFilter === 'REVIEW APPS') {
        return r.review_type === 'REVIEW_APPS';
      }
      return true;
    })
    .filter(r => {
      if (!searchReview) return true;
      const q = searchReview.toLowerCase();
      return (
        (r.id || '').toLowerCase().includes(q) ||
        (r.client_name || '').toLowerCase().includes(q) ||
        (r.store_name || '').toLowerCase().includes(q) ||
        (r.maps_link || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.review_type || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
    });

  const paginatedUnpaidOrders = filteredUnpaidOrders.slice((pageUnpaid - 1) * ITEMS_PER_PAGE, pageUnpaid * ITEMS_PER_PAGE);
  const paginatedPaidOrders = filteredPaidOrders.slice((pagePaid - 1) * ITEMS_PER_PAGE, pagePaid * ITEMS_PER_PAGE);
  const paginatedShopeeOrders = filteredShopeeOrders.slice((pageShopee - 1) * ITEMS_PER_PAGE, pageShopee * ITEMS_PER_PAGE);
  const paginatedMapsReviews = filteredMapsReviews.slice((pageReview - 1) * ITEMS_PER_PAGE, pageReview * ITEMS_PER_PAGE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="admin-panel-container">
      
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-4 text-sm font-semibold text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Conditionally hide the operational dashboard stats if activeTab is 'settings' or 'keuangan' */}
        {activeTab !== 'settings' && activeTab !== 'keuangan' && (
          <>
            {/* Quick Access Admin-SHP Bypass Portal */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Akses Cepat Portal Admin:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'].map((slot) => {
                  const name = slot === 'adminshp1' ? 'Era' : slot === 'adminshp2' ? 'Cika' : slot === 'adminshp3' ? 'Vira' : 'Ali';
                  const customUsername = adminshpCreds[slot]?.username;
                  const routeName = customUsername?.trim() || (slot === 'adminshp1' ? 'adminera' : slot === 'adminshp2' ? 'admincika' : slot === 'adminshp3' ? 'adminvira' : 'adminali');
                  return (
                    <button
                      key={slot}
                      onClick={() => {
                        try {
                          sessionStorage.setItem('gm_adminshp_auth', 'true');
                          sessionStorage.setItem('gm_adminshp_user', slot);
                          localStorage.setItem(`gm_adminshp_auth_${slot}`, 'true');
                          localStorage.setItem('gm_adminshp_user', slot);
                        } catch (e) {}
                        toast.success(`Berhasil masuk ke portal Admin ${name}!`);
                        window.history.pushState(null, '', `/${routeName}`);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:border-indigo-200 dark:hover:border-indigo-900 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      <Users className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      <span>Admin {name}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-medium opacity-75">@{routeName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. KINERJA OPERASIONAL DASHBOARD CARD - Clean, Realtime, No Financial Revenue Info */}
            {(() => {
              // Calculate realtime operational stats (Web + Shopee)
              const onProgressCount = 
                orders.filter(o => o.payment_status !== 'PAID' && o.worker_status !== 'done').length +
                shopeeOrders.filter(s => s.status !== 'DONE').length;

              const completedCount = 
                orders.filter(o => o.payment_status === 'PAID' || o.worker_status === 'done').length +
                shopeeOrders.filter(s => s.status === 'DONE').length;

              const totalOpOrders = orders.length + shopeeOrders.length;
              const completedOpPercentage = totalOpOrders > 0 ? Math.round((completedCount / totalOpOrders) * 100) : 0;

              return (
                <div id="stats-operational-overview" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Kinerja Operasional Dashboard
                      </h2>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Web Orders */}
                    <div className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                          <ShoppingBag className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Web Orders</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                          {orders.length} <span className="text-xs font-medium text-slate-400">pesanan</span>
                        </span>
                      </div>
                    </div>

                    {/* Shopee Orders */}
                    <div className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Shopee Orders</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                          {shopeeOrders.length} <span className="text-xs font-medium text-slate-400">pesanan</span>
                        </span>
                      </div>
                    </div>

                    {/* On Progress Orders */}
                    <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400">
                          <Clock className="h-4 w-4 animate-pulse" />
                        </div>
                        <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">On Progress Orders</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                          {onProgressCount} <span className="text-xs font-bold text-amber-600 dark:text-amber-400">proses</span>
                        </span>
                      </div>
                    </div>

                    {/* Completed Orders */}
                    <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Completed Orders</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                          {completedCount}
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-2">({completedOpPercentage}%)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
                          Khusus status "DONE"
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tab Navigations */}
            <div className="flex items-center border-b border-slate-200 mb-6">
              <button
                onClick={() => {
                  isTabClicking.current = true;
                  setActiveTab('orders');
                  window.history.pushState(null, '', '/admin');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  setTimeout(() => { isTabClicking.current = false; }, 50);
                }}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'orders'
                    ? 'border-blue-600 text-blue-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                id="tab-orders"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>{currentLang === 'id' ? 'Pesanan Web' : 'Web Orders'}</span>
              </button>

              <button
                onClick={() => {
                  isTabClicking.current = true;
                  setActiveTab('shopee_orders');
                  window.history.pushState(null, '', '/admin');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  setTimeout(() => { isTabClicking.current = false; }, 50);
                }}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'shopee_orders'
                    ? 'border-blue-600 text-blue-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                id="tab-shopee-orders"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>{currentLang === 'id' ? 'Pesanan Shopee' : 'Shopee Orders'}</span>
              </button>

              <button
                onClick={() => {
                  isTabClicking.current = true;
                  setActiveTab('maps_reviews');
                  window.history.pushState(null, '', '/admin');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  setTimeout(() => { isTabClicking.current = false; }, 50);
                }}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'maps_reviews'
                    ? 'border-blue-600 text-blue-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                id="tab-maps-reviews"
              >
                <Star className="h-4 w-4" />
                <span>Review Orders</span>
              </button>
            </div>
          </>
        )}

      {/* Loading state indicator */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Memuat data...</span>
        </div>
      ) : (
        <>
          {/* 2. ORDERS TAB CONTROLLER */}
          {activeTab === 'orders' && (
            <div className="space-y-6" id="admin-orders-list">
              
              {/* Search & Sort Bar for Unpaid Web Orders */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100/80 shadow-sm">
                <div className="relative w-full lg:w-80">
                  <input
                    type="text"
                    value={searchUnpaid}
                    onChange={(e) => setSearchUnpaid(e.target.value)}
                    placeholder="Cari pesanan pending (nama, no WA, layanan, notes)..."
                    className="w-full bg-white text-xs text-slate-700 rounded-xl px-4 py-2.5 outline-none border border-slate-200 focus:border-blue-500 font-sans shadow-sm"
                  />
                </div>
                
                {/* Beautiful Dragdown sorting / filtering controls */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                  {/* Tipe Jasa Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tipe Jasa:</span>
                    <select
                      value={serviceFilterUnpaid}
                      onChange={(e) => setServiceFilterUnpaid(e.target.value)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="all">SEMUA</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status / Progres Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Progres:</span>
                    <select
                      value={sortUnpaid}
                      onChange={(e) => setSortUnpaid(e.target.value as any)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="all">SEMUA</option>
                      <option value="pending">PENDING</option>
                      <option value="progress">PROGRES</option>
                      <option value="done">DONE</option>
                    </select>
                  </div>

                  {/* Timeframe Filter (Monthly Date Range Picker) */}
                  <MonthlyDateRangePicker
                    value={timeFilterUnpaid}
                    onChange={setTimeFilterUnpaid}
                    currentLang={currentLang}
                  />
                </div>
              </div>

              {/* TABLE 1: DAFTAR PESANAN TERBARU (BELUM LUNAS) */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50/60 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">
                      {currentLang === 'id' ? 'Pesanan Terbaru (Belum Lunas / Pending)' : 'Newest Orders (Unpaid / Pending)'}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full font-mono">
                    {filteredUnpaidOrders.length}
                  </span>
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[12%]" />
                      <col className="w-[18%]" />
                      <col className="w-[20%]" />
                      <col className="w-[22%]" />
                      <col className="w-[13%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                        <th className="px-4 py-3">ID / Tanggal</th>
                        <th className="px-4 py-3">Pembeli & No WA</th>
                        <th className="px-4 py-3">Layanan</th>
                        <th className="px-4 py-3">Target Details</th>
                        <th className="px-4 py-3">Total Harga</th>
                        <th className="px-4 py-3 text-center">Status / Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredUnpaidOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-semibold font-sans">
                            {currentLang === 'id' ? 'Tidak ada pesanan belum lunas.' : 'No unpaid or pending orders.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedUnpaidOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-slate-50/30 transition-colors">
                              {/* ID and Date */}
                              <td className="px-4 py-3 font-mono">
                                <span className="font-bold text-slate-900 block truncate">{order.id}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                  {new Date(order.created_at).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {order.created_by && (
                                  <span className="text-[9px] text-orange-600 font-bold block mt-1 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100/50 w-fit">
                                    diinput oleh {getSlotIndicatorName(order.created_by)}
                                  </span>
                                )}
                              </td>

                              {/* Customer info */}
                              <td className="px-4 py-3">
                                <span className="font-bold text-slate-900 block truncate">{order.buyer_name}</span>
                                <span className="text-[10px] text-slate-500 font-medium block mt-0.5 font-mono">
                                  {order.phone_number}
                                </span>
                              </td>

                              {/* Service Details */}
                              <td className="px-4 py-3">
                                <span className="font-semibold text-slate-900 block truncate" title={order.product_name || products.find(p => p.id === order.product_id)?.name || 'Layanan'}>
                                  {order.product_name || products.find(p => p.id === order.product_id)?.name || 'Layanan'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold mt-0.5 inline-block bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                                  {order.quantity} pcs
                                </span>
                              </td>

                              {/* Target Details */}
                              <td className="px-4 py-3">
                                {order.target_link && (
                                  <a 
                                    href={order.target_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium truncate"
                                    title={order.target_link}
                                  >
                                    <Link2 className="h-3 w-3 shrink-0 text-blue-500" />
                                    <span className="truncate">{order.target_link}</span>
                                  </a>
                                )}
                                {order.target_spam_phone && (
                                  <div className="text-[11px] text-amber-700 font-bold flex items-center gap-1 mt-0.5 truncate">
                                    <Phone className="h-3 w-3 text-amber-500 shrink-0" />
                                    <span className="truncate font-mono">Target WA: {order.target_spam_phone}</span>
                                  </div>
                                )}
                                {order.notes && (
                                  <p className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-full" title={order.notes}>
                                    "{order.notes}"
                                  </p>
                                )}
                                {!order.target_link && !order.target_spam_phone && !order.notes && (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>

                              {/* Price */}
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                {formatRupiah(order.total_price)}
                              </td>

                              {/* Payment status select & action */}
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1.5 items-stretch">
                                  <select
                                    value={order.payment_status}
                                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as PaymentStatus)}
                                    className={`w-full rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${
                                      order.payment_status === 'PAID'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : order.payment_status === 'PENDING'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                    }`}
                                  >
                                    <option value="PENDING">PENDING</option>
                                    <option value="PAID">LUNAS</option>
                                    <option value="FAILED">BATAL</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const target = order.target_link || order.target_spam_phone || '-';
                                      const copypasta = `Layanan: ${order.product_name}\nNama Cust: ${order.buyer_name}\nNo WA: ${order.phone_number}\nTarget: ${target}\nJumlah: ${order.quantity}\nTotal Harga: ${formatRupiah(order.total_price)}\nCatatan: ${order.notes || '-'}`;
                                      navigator.clipboard.writeText(copypasta);
                                      setCopiedOrderId(order.id);
                                      setTimeout(() => setCopiedOrderId(null), 2000);
                                    }}
                                    className={`w-full px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                      copiedOrderId === order.id
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    }`}
                                    title="Salin Format"
                                  >
                                    {copiedOrderId === order.id ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        <span>Tersalin!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3 text-blue-600" />
                                        <span>Salin Format</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="block mx-auto text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Delete Order"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditOrder(order)}
                                    className="block mx-auto text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                    title="Edit Order"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view for Unpaid/Pending Orders */}
                <div className="block md:hidden divide-y divide-slate-100 bg-white">
                  {filteredUnpaidOrders.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 font-semibold font-sans">
                      {currentLang === 'id' ? 'Tidak ada pesanan belum lunas.' : 'No unpaid or pending orders.'}
                    </div>
                  ) : (
                    paginatedUnpaidOrders.map((order) => (
                      <div key={order.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{order.id}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(order.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {order.created_by && (
                          <div className="text-[9px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100/50 w-fit">
                            diinput oleh {getSlotIndicatorName(order.created_by)}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Pembeli</span>
                            <span className="font-bold text-slate-900 block truncate">{order.buyer_name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block truncate">{order.phone_number}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Layanan</span>
                            <span className="font-semibold text-slate-900 block truncate">
                              {order.product_name || products.find(p => p.id === order.product_id)?.name || 'Layanan'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded-full font-mono">{order.quantity} pcs</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Target Details</span>
                          {order.target_link && (
                            <a 
                              href={order.target_link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium truncate"
                            >
                              <Link2 className="h-3 w-3 shrink-0 text-blue-500" />
                              <span className="truncate">{order.target_link}</span>
                            </a>
                          )}
                          {order.target_spam_phone && (
                            <div className="text-[11px] text-amber-700 font-bold flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3 text-amber-500 shrink-0" />
                              <span className="truncate font-mono">Target WA: {order.target_spam_phone}</span>
                            </div>
                          )}
                          {order.notes && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5">
                              "{order.notes}"
                            </p>
                          )}
                          {!order.target_link && !order.target_spam_phone && !order.notes && (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Total Harga</span>
                            <span className="font-mono font-bold text-slate-900">{formatRupiah(order.total_price)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={order.payment_status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as PaymentStatus)}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${
                                order.payment_status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : order.payment_status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="PAID">LUNAS</option>
                              <option value="FAILED">BATAL</option>
                            </select>
                            
                            <button
                              type="button"
                              onClick={() => {
                                const target = order.target_link || order.target_spam_phone || '-';
                                const copypasta = `Layanan: ${order.product_name}\nNama Cust: ${order.buyer_name}\nNo WA: ${order.phone_number}\nTarget: ${target}\nJumlah: ${order.quantity}\nTotal Harga: ${formatRupiah(order.total_price)}\nCatatan: ${order.notes || '-'}`;
                                navigator.clipboard.writeText(copypasta);
                                setCopiedOrderId(order.id);
                                setTimeout(() => setCopiedOrderId(null), 2000);
                              }}
                              className={`px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                copiedOrderId === order.id
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              }`}
                            >
                              {copiedOrderId === order.id ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5 text-blue-600" />}
                              <span>{copiedOrderId === order.id ? 'Disalin' : 'Copy'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order.id)}
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete Order"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditOrder(order)}
                              className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit Order"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Pagination
                  currentPage={pageUnpaid}
                  totalPages={Math.ceil(filteredUnpaidOrders.length / ITEMS_PER_PAGE)}
                  onPageChange={setPageUnpaid}
                  activeBgColor="bg-blue-600"
                />
              </div>

              {/* Search & Sort Bar for Paid Web Orders */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100/80 shadow-sm mt-6">
                <div className="relative w-full lg:w-80">
                  <input
                    type="text"
                    value={searchPaid}
                    onChange={(e) => setSearchPaid(e.target.value)}
                    placeholder="Cari pesanan lunas (nama, no WA, layanan, notes)..."
                    className="w-full bg-white text-xs text-slate-700 rounded-xl px-4 py-2.5 outline-none border border-slate-200 focus:border-blue-500 font-sans shadow-sm"
                  />
                </div>

                {/* Beautiful Dragdown sorting / filtering controls */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                  {/* Tipe Jasa Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tipe Jasa:</span>
                    <select
                      value={serviceFilterPaid}
                      onChange={(e) => setServiceFilterPaid(e.target.value)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="all">SEMUA</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status / Progres Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Progres:</span>
                    <select
                      value={sortPaid}
                      onChange={(e) => setSortPaid(e.target.value as any)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="all">SEMUA</option>
                      <option value="pending">PENDING</option>
                      <option value="progress">PROGRES</option>
                      <option value="done">DONE</option>
                    </select>
                  </div>

                  {/* Timeframe Filter (Monthly Date Range Picker) */}
                  <MonthlyDateRangePicker
                    value={timeFilterPaid}
                    onChange={setTimeFilterPaid}
                    currentLang={currentLang}
                  />
                </div>
              </div>

              {/* TABLE 2: DAFTAR PESANAN LUNAS & DISTRIBUSI TUGAS */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-emerald-50/30 border-b border-emerald-100 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">
                      {currentLang === 'id' ? 'Pesanan Lunas & Distribusi Tugas Worker (FIFO)' : 'Paid Orders & Worker Tasks (FIFO)'}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 font-mono">
                    {filteredPaidOrders.length} Lunas
                  </span>
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[20%]" />
                      <col className="w-[20%]" />
                      <col className="w-[20%]" />
                      <col className="w-[25%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                        <th className="px-4 py-3">ID / Tanggal / Total</th>
                        <th className="px-4 py-3">Pembeli & No WA</th>
                        <th className="px-4 py-3">Layanan</th>
                        <th className="px-4 py-3">Target Details</th>
                        <th className="px-4 py-3 text-center">Status / Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredPaidOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-semibold font-sans">
                            {currentLang === 'id' ? 'Belum ada pesanan lunas.' : 'No paid orders yet.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedPaidOrders.map((order) => {
                            const isUnassigned = !order.worker_status || order.worker_status === 'unassigned';
                            const isTaken = order.worker_status === 'taken';
                            const isDone = order.worker_status === 'done';

                            return (
                              <tr key={order.id} className="hover:bg-slate-50/30 transition-colors">
                                {/* ID, Date, and Price Stacked */}
                                <td className="px-4 py-3 font-mono">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 truncate block">{order.id}</span>
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-sans font-bold">LUNAS</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {new Date(order.created_at).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  {order.created_by && (
                                    <span className="text-[9px] text-orange-600 font-bold block mt-1 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100/50 w-fit">
                                      diinput oleh {getSlotIndicatorName(order.created_by)}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-bold text-slate-900 block mt-1 font-mono">
                                    {formatRupiah(order.total_price)}
                                  </span>
                                </td>

                                {/* Customer info */}
                                <td className="px-4 py-3">
                                  <span className="font-bold text-slate-900 block truncate">{order.buyer_name}</span>
                                  <span className="text-[10px] text-slate-500 font-medium block mt-0.5 font-mono">
                                    {order.phone_number}
                                  </span>
                                </td>

                                {/* Service Details */}
                                <td className="px-4 py-3">
                                  <span className="font-semibold text-slate-900 block truncate" title={order.product_name || products.find(p => p.id === order.product_id)?.name || 'Layanan'}>
                                    {order.product_name || products.find(p => p.id === order.product_id)?.name || 'Layanan'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-bold mt-0.5 inline-block bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                                    {order.quantity} pcs
                                  </span>
                                </td>

                                {/* Target Details */}
                                <td className="px-4 py-3">
                                  {order.target_link && (
                                    <a 
                                      href={order.target_link} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium truncate"
                                      title={order.target_link}
                                    >
                                      <Link2 className="h-3 w-3 shrink-0 text-blue-500" />
                                      <span className="truncate">{order.target_link}</span>
                                    </a>
                                  )}
                                  {order.target_spam_phone && (
                                    <div className="text-[11px] text-amber-700 font-bold flex items-center gap-1 mt-0.5 truncate">
                                      <Phone className="h-3 w-3 text-amber-500 shrink-0" />
                                      <span className="truncate font-mono">Target WA: {order.target_spam_phone}</span>
                                    </div>
                                  )}
                                  {order.notes && (
                                    <p className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-full" title={order.notes}>
                                      "{order.notes}"
                                    </p>
                                  )}
                                  {!order.target_link && !order.target_spam_phone && !order.notes && (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>

                                {/* Worker Assignment & Status Dropdown Stacked */}
                                <td className="px-4 py-3 space-y-1">



                                  {/* Worker status dropdown */}
                                  <select
                                    value={order.worker_status || 'unassigned'}
                                    onChange={(e) => handleUpdateWorkerStatus(order.id, e.target.value as any)}
                                    className={`w-full rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${
                                      isDone 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                        : isTaken 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    <option value="unassigned">Antrean</option>
                                    <option value="taken">Diproses</option>
                                    <option value="done">Selesai</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const target = order.target_link || order.target_spam_phone || '-';
                                      const copypasta = `Layanan: ${order.product_name}\nNama Cust: ${order.buyer_name}\nNo WA: ${order.phone_number}\nTarget: ${target}\nJumlah: ${order.quantity}\nTotal Harga: ${formatRupiah(order.total_price)}\nCatatan: ${order.notes || '-'}`;
                                      navigator.clipboard.writeText(copypasta);
                                      setCopiedOrderId(order.id);
                                      setTimeout(() => setCopiedOrderId(null), 2000);
                                    }}
                                    className={`w-full mt-1.5 px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                      copiedOrderId === order.id
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    }`}
                                    title="Salin Format"
                                  >
                                    {copiedOrderId === order.id ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        <span>Tersalin!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3 text-blue-600" />
                                        <span>Salin Format</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="block mx-auto mt-1.5 text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Delete Order"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditOrder(order)}
                                    className="block mx-auto mt-1.5 text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                    title="Edit Order"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                </td>


                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view for Paid Orders & Worker Tasks (FIFO) */}
                <div className="block md:hidden divide-y divide-slate-100 bg-white">
                  {filteredPaidOrders.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 font-semibold font-sans">
                      {currentLang === 'id' ? 'Belum ada pesanan lunas.' : 'No paid orders yet.'}
                    </div>
                  ) : (
                    paginatedPaidOrders.map((order) => {
                      const isUnassigned = !order.worker_status || order.worker_status === 'unassigned';
                      const isTaken = order.worker_status === 'taken';
                      const isDone = order.worker_status === 'done';

                      return (
                        <div key={order.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">{order.id}</span>
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-sans font-bold">LUNAS</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(order.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {order.created_by && (
                            <div className="text-[9px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100/50 w-fit">
                              diinput oleh {getSlotIndicatorName(order.created_by)}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">Pembeli</span>
                              <span className="font-bold text-slate-900 block truncate">{order.buyer_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono block truncate">{order.phone_number}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">Layanan</span>
                              <span className="font-semibold text-slate-900 block truncate" title={order.product_name || products.find(p => p.id === order.product_id)?.name || 'Layanan'}>
                                {order.product_name || products.find(p => p.id === order.product_id)?.name || 'Layanan'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded-full font-mono">{order.quantity} pcs</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Target Details</span>
                            {order.target_link && (
                              <a 
                                href={order.target_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium truncate"
                              >
                                <Link2 className="h-3 w-3 shrink-0 text-blue-500" />
                                <span className="truncate">{order.target_link}</span>
                              </a>
                            )}
                            {order.target_spam_phone && (
                              <div className="text-[11px] text-amber-700 font-bold flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="truncate font-mono">Target WA: {order.target_spam_phone}</span>
                              </div>
                            )}
                            {order.notes && (
                              <p className="text-[10px] text-slate-500 italic mt-0.5">
                                "{order.notes}"
                              </p>
                            )}
                            {!order.target_link && !order.target_spam_phone && !order.notes && (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">Total Harga</span>
                              <span className="font-mono font-bold text-slate-900">{formatRupiah(order.total_price)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={order.worker_status || 'unassigned'}
                                onChange={(e) => handleUpdateWorkerStatus(order.id, e.target.value as any)}
                                className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${
                                  isDone 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : isTaken 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                              >
                                <option value="unassigned">Antrean</option>
                                <option value="taken">Diproses</option>
                                <option value="done">Selesai</option>
                              </select>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  const target = order.target_link || order.target_spam_phone || '-';
                                  const copypasta = `Layanan: ${order.product_name}\nNama Cust: ${order.buyer_name}\nNo WA: ${order.phone_number}\nTarget: ${target}\nJumlah: ${order.quantity}\nTotal Harga: ${formatRupiah(order.total_price)}\nCatatan: ${order.notes || '-'}`;
                                  navigator.clipboard.writeText(copypasta);
                                  setCopiedOrderId(order.id);
                                  setTimeout(() => setCopiedOrderId(null), 2000);
                                }}
                                className={`px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  copiedOrderId === order.id
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                }`}
                              >
                                {copiedOrderId === order.id ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5 text-blue-600" />}
                                <span>{copiedOrderId === order.id ? 'Disalin' : 'Copy'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(order.id)}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete Order"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditOrder(order)}
                                className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Edit Order"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <Pagination
                  currentPage={pagePaid}
                  totalPages={Math.ceil(filteredPaidOrders.length / ITEMS_PER_PAGE)}
                  onPageChange={setPagePaid}
                  activeBgColor="bg-blue-600"
                />
              </div>

            </div>
          )}

          {/* 3. SHOPEE MANUAL ORDERS TAB */}
          {activeTab === 'shopee_orders' && (
            <div className="space-y-6" id="admin-shopee-orders-list">
              
              {/* Search & Sort Bar */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100/80 shadow-sm">
                <div className="relative w-full lg:w-80">
                  <input
                    type="text"
                    value={searchShopee}
                    onChange={(e) => setSearchShopee(e.target.value)}
                    placeholder="Cari store, pembeli, layanan, target, worker..."
                    className="w-full bg-white text-xs text-slate-700 rounded-xl px-4 py-2.5 outline-none border border-slate-200 focus:border-blue-500 font-sans shadow-sm"
                  />
                </div>

                {/* Minimalist sorting / filtering controls */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                  {/* Tipe Jasa Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tipe Jasa:</span>
                    <select
                      value={shopeeTypeFilter}
                      onChange={(e) => setShopeeTypeFilter(e.target.value as any)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="all">SEMUA</option>
                      <option value="report">REPORT</option>
                      <option value="spam_wa">SPAM WA</option>
                    </select>
                  </div>

                  {/* Status / Progres Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Progres:</span>
                    <select
                      value={sortShopee}
                      onChange={(e) => setSortShopee(e.target.value as any)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="all">SEMUA</option>
                      <option value="pending">PENDING</option>
                      <option value="progress">PROGRES</option>
                      <option value="ready">READY</option>
                      <option value="sudah_direkap">SUDAH DIREKAP</option>
                      <option value="done">DONE</option>
                    </select>
                  </div>

                  {/* Timeframe Filter (Monthly Date Range Picker) */}
                  <MonthlyDateRangePicker
                    value={timeFilterShopee}
                    onChange={setTimeFilterShopee}
                    currentLang={currentLang}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50/60 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">
                      Daftar Pesanan Shopee (Manual Portal)
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full font-mono">
                    {filteredShopeeOrders.length} Total
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                    <colgroup>
                      <col className="w-[12%]" />
                      <col className="w-[15%]" />
                      <col className="w-[15%]" />
                      <col className="w-[8%]" />
                      <col className="w-[20%]" />
                      <col className="w-[15%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                        <th className="px-4 py-3">ID / Tanggal</th>
                        <th className="px-4 py-3">Store / Pembeli</th>
                        <th className="px-4 py-3">Jenis Jasa</th>
                        <th className="px-4 py-3">Slot/Pcs</th>
                        <th className="px-4 py-3">Target & Format</th>
                        <th className="px-4 py-3">Work Order</th>
                        <th className="px-4 py-3 text-center">Worker / Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredShopeeOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-semibold font-sans">
                            Belum ada pesanan Shopee yang cocok / diinput.
                          </td>
                        </tr>
                      ) : (
                        paginatedShopeeOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50/30 transition-colors">
                            {/* ID and Date */}
                            <td className="px-4 py-3 font-mono">
                              <span className="font-bold text-slate-900 block truncate" title={order.id}>
                                {order.id.slice(0, 8)}...
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                {new Date(order.created_at).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {order.created_by && (
                                <span className="text-[9px] text-orange-600 font-bold block mt-1 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100/50 w-fit">
                                  diinput oleh {getSlotIndicatorName(order.created_by)}
                                </span>
                              )}
                            </td>

                            {/* Store & Buyer */}
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 block truncate" title={order.store_name}>
                                {order.store_name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium block mt-0.5 truncate" title={order.buyer_name}>
                                {order.buyer_name}
                              </span>
                            </td>

                            {/* Service Type */}
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 block truncate capitalize">
                                {order.service_type.replace(/_/g, ' ').toLowerCase()}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {order.order_type === 'REPORT_ALL_SOSMED' ? 'REPORT SOSMED' : 'SPAM WA'}
                              </span>
                            </td>

                            {/* Quantity */}
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">
                              {order.quantity} Pcs
                            </td>

                            {/* Target & Formatted Text */}
                            <td className="px-4 py-3 space-y-1">
                              <span className="text-[10px] text-slate-800 font-medium truncate block max-w-full font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100" title={order.target_link}>
                                {order.target_link}
                              </span>
                              {order.notes && (
                                <span className="text-[10px] text-amber-600 font-medium block italic truncate">
                                  Notes: {order.notes}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(order.formatted_text);
                                  setCopiedShopeeId(order.id);
                                  setTimeout(() => setCopiedShopeeId(null), 2000);
                                }}
                                className="inline-flex items-center gap-1.5 text-[9px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-lg transition-colors cursor-pointer font-sans"
                              >
                                <Copy className="h-3 w-3" />
                                <span>{copiedShopeeId === order.id ? 'Tersalin!' : 'Salin Format'}</span>
                              </button>
                            </td>

                            {/* Work Order text input column */}
                            <td className="px-4 py-3">
                              <DebouncedTextarea
                                value={order.work_order || ''}
                                onSave={(val) => handleUpdateShopeeWorkOrder(order.id, val)}
                                placeholder="Tulis instruksi kerja..."
                                className="w-full h-12 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-sans outline-none focus:border-blue-500 resize-none bg-slate-50 hover:bg-white focus:bg-white transition-all text-slate-700 font-sans"
                              />
                            </td>

                            {/* Worker assigned & actions */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1.5 items-stretch">
                                <select
                                  value={order.worker_id || ''}
                                  onChange={(e) => handleUpdateShopeeWorker(order.id, e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  <option value="">-- Assign Worker --</option>
                                  {['rehan', 'deky', 'panca', 'anggun', 'riyanto', 'bintang'].map((worker) => (
                                    <option key={worker} value={worker} className="capitalize">
                                      {worker}
                                    </option>
                                  ))}
                                </select>
                                
                                <select
                                  value={order.status || 'PENDING'}
                                  onChange={(e) => handleUpdateShopeeStatus(order.id, e.target.value as any)}
                                  className={`w-full rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${
                                    order.status === 'DONE'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : order.status === 'PROGRESS'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                      : order.status === 'READY'
                                      ? 'bg-white text-slate-700 border-slate-300'
                                      : order.status === 'SUDAH DIREKAP'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-sky-50 text-sky-700 border-sky-200'
                                  }`}
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="PROGRESS">PROGRESS</option>
                                  <option value="READY">READY</option>
                                  <option value="SUDAH DIREKAP">SUDAH DIREKAP</option>
                                  <option value="DONE">DONE</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(order.formatted_text);
                                    setCopiedShopeeId(order.id);
                                    setTimeout(() => setCopiedShopeeId(null), 2000);
                                  }}
                                  className={`w-full px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                    copiedShopeeId === order.id
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                  }`}
                                  title="Salin Format"
                                >
                                  {copiedShopeeId === order.id ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      <span>Tersalin!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3 text-blue-600" />
                                      <span>Salin Format</span>
                                    </>
                                  )}
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShopeeOrder(order.id)}
                                  className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-red-600 hover:bg-red-50 py-1.5 rounded-lg transition-colors cursor-pointer border border-dashed border-red-200 font-sans"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Hapus</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditShopee(order)}
                                  className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer border border-dashed border-blue-200 font-sans mt-1"
                                  title="Edit Order"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={pageShopee}
                  totalPages={Math.ceil(filteredShopeeOrders.length / ITEMS_PER_PAGE)}
                  onPageChange={setPageShopee}
                  activeBgColor="bg-blue-600"
                />
              </div>
            </div>
          )}

          {/* MAPS & REVIEWS REPORTS TAB */}
          {activeTab === 'maps_reviews' && (
            <div className="space-y-6" id="admin-maps-reviews-list">
              
              {/* Search & Sort Bar */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100/80 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full lg:w-auto">
                  <div className="relative w-full sm:w-80">
                    <input
                      type="text"
                      value={searchReview}
                      onChange={(e) => setSearchReview(e.target.value)}
                      placeholder="Cari store, klien, tipe review, notes..."
                      className="w-full bg-white text-xs text-slate-700 rounded-xl px-4 py-2.5 outline-none border border-slate-200 focus:border-blue-500 font-sans shadow-sm"
                    />
                  </div>

                  {/* Tipe Review Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto" id="admin-tipe-review-filter">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tipe Review:</span>
                    <select
                      value={reviewTypeFilter}
                      onChange={(e) => setReviewTypeFilter(e.target.value as any)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="SEMUA">SEMUA</option>
                      <option value="TRIPAD">TRIPAD</option>
                      <option value="GMAPS">GMAPS</option>
                      <option value="REVIEW APPS">REVIEW APPS</option>
                    </select>
                  </div>
                </div>

                {/* Minimalist sorting / filtering controls */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                  {/* Status / Progres Filter (Beautiful Dropdown) */}
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm text-xs w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Progres:</span>
                    <select
                      value={sortReview}
                      onChange={(e) => setSortReview(e.target.value as any)}
                      className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0 text-xs uppercase"
                    >
                      <option value="all">SEMUA</option>
                      <option value="pending">PENDING</option>
                      <option value="progress">PROGRES</option>
                      <option value="ready">READY</option>
                      <option value="sudah_direkap">SUDAH DIREKAP</option>
                      <option value="done">DONE</option>
                    </select>
                  </div>

                  {/* Timeframe Filter (Monthly Date Range Picker) */}
                  <MonthlyDateRangePicker
                    value={timeFilterReview}
                    onChange={setTimeFilterReview}
                    currentLang={currentLang}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50/60 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">
                      Review Orders Worker (G Maps, Tripadvisor & Review Apps)
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full font-mono">
                    {filteredMapsReviews.length} Total
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                    <colgroup>
                      <col className="w-[10%]" />
                      <col className="w-[13%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[20%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                        <th className="px-4 py-3">ID / Tanggal</th>
                        <th className="px-4 py-3">Klien & Store Name</th>
                        <th className="px-4 py-3">Tipe Review</th>
                        <th className="px-4 py-3">Target Link</th>
                        <th className="px-4 py-3">Input Progres Akun</th>
                        <th className="px-4 py-3">Clue</th>
                        <th className="px-4 py-3">Link Bukti</th>
                        <th className="px-4 py-3 text-center">Status / Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredMapsReviews.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-semibold font-sans">
                            Belum ada laporan review yang cocok / terdaftar.
                          </td>
                        </tr>
                      ) : (
                        paginatedMapsReviews.map((review) => (
                          <tr key={review.id} className="hover:bg-slate-50/30 transition-colors">
                            {/* ID and Date */}
                            <td className="px-4 py-3 font-mono">
                              <span className="font-bold text-slate-900 block truncate" title={review.id}>
                                {review.id.slice(0, 8)}...
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                {new Date(review.created_at).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {review.created_by && (
                                <span className="text-[9px] text-orange-600 font-bold block mt-1 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100/50 w-fit">
                                  diinput oleh {getSlotIndicatorName(review.created_by)}
                                </span>
                              )}
                            </td>

                            {/* Client & Store Name */}
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 block truncate" title={review.store_name}>
                                {review.store_name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium block mt-0.5 truncate" title={review.client_name}>
                                Klien: {review.client_name}
                              </span>
                            </td>

                            {/* Review Type */}
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                review.review_type === 'G_MAPS'
                                  ? 'bg-red-50 text-red-700 border border-red-100'
                                  : (review.review_type === 'TRIPAD' || (review.review_type as string) === 'TRIPADVISOR' || (review.review_type as string) === 'REVIEW_TRIPAD')
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-violet-50 text-violet-700 border border-violet-100'
                              }`}>
                                {(review.review_type || 'G_MAPS').replace(/_/g, ' ')}
                              </span>
                            </td>

                            {/* Target Link */}
                            <td className="px-4 py-3">
                              {review.maps_link ? (
                                <a
                                  href={review.maps_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium truncate"
                                  title={review.maps_link}
                                >
                                  <Link2 className="h-3 w-3 shrink-0 text-blue-500" />
                                  <span className="truncate">{review.maps_link}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Input Progres Akun Column */}
                            <td className="px-4 py-3 space-y-2">
                              {/* Progress bar inside the same column */}
                              {(() => {
                                const doneCount = review.reviewer_accounts?.length || 0;
                                const pct = Math.min(100, Math.round((doneCount / (review.target_count || 1)) * 100));
                                const isFinished = review.status === 'DONE';

                                return (
                                  <>
                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-600 font-mono mb-1">
                                      <span>Target: {doneCount} / {review.target_count || 0}</span>
                                      <span>{pct}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          isFinished ? 'bg-emerald-500' : 'bg-blue-600'
                                        }`} 
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>

                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        type="text"
                                        placeholder="Nama Akun Reviewer"
                                        value={tempAccountInput[review.id] || ''}
                                        onChange={e => {
                                          const val = e.target.value;
                                          if (val.endsWith(',') || val.endsWith('\n')) {
                                            const cleanNames = val.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                                            if (cleanNames.length > 0) {
                                              const targetReview = mapsReviews.find(r => r.id === review.id);
                                              if (targetReview) {
                                                const currentAccounts = Array.isArray(targetReview.reviewer_accounts) ? targetReview.reviewer_accounts : [];
                                                const updatedAccounts = [...currentAccounts, ...cleanNames];
                                                setMapsReviews(prev => prev.map(r => r.id === review.id ? { 
                                                  ...r, 
                                                  reviewer_accounts: updatedAccounts,
                                                  status: (r.status === 'PENDING' && updatedAccounts.length > 0) ? 'PROGRESS' : r.status
                                                } : r));
                                                setTempAccountInput(prev => ({ ...prev, [review.id]: '' }));
                                                dbUpdateMapsReview(review.id, { reviewer_accounts: updatedAccounts }).catch(console.error);
                                                return;
                                              }
                                            }
                                          }
                                          setTempAccountInput(prev => ({ ...prev, [review.id]: val }));
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddReviewerAccount(review.id);
                                          }
                                        }}
                                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 flex-grow font-sans bg-white min-w-0"
                                      />
                                      <button
                                        type="button"
                                        onPointerDown={(e) => {
                                          e.preventDefault();
                                          handleAddReviewerAccount(review.id);
                                        }}
                                        onClick={() => handleAddReviewerAccount(review.id)}
                                        className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg px-2.5 py-1.5 transition-all shrink-0 cursor-pointer flex items-center justify-center min-w-[34px] min-h-[30px] shadow-sm font-bold"
                                        title="Tambah Akun (Progres +1)"
                                      >
                                        <Plus className="h-4 w-4 stroke-[2.5]" />
                                      </button>
                                    </div>

                                    {/* Scrollable grid for accounts */}
                                    {review.reviewer_accounts && review.reviewer_accounts.length > 0 ? (
                                      <div className="border border-slate-200 rounded p-1.5 bg-white max-h-[100px] overflow-y-auto shadow-inner mt-1">
                                        <div className="grid grid-cols-2 gap-1">
                                          {review.reviewer_accounts.map((acc, index) => (
                                            <div key={index} className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[8px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                                              <span className="truncate font-mono" title={`${index + 1}. ${acc}`}>
                                                {index + 1}. {acc}
                                              </span>
                                              <button
                                                onClick={() => handleRemoveReviewerAccount(review.id, index)}
                                                className="text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 px-0.5 rounded transition-all cursor-pointer text-[10px] leading-none"
                                                title="Hapus Akun"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-[9px] text-slate-400 italic py-1 text-center bg-slate-50/60 border border-dashed border-slate-200 rounded">
                                        Belum ada ulasan akun diinput
                                      </div>
                                    )}

                                    {review.reviewer_accounts && review.reviewer_accounts.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleExportPDF(review)}
                                        className="w-full mt-1.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                                      >
                                        <FileDown className="h-3 w-3 text-blue-600" />
                                        <span>Export PDF ({review.reviewer_accounts.length})</span>
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </td>

                            {/* Notes / Clue */}
                            <td className="px-4 py-3">
                              <DebouncedTextarea
                                rows={3}
                                placeholder="Input clue/catatan..."
                                value={review.notes || ''}
                                onSave={(val) => handleUpdateNotes(review.id, val)}
                                className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-sans resize-y min-h-[60px]"
                              />
                            </td>

                            {/* Link Bukti Pengerjaan */}
                            <td className="px-4 py-3">
                              <DebouncedInput
                                type="text"
                                placeholder="Link bukti pengerjaan..."
                                value={review.proof_link || ''}
                                onSave={(val) => handleUpdateProofLink(review.id, val)}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[10px] outline-none focus:border-emerald-500 text-slate-700 font-mono bg-white"
                              />
                              {review.proof_link && (
                                <a
                                  href={review.proof_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-emerald-600 hover:underline font-mono inline-block mt-1 truncate max-w-full font-bold"
                                  title={review.proof_link}
                                >
                                  Buka Bukti →
                                </a>
                              )}
                            </td>

                            {/* Status dropdown */}
                            <td className="px-4 py-3 text-center">
                              <select
                                value={review.status || 'PENDING'}
                                onChange={(e) => handleUpdateMapsStatus(review.id, e.target.value as any)}
                                className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer w-full ${
                                  review.status === 'DONE'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : review.status === 'PROGRESS'
                                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                                    : review.status === 'READY'
                                    ? 'bg-white text-slate-700 border-slate-300'
                                    : review.status === 'SUDAH DIREKAP'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="PROGRESS">PROGRESS</option>
                                <option value="READY">READY</option>
                                <option value="SUDAH DIREKAP">SUDAH DIREKAP</option>
                                <option value="DONE">DONE</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => {
                                  const copypasta = `Link: ${review.maps_link}\nNama cust: ${review.client_name}\nNama st: ${review.store_name || '-'}\nclue: ${review.notes || '-'}`;
                                  navigator.clipboard.writeText(copypasta);
                                  setCopiedReviewId(review.id);
                                  setTimeout(() => setCopiedReviewId(null), 2000);
                                }}
                                className={`w-full mt-1.5 px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  copiedReviewId === review.id
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                }`}
                                title="Salin Format"
                              >
                                {copiedReviewId === review.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span>Tersalin!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 text-blue-600" />
                                    <span>Salin Format</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteMapsReview(review.id)}
                                className="block mx-auto mt-1.5 text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title="Hapus Laporan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditMaps(review)}
                                className="block mx-auto mt-1 text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Edit Laporan"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </td>


                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={pageReview}
                  totalPages={Math.ceil(filteredMapsReviews.length / ITEMS_PER_PAGE)}
                  onPageChange={setPageReview}
                  activeBgColor="bg-blue-600"
                />
              </div>
            </div>
          )}

          {/* 4. SETTINGS VIEW WITH PRODUCT MGMT AND SPREADSHEET SYNC */}
          {activeTab === 'settings' && (
            <div className="flex flex-col lg:flex-row gap-8 items-start w-full" id="admin-settings-dashboard">
              {/* Left Sidebar for Navigation - Desktop and Mobile Hamburger */}
              <div className="w-full lg:w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm shrink-0 space-y-3">
                {/* Back to Dashboard Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    window.history.pushState(null, '', '/admin');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black transition-all border border-slate-200 dark:border-slate-700/80 cursor-pointer shadow-xs active:scale-95"
                  id="btn-back-to-dashboard-from-settings"
                >
                  <ArrowLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Kembali ke Dashboard</span>
                </button>

                {/* Desktop Header */}
                <div className="px-3 mb-2 hidden lg:block border-t border-slate-100 dark:border-slate-800 pt-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pengaturan Admin</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Kelola produk, integrasi & akses</p>
                </div>
                
                {/* Mobile Trigger Bar */}
                <div className="lg:hidden flex items-center justify-between w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pengaturan</span>
                    <span className="text-xs font-bold text-blue-600 mt-0.5">
                      {activeSettingsTab === 'products' ? 'Layanan & Produk'
                        : activeSettingsTab === 'spreadsheet_integration' ? 'Integrasi Spreadsheet'
                        : activeSettingsTab === 'account_access' ? 'Hak Akses Akun'
                        : 'Pasang Aplikasi'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsMenuOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer active:scale-95"
                  >
                    <Menu className="h-4 w-4" />
                    <span>Pilih Menu</span>
                  </button>
                </div>

                {/* Desktop Sidebar Buttons */}
                <div className="hidden lg:flex flex-col gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('products')}
                    className={`px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer lg:w-full text-left ${
                      activeSettingsTab === 'products'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Briefcase className="h-4 w-4 shrink-0" />
                    <span>Layanan & Produk</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('spreadsheet_integration')}
                    className={`px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer lg:w-full text-left ${
                      activeSettingsTab === 'spreadsheet_integration'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    <span>Integrasi Spreadsheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('account_access')}
                    className={`px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer lg:w-full text-left ${
                      activeSettingsTab === 'account_access'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    <span>Hak Akses Akun</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('app_install')}
                    className={`px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer lg:w-full text-left ${
                      activeSettingsTab === 'app_install'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>Pasang Aplikasi</span>
                  </button>
                </div>
              </div>

              {/* Mobile Settings Sidebar Drawer / Modal */}
              {isSettingsMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden flex">
                  {/* Backdrop */}
                  <div
                    onClick={() => setIsSettingsMenuOpen(false)}
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
                  />
                  {/* Content Drawer */}
                  <div className="relative flex flex-col w-72 max-w-[80vw] h-full bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-sans">Menu Settings</h3>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Pilih navigasi konfigurasi admin</p>
                      </div>
                      <button
                        onClick={() => setIsSettingsMenuOpen(false)}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="h-px bg-slate-100 mb-6" />

                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSettingsTab('products');
                          setIsSettingsMenuOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                          activeSettingsTab === 'products'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Briefcase className="h-4 w-4 shrink-0" />
                        <span>Layanan & Produk</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveSettingsTab('spreadsheet_integration');
                          setIsSettingsMenuOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                          activeSettingsTab === 'spreadsheet_integration'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4 shrink-0" />
                        <span>Integrasi Spreadsheet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveSettingsTab('account_access');
                          setIsSettingsMenuOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                          activeSettingsTab === 'account_access'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Users className="h-4 w-4 shrink-0" />
                        <span>Hak Akses Akun</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveSettingsTab('app_install');
                          setIsSettingsMenuOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                          activeSettingsTab === 'app_install'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Download className="h-4 w-4 shrink-0" />
                        <span>Pasang Aplikasi</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content Pane */}
              <div className="flex-1 w-full space-y-6">
                {activeSettingsTab === 'products' && (
                <div className="space-y-6">
                  {/* Toolbar */}
                  <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-sm font-bold text-slate-500">
                      Total: {products.length} {t.productList}
                    </span>
                    <button
                      onClick={openAddProductModal}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                      id="add-new-product-btn"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t.addProduct}</span>
                    </button>
                  </div>

                  {/* Grid of editable items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-slate-400 font-semibold">
                        {t.noProducts}
                      </div>
                    ) : (
                      products.map((product) => (
                        <div 
                          key={product.id} 
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col justify-between"
                        >
                          <div className="relative aspect-video w-full bg-slate-50">
                            <img 
                              src={product.image_url} 
                              alt={product.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-3 right-3 flex gap-1">
                              <button
                                onClick={() => openEditProductModal(product)}
                                className="bg-white/90 rounded-lg p-2 text-slate-700 hover:bg-white hover:text-blue-600 shadow-md backdrop-blur transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="bg-white/90 rounded-lg p-2 text-slate-700 hover:bg-white hover:text-red-600 shadow-md backdrop-blur transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {product.id}
                                </span>
                                <span className="text-xs font-black text-blue-600 font-mono">
                                  {formatRupiah(product.price)} / pcs
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-900 text-sm font-sans block">
                                ID: {product.name}
                              </h4>
                              <h4 className="font-semibold text-slate-500 text-xs font-sans block mt-0.5">
                                EN: {product.name_en}
                              </h4>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                              <p className="text-xs text-slate-500 font-medium font-sans italic">
                                WA: {product.whatsapp_number}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeSettingsTab === 'spreadsheet_integration' && (
                <div className="space-y-6" id="spreadsheet-integration-panel">
                  {/* Top Sync Card */}
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                            <FileSpreadsheet className="h-4 w-4" />
                          </span>
                          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight font-sans">
                            Sinkronisasi Google Spreadsheet
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Sync Siap
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          Tarik dan perbarui data Maps Review secara langsung dari Google Spreadsheet publik Anda ke database web.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsSpreadsheetModalOpen(true)}
                          className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-95"
                          id="open-spreadsheet-modal-btn"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>Mulai Sinkronkan Data</span>
                        </button>

                        <a
                          href={DEFAULT_SPREADSHEET_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
                        >
                          <span>Buka Spreadsheet</span>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </a>
                      </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-emerald-100/60">
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3.5 border border-slate-100 shadow-xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Maps Reviews</span>
                        <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{mapsReviews.length} Data</span>
                        <span className="text-[10px] font-semibold text-emerald-600 mt-1 block">✓ Tersinkronisasi</span>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3.5 border border-slate-100 shadow-xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Pesanan Shopee</span>
                        <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{shopeeOrders.length} Pesanan</span>
                        <span className="text-[10px] font-semibold text-blue-600 mt-1 block">✓ Dual Input</span>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3.5 border border-slate-100 shadow-xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Layanan Umum</span>
                        <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{orders.length} Transaksi</span>
                        <span className="text-[10px] font-semibold text-purple-600 mt-1 block">✓ Auto-Export</span>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3.5 border border-slate-100 shadow-xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Status Jalur</span>
                        <span className="text-sm font-black text-emerald-700 font-sans mt-1 block">DUAL ACTIVE</span>
                        <span className="text-[10px] font-medium text-slate-500 mt-1 block">Supabase + Sheet</span>
                      </div>
                    </div>
                  </div>

                  {/* Connected Spreadsheet Details */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Tautan Spreadsheet Terhubung
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Google Spreadsheet yang digunakan sebagai sumber data sinkronisasi otomatis
                        </p>
                      </div>
                      <span className="text-[10px] font-black font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        PUBLIC / VIEW-ENABLED
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <input
                        type="text"
                        readOnly
                        value={DEFAULT_SPREADSHEET_URL}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-700 outline-none select-all"
                      />
                      <a
                        href={DEFAULT_SPREADSHEET_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-black px-5 py-2.5 text-xs font-black text-white shadow-sm transition-all"
                      >
                        <span>Buka Tab Baru</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'account_access' && (
                <div className="space-y-8" id="account-access-settings-panel">
                  {/* Account Cards Grid */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-900 font-sans uppercase tracking-tight flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Pengaturan Hak Akses Admin Portal
                      </h3>
                      <p className="text-xs text-slate-400 font-medium font-sans">
                        Kelola Username dan Password untuk masing-masing slot portal Admin-SHP (adminshp1 s/d adminshp4).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 pt-2">
                      {(['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'] as const).map((slot, index) => {
                        const isEdited = editingCreds[slot].username !== adminshpCreds[slot].username || 
                                         editingCreds[slot].password !== adminshpCreds[slot].password;
                        return (
                          <div key={slot} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-xs font-black text-slate-800 uppercase font-sans">
                                  Slot {index + 1} ({slot})
                                </span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                                  Aktif
                                </span>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Username</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    required
                                    value={editingCreds[slot].username}
                                    onChange={(e) => setEditingCreds(prev => ({
                                      ...prev,
                                      [slot]: { ...prev[slot], username: e.target.value }
                                    }))}
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans text-slate-700 font-semibold"
                                    placeholder={slot}
                                  />
                                  <Users className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Password</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    required
                                    value={editingCreds[slot].password}
                                    onChange={(e) => setEditingCreds(prev => ({
                                      ...prev,
                                      [slot]: { ...prev[slot], password: e.target.value }
                                    }))}
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono text-xs text-slate-700 font-semibold"
                                    placeholder={`gm${slot}`}
                                  />
                                  <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = {
                                  ...adminshpCreds,
                                  [slot]: {
                                    username: editingCreds[slot].username.trim().toLowerCase() || slot,
                                    password: editingCreds[slot].password.trim() || `gm${slot}`
                                  }
                                };
                                localStorage.setItem('gm_adminshp_creds', JSON.stringify(updated));
                                setAdminshpCreds(updated);
                                logAdminShpAction('Main Admin', 'Ubah Kredensial', `Mengubah kredensial slot ${slot}. Username baru: "${updated[slot].username}"`);
                                toast.success(`Kredensial untuk ${slot} berhasil diperbarui!`);
                              }}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                isEdited 
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/10' 
                                  : 'bg-slate-200 text-slate-400 cursor-default'
                              }`}
                              disabled={!isEdited}
                            >
                              <Save className="h-3 w-3" />
                              <span>Simpan</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'app_install' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6" id="app-install-settings-panel">
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900 font-sans uppercase tracking-tight flex items-center gap-2">
                      <Download className="h-5 w-5 text-blue-600" />
                      Pasang Aplikasi GM AGENCY (PWA)
                    </h3>
                    <p className="text-xs text-slate-400 font-medium font-sans">
                      Akses portal admin secara instan dari perangkat Anda layaknya aplikasi native tanpa membuka browser manual.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-2">
                    <div className="space-y-4">
                      <div className="relative h-24 w-24 rounded-2xl overflow-hidden border-2 border-blue-500/50 bg-white shadow-md shadow-blue-500/20 flex items-center justify-center p-0.5">
                        <img
                          src="https://reonysrsoaepzykwwfzw.supabase.co/storage/v1/object/public/LOGO-GM/Firefly_Flux_coba%20buatkan%20versi%20GM%20AGENCY%20404784.jpg%20(1).png"
                          alt="GM AGENCY App Logo"
                          className="w-full h-full object-cover rounded-xl"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-sans font-bold text-sm text-slate-800">Kenapa memasang Aplikasi GM AGENCY?</h4>
                        <ul className="text-xs text-slate-500 space-y-1.5 list-disc pl-4 font-medium">
                          <li><strong>Akses Satu Ketukan</strong>: Akses instan dari Home Screen atau Desktop langsung ke portal Admin.</li>
                          <li><strong>Performa Optimal</strong>: Lebih cepat, ringan, dan responsif.</li>
                          <li><strong>Tampilan Bersih</strong>: Tanpa baris URL browser yang memakan ruang layar.</li>
                        </ul>
                      </div>

                      <div className="pt-2">
                        {onInstallApp ? (
                          <button
                            onClick={onInstallApp}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="h-4 w-4" />
                            <span>Pasang Sekarang</span>
                          </button>
                        ) : (
                          <div className="text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 p-3 rounded-xl">
                            Fitur instalasi siap dipicu dari browser Anda. Gunakan tombol instalasi di menu browser Anda.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                      <h4 className="font-sans font-bold text-xs text-slate-800 uppercase tracking-wider">Status Instalasi</h4>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${
                          (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true)
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-amber-500'
                        }`} />
                        <span className="text-xs font-bold text-slate-700">
                          {(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true)
                            ? 'Berjalan sebagai Aplikasi Standalone (PWA)'
                            : 'Berjalan di Browser Web standard'}
                        </span>
                      </div>

                      <div className="border-t border-slate-200 pt-3 space-y-2 text-slate-500 text-xs leading-relaxed font-medium">
                        <p className="font-bold text-slate-700">Panduan Manual:</p>
                        <p><strong>iOS/Safari</strong>: Ketuk tombol <strong>Share (Bagikan) 📤</strong> di bagian bawah, lalu pilih <strong>Add to Home Screen ➕</strong>.</p>
                        <p><strong>Chrome/Android/PC</strong>: Klik tombol menu tiga titik <strong>⁝</strong> di pojok kanan atas, lalu pilih <strong>Install app (Instal aplikasi)</strong>.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* 5. HALAMAN KHUSUS KEUANGAN */}
          {activeTab === 'keuangan' && (
            <FinanceView
              orders={orders}
              currentLang={currentLang}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onBackToDashboard={() => {
                setActiveTab('orders');
                window.history.pushState(null, '', '/admin');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            />
          )}
        </>
      )}

      {/* ORDER EDIT MODAL FORM */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <h3 className="font-black text-slate-950 text-base font-sans uppercase">
                {currentLang === 'id' ? 'EDIT INPUTAN PESANAN' : 'EDIT ORDER INPUT'}
              </h3>
              <button 
                onClick={() => {
                  setIsOrderModalOpen(false);
                  setEditingOrder(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Buyer Name & Phone Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Nama Pembeli' : 'Buyer Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={orderBuyerName}
                    onChange={(e) => setOrderBuyerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'No WA' : 'WhatsApp Number'}
                  </label>
                  <input
                    type="text"
                    required
                    value={orderPhoneNumber}
                    onChange={(e) => setOrderPhoneNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Service/Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Layanan Jasa' : 'Service Type'}
                </label>
                <select
                  value={orderProductId}
                  onChange={(e) => setOrderProductId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                >
                  <option value="">-- {currentLang === 'id' ? 'Pilih Layanan' : 'Select Service'} --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Quantity & Total Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Jumlah (Quantity)' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Total Harga (Rupiah)' : 'Total Price (IDR)'}
                  </label>
                  <input
                    type="number"
                    required
                    value={orderTotalPrice}
                    onChange={(e) => setOrderTotalPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Target Details (Link and/or Phone) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Target Link (Jika ada)' : 'Target Link (If any)'}
                  </label>
                  <input
                    type="text"
                    value={orderTargetLink}
                    onChange={(e) => setOrderTargetLink(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'No WA Target (Spam)' : 'Target Phone (Spam)'}
                  </label>
                  <input
                    type="text"
                    value={orderTargetSpamPhone}
                    onChange={(e) => setOrderTargetSpamPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Catatan (Notes)' : 'Notes'}
                </label>
                <textarea
                  rows={3}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderModalOpen(false);
                    setEditingOrder(null);
                  }}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  {currentLang === 'id' ? 'Batal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer"
                >
                  {currentLang === 'id' ? 'Simpan' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHOPEE EDIT MODAL */}
      {isShopeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <h3 className="font-black text-slate-950 text-base font-sans uppercase">
                {currentLang === 'id' ? 'EDIT INPUTAN PESANAN SHOPEE' : 'EDIT SHOPEE ORDER INPUT'}
              </h3>
              <button 
                onClick={() => {
                  setIsShopeeModalOpen(false);
                  setEditingShopeeOrder(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShopeeOrderEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Nama Toko' : 'Store Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editShpStoreName}
                    onChange={(e) => setEditShpStoreName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Nama Pembeli' : 'Buyer Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editShpBuyerName}
                    onChange={(e) => setEditShpBuyerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Tipe Layanan' : 'Service Type'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editShpServiceType}
                    onChange={(e) => setEditShpServiceType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Jumlah (Quantity)' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editShpQuantity}
                    onChange={(e) => setEditShpQuantity(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Target Link / No WA Target' : 'Target Link / Target Phone'}
                </label>
                <input
                  type="text"
                  required
                  value={editShpTargetLink}
                  onChange={(e) => setEditShpTargetLink(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Catatan (Notes)' : 'Notes'}
                </label>
                <textarea
                  rows={3}
                  value={editShpNotes}
                  onChange={(e) => setEditShpNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none animate-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsShopeeModalOpen(false);
                    setEditingShopeeOrder(null);
                  }}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  {currentLang === 'id' ? 'Batal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer"
                >
                  {currentLang === 'id' ? 'Simpan' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAPS REVIEWS EDIT MODAL */}
      {isMapsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <h3 className="font-black text-slate-950 text-base font-sans uppercase">
                {currentLang === 'id' ? 'EDIT INPUTAN TARGET MAPS' : 'EDIT MAPS TARGET INPUT'}
              </h3>
              <button 
                onClick={() => {
                  setIsMapsModalOpen(false);
                  setEditingMapsReview(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMapsReviewEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Nama Toko' : 'Store Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editMapsStoreName}
                    onChange={(e) => setEditMapsStoreName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Nama Client' : 'Client Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editMapsClientName}
                    onChange={(e) => setEditMapsClientName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Tipe Review' : 'Review Type'}
                  </label>
                  <select
                    value={editMapsReviewType}
                    onChange={(e) => setEditMapsReviewType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white animate-none"
                  >
                    <option value="G_MAPS">Google Maps</option>
                    <option value="TRIPAD">Tripadvisor</option>
                    <option value="REVIEW_APPS">Review Apps</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Target Count' : 'Target Count'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editMapsTargetCount}
                    onChange={(e) => setEditMapsTargetCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Maps Link / Target Link' : 'Target Maps Link'}
                </label>
                <input
                  type="text"
                  required
                  value={editMapsLink}
                  onChange={(e) => setEditMapsLink(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 animate-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Catatan (Notes)' : 'Notes'}
                </label>
                <textarea
                  rows={3}
                  value={editMapsNotes}
                  onChange={(e) => setEditMapsNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none animate-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsMapsModalOpen(false);
                    setEditingMapsReview(null);
                  }}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  {currentLang === 'id' ? 'Batal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer"
                >
                  {currentLang === 'id' ? 'Simpan' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. PRODUCT ADD/EDIT MODAL FORM */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <h3 className="font-black text-slate-950 text-base font-sans uppercase">
                {editingProduct ? t.editProduct : t.addProduct}
              </h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Product Name (Indonesia & English) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{t.prodNameId}</label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Contoh: Review Management Google Maps"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">{t.prodNameEn}</label>
                    <button 
                      type="button" 
                      onClick={async () => {
                        if (prodName) {
                          const translated = await translateText(prodName);
                          setProdNameEn(translated);
                        }
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      {currentLang === 'id' ? 'Terjemahkan Otomatis' : 'Auto-translate'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={prodNameEn}
                    onChange={(e) => setProdNameEn(e.target.value)}
                    placeholder="Example: Google Maps Review Management"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Product Description (Indonesia & English) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{t.prodDescId}</label>
                  <textarea
                    rows={3}
                    required
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="Masukkan deskripsi lengkap layanan jasa..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">{t.prodDescEn}</label>
                    <button 
                      type="button" 
                      onClick={async () => {
                        if (prodDesc) {
                          const translated = await translateText(prodDesc);
                          setProdDescEn(translated);
                        }
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      {currentLang === 'id' ? 'Terjemahkan Otomatis' : 'Auto-translate'}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={prodDescEn}
                    onChange={(e) => setProdDescEn(e.target.value)}
                    placeholder="Enter full English description..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                  />
                </div>
              </div>

              {/* Target Type Option (Link vs Number) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  {currentLang === 'id' ? 'Opsi Input Target (Untuk Pelanggan)' : 'Target Input Option (For Customers)'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label 
                    className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
                      prodTargetType === 'link' 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-bold' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="prodTargetType"
                      value="link"
                      checked={prodTargetType === 'link'}
                      onChange={() => setProdTargetType('link')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black">{currentLang === 'id' ? 'LINK TARGET' : 'TARGET LINK'}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {currentLang === 'id' ? 'Muncul input url/link di checkout' : 'Show URL/link input at checkout'}
                      </span>
                    </div>
                  </label>
                  
                  <label 
                    className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
                      prodTargetType === 'phone' 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-bold' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="prodTargetType"
                      value="phone"
                      checked={prodTargetType === 'phone'}
                      onChange={() => setProdTargetType('phone')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black">{currentLang === 'id' ? 'NOMER TARGET' : 'TARGET NUMBER'}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {currentLang === 'id' ? 'Muncul input no. telepon/WA di checkout' : 'Show phone/WA input at checkout'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Pricing & WA contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{t.pricePerPc}</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">WhatsApp CS</label>
                  <input
                    type="text"
                    required
                    value={prodWa}
                    onChange={(e) => setProdWa(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Product Image Upload with Drag and Drop */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Foto Katalog Produk' : 'Product Catalog Image'}
                </label>
                
                <div 
                  className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                    dragActive 
                      ? 'border-blue-600 bg-blue-50/55' 
                      : imagePreviewUrl 
                        ? 'border-slate-200 bg-slate-50/30' 
                        : 'border-slate-300 hover:border-blue-600 hover:bg-slate-50/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="product-image-upload"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />

                  {imagePreviewUrl ? (
                    <div className="flex flex-col items-center gap-4">
                      <img 
                        src={imagePreviewUrl} 
                        alt="Pratinjau gambar" 
                        className="h-32 w-32 object-cover rounded-xl shadow-md border border-slate-200 animate-in fade-in zoom-in duration-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex gap-2">
                        <label 
                          htmlFor="product-image-upload" 
                          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-all"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>{currentLang === 'id' ? 'Ganti Foto' : 'Change Photo'}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageFile(null);
                            setImagePreviewUrl('');
                            setProdImage('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>{currentLang === 'id' ? 'Hapus' : 'Remove'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label 
                      htmlFor="product-image-upload" 
                      className="flex flex-col items-center gap-2 cursor-pointer py-4"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        {currentLang === 'id' ? 'Klik atau seret foto ke sini untuk mengunggah' : 'Click or drag photo here to upload'}
                      </div>
                      <div className="text-xs text-slate-500 font-light leading-normal">
                        {currentLang === 'id' 
                          ? 'Format file: JPG, PNG, atau WEBP (Maks. 5MB)' 
                          : 'File format: JPG, PNG, or WEBP (Max. 5MB)'}
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingProduct}
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  {isSavingProduct ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{currentLang === 'id' ? 'Menerjemahkan & Menyimpan...' : 'Translating & Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>{t.saveProduct}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
      {/* Custom Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-black text-slate-900 font-sans">Konfirmasi Hapus</h3>
            <p className="text-xs text-slate-500 mt-2">
              Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'shopee_order') {
                    executeDeleteShopeeOrder(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'order') {
                    executeDeleteOrder(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'product') {
                    executeDeleteProduct(deleteConfirm.id);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-red-600/10"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet Integration Hub Modal */}
      <SpreadsheetManagerModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        currentLang={currentLang}
        orders={orders}
        shopeeOrders={shopeeOrders}
        mapsReviews={mapsReviews}
        onRefreshData={loadDashboardData}
        initialTab={spreadsheetModalTab}
      />

    </div>
  );
}
