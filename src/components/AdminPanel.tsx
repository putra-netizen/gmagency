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
  dbGetOrders, dbUpdateOrder, dbDeleteOrder, dbGetDashboardStats,
  dbGetShopeeOrders, dbUpdateShopeeOrder, dbDeleteShopeeOrder,
  dbGetMapsReviews, dbUpdateMapsReview, dbDeleteMapsReview,
  dbUploadProductImage
} from '../lib/supabase';
import { getAdminShpLogs, clearAdminShpLogs, AdminShpLog, logAdminShpAction } from '../utils/adminshpLogs';
import { formatRupiah } from './ProductCard';
import { getQrisConfig, saveQrisConfig, resetQrisConfig } from '../utils/qrisHelper';
import { toast } from '../utils/toast';
import { 
  TrendingUp, ShoppingBag, DollarSign, Clock, CheckCircle2, 
  Plus, Edit, Trash2, Eye, Link2, Phone, Calendar, RefreshCw, 
  Briefcase, Save, AlertCircle, FileText, Check, Database, X,
  ExternalLink, Image as ImageIcon, Settings, ShoppingCart, Copy, ArrowLeft,
  Star, MapPin, Upload, Users, Key, ShieldAlert, Search, FileDown
} from 'lucide-react';

interface AdminPanelProps {
  currentLang: Language;
}

export default function AdminPanel({ currentLang }: AdminPanelProps) {
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
  
  // Tab states: 'orders' | 'shopee_orders' | 'maps_reviews' | 'settings'
  const [activeTab, setActiveTab] = useState<'orders' | 'shopee_orders' | 'maps_reviews' | 'settings'>('orders');
  // Settings view nested tab states
  const [activeSettingsTab, setActiveSettingsTab] = useState<'products' | 'spreadsheet' | 'account_access' | 'qris_config'>('products');

  // Custom credentials state for adminshp1..4
  const [adminshpCreds, setAdminshpCreds] = useState<Record<string, { username: string; password: string }>>(() => {
    try {
      const saved = localStorage.getItem('gm_adminshp_creds');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            adminshp1: parsed.adminshp1 || { username: 'adminshp1', password: 'gmadminshp1' },
            adminshp2: parsed.adminshp2 || { username: 'adminshp2', password: 'gmadminshp2' },
            adminshp3: parsed.adminshp3 || { username: 'adminshp3', password: 'gmadminshp3' },
            adminshp4: parsed.adminshp4 || { username: 'adminshp4', password: 'gmadminshp4' }
          };
        }
      }
    } catch (e) {}
    return {
      adminshp1: { username: 'adminshp1', password: 'gmadminshp1' },
      adminshp2: { username: 'adminshp2', password: 'gmadminshp2' },
      adminshp3: { username: 'adminshp3', password: 'gmadminshp3' },
      adminshp4: { username: 'adminshp4', password: 'gmadminshp4' }
    };
  });

  const [editingCreds, setEditingCreds] = useState(() => adminshpCreds);

  // Sync editingCreds when adminshpCreds changes
  useEffect(() => {
    setEditingCreds(adminshpCreds);
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
  const [sortUnpaid, setSortUnpaid] = useState<'pending' | 'progress' | 'done'>('pending');
  const [timeFilterUnpaid, setTimeFilterUnpaid] = useState<'all' | 'week' | 'month'>('all');

  const [searchPaid, setSearchPaid] = useState('');
  const [sortPaid, setSortPaid] = useState<'pending' | 'progress' | 'done'>('pending');
  const [timeFilterPaid, setTimeFilterPaid] = useState<'all' | 'week' | 'month'>('all');

  const [searchShopee, setSearchShopee] = useState('');
  const [sortShopee, setSortShopee] = useState<'pending' | 'progress' | 'ready' | 'sudah_direkap' | 'done'>('pending');
  const [timeFilterShopee, setTimeFilterShopee] = useState<'all' | 'week' | 'month'>('all');

  const [searchReview, setSearchReview] = useState('');
  const [sortReview, setSortReview] = useState<'pending' | 'progress' | 'ready' | 'sudah_direkap' | 'done'>('pending');
  const [timeFilterReview, setTimeFilterReview] = useState<'all' | 'week' | 'month'>('all');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'SEMUA' | 'TRIPAD' | 'GMAPS' | 'REVIEW APPS'>('SEMUA');

  const isWithinTimeframe = (createdAtStr: string | undefined, timeframe: 'all' | 'week' | 'month') => {
    if (timeframe === 'all' || !createdAtStr) return true;
    const dateObj = new Date(createdAtStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (timeframe === 'week') return diffDays <= 7;
    if (timeframe === 'month') return diffDays <= 30;
    return true;
  };

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('gm_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Spreadsheet integration states
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(() => {
    try {
      return localStorage.getItem('gm_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/1y6vjAeo9qW_3V3X27I106R6kC_u_gX50rLzRE9fVp6A/edit';
    } catch (e) {
      return 'https://docs.google.com/spreadsheets/d/1y6vjAeo9qW_3V3X27I106R6kC_u_gX50rLzRE9fVp6A/edit';
    }
  });
  const [sheetName, setSheetName] = useState(() => {
    try {
      return localStorage.getItem('gm_sheet_name') || 'Pesanan';
    } catch (e) {
      return 'Pesanan';
    }
  });
  const [isSpreadsheetConnected, setIsSpreadsheetConnected] = useState(() => {
    try {
      return localStorage.getItem('gm_spreadsheet_connected') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Authentication handlers
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'gmadmin') {
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem('gm_admin_auth', 'true');
      } catch (err) {
        console.warn('Session storage restricted', err);
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
    } catch (err) {
      console.warn('Session storage restricted', err);
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
    window.addEventListener('admin-logout', onNavbarLogout);
    window.addEventListener('admin-refresh', onNavbarRefresh);
    return () => {
      window.removeEventListener('admin-logout', onNavbarLogout);
      window.removeEventListener('admin-refresh', onNavbarRefresh);
    };
  }, []);

  // Spreadsheet settings handlers
  const handleSaveSpreadsheetSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('gm_spreadsheet_url', spreadsheetUrl);
      localStorage.setItem('gm_sheet_name', sheetName);
      localStorage.setItem('gm_spreadsheet_connected', 'true');
    } catch (err) {
      console.warn('Local storage restricted', err);
    }
    setIsSpreadsheetConnected(true);
    toast.success(currentLang === 'id' ? 'Pengaturan koneksi spreadsheet berhasil disimpan!' : 'Spreadsheet connection settings saved successfully!');
  };

  const handleDisconnectSpreadsheet = () => {
    try {
      localStorage.removeItem('gm_spreadsheet_connected');
    } catch (err) {
      console.warn('Local storage restricted', err);
    }
    setIsSpreadsheetConnected(false);
    setSyncResult(null);
    toast.info(currentLang === 'id' ? 'Koneksi spreadsheet diputuskan.' : 'Spreadsheet connection disconnected.');
  };

  const handleSyncSpreadsheet = () => {
    if (!isSpreadsheetConnected) {
      toast.error(currentLang === 'id' ? 'Silakan simpan pengaturan koneksi spreadsheet terlebih dahulu!' : 'Please save spreadsheet connection settings first!');
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncResult(currentLang === 'id' 
        ? `Sync Sukses! Berhasil menyinkronkan ${orders.length} data pesanan ke Google Sheets pada lembar "${sheetName}".` 
        : `Sync Success! Successfully synchronized ${orders.length} orders data to Google Sheets on sheet "${sheetName}".`
      );
    }, 1800);
  };

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
      dbGetProducts().then(prodsData => setProducts(prodsData)).catch(err => console.error(err));
      dbGetOrders().then(ordsData => setOrders(ordsData)).catch(err => console.error(err));
      dbGetShopeeOrders().then(shopeeData => setShopeeOrders(shopeeData)).catch(err => console.error(err));
      dbGetMapsReviews().then(mapsData => setMapsReviews(mapsData)).catch(err => console.error(err));
      dbGetDashboardStats().then(statsData => setStats(statsData)).catch(err => console.error(err));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkLocationRoute = () => {
      if (isTabClicking.current) return;
      const pathname = window.location.pathname;
      if (pathname === '/admin/settings' || pathname === '/admin/settings/') {
        setActiveTab('settings');
      } else if (pathname === '/admin' || pathname === '/admin/') {
        setActiveTab(prev => prev === 'settings' ? 'orders' : prev);
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
    try {
      await dbUpdateOrder(orderId, { payment_status: newStatus });
      
      // Update local states
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: newStatus } : o));
      
      // Refresh stats automatically
      const updatedStats = await dbGetDashboardStats();
      setStats(updatedStats);
    } catch (err) {
      console.error(err);
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
    try {
      await dbUpdateShopeeOrder(id, { status });
      setShopeeOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status Shopee');
    }
  };

  const handleUpdateMapsStatus = async (id: string, status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE') => {
    try {
      await dbUpdateMapsReview(id, { status });
      setMapsReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status Review');
    }
  };

  const handleUpdateProofLink = async (reviewId: string, value: string) => {
    const status = value.trim() !== '' ? 'DONE' : 'PENDING';
    try {
      await dbUpdateMapsReview(reviewId, {
        proof_link: value,
        status: status
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, proof_link: value, status: status } : r));
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
    const nameToAdd = tempAccountInput[reviewId]?.trim();
    if (!nameToAdd) return;

    const targetReview = mapsReviews.find(r => r.id === reviewId);
    if (!targetReview) return;

    const updatedAccounts = [...(targetReview.reviewer_accounts || []), nameToAdd];
    
    try {
      await dbUpdateMapsReview(reviewId, {
        reviewer_accounts: updatedAccounts
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reviewer_accounts: updatedAccounts } : r));
      setTempAccountInput(prev => ({ ...prev, [reviewId]: '' }));
      logAdminShpAction('Main Admin', 'Tambah Reviewer', `Menambahkan akun reviewer "${nameToAdd}" ke review store "${targetReview.store_name}"`);
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? `Gagal menambah akun progres: ${err instanceof Error ? err.message : String(err)}` : `Failed to add progress account: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Remove Reviewer Account Name
  const handleRemoveReviewerAccount = async (reviewId: string, indexToRemove: number) => {
    const targetReview = mapsReviews.find(r => r.id === reviewId);
    if (!targetReview) return;

    const updatedAccounts = (targetReview.reviewer_accounts || []).filter((_, idx) => idx !== indexToRemove);

    try {
      await dbUpdateMapsReview(reviewId, {
        reviewer_accounts: updatedAccounts
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reviewer_accounts: updatedAccounts } : r));
      logAdminShpAction('Main Admin', 'Hapus Reviewer', `Menghapus akun reviewer dari review store "${targetReview.store_name}"`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus akun progres.');
    }
  };

  // Helper to generate a highly polished single-page PDF of Google Maps Reviewers list
  const generateMapsReportPDF = (item: MapsReview) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const dateStr = new Date(item.created_at).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      // 1. Title / Brand Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(37, 99, 235); // Tailwind Blue 600
      doc.text("GM AGENCY", 15, 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(59, 130, 246); // Tailwind Blue 500
      doc.text("GOOGLE MAPS REVIEWER LIST REPORT", 15, 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Tanggal Laporan: ${dateStr}`, 195, 22, { align: 'right' });

      // Divider Line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(15, 33, 195, 33);

      // 2. Metadata Block/Card (Fills x=15 to x=195, height = 30mm)
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.roundedRect(15, 38, 180, 30, 3, 3, 'F');
      doc.setDrawColor(241, 245, 249); // Slate 100
      doc.roundedRect(15, 38, 180, 30, 3, 3, 'S');

      // Client name column
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("NAMA CLIENT:", 20, 45);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(item.client_name.toUpperCase(), 20, 51);

      // Progress column
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("PROGRES ULASAN:", 115, 45);

      const count = item.reviewer_accounts?.length || 0;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`${count} dari ${item.target_count} Target Selesai`, 115, 51);

      // Maps Link full width
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("LINK GOOGLE MAPS:", 20, 59);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      // Truncate maps link if extremely long
      let mapsLink = item.maps_link;
      if (mapsLink.length > 95) {
        mapsLink = mapsLink.substring(0, 92) + '...';
      }
      doc.text(mapsLink, 20, 64);

      // 3. Accounts Grid Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text("DAFTAR AKUN REVIEWER REAL SELESAI:", 15, 77);

      // 4. Draw Accounts in Grid
      const accounts = item.reviewer_accounts || [];
      const totalAccounts = accounts.length;

      if (totalAccounts === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text("Belum ada ulasan akun yang selesai diinput.", 20, 88);
      } else {
        // Calculate dynamic grid parameters to fit exactly in one page
        let numCols = 3;
        let rowHeight = 7;
        let fontSize = 8;
        let verticalSpacing = 2; // spacing between cards

        if (totalAccounts <= 24) {
          numCols = 2;
          rowHeight = 8;
          fontSize = 9;
          verticalSpacing = 2.5;
        } else if (totalAccounts <= 60) {
          numCols = 3;
          rowHeight = 7.2;
          fontSize = 8;
          verticalSpacing = 2;
        } else {
          // If a lot of accounts (e.g. 60 to 120), use 4 columns to fit in 1 page!
          numCols = 4;
          rowHeight = 6.2;
          fontSize = 7;
          verticalSpacing = 1.2;
        }

        const colWidth = (180 - (numCols - 1) * 3) / numCols;
        const colGap = 3;
        const startX = 15;
        const startY = 82;

        accounts.forEach((acc, index) => {
          const colIndex = index % numCols;
          const rowIndex = Math.floor(index / numCols);
          const x = startX + colIndex * (colWidth + colGap);
          const y = startY + rowIndex * (rowHeight + verticalSpacing);

          // Draw a soft rounded rect for each account
          doc.setFillColor(248, 250, 252); // Slate 50
          doc.roundedRect(x, y, colWidth, rowHeight, 1.2, 1.2, 'F');
          doc.setDrawColor(226, 232, 240); // Slate 200
          doc.roundedRect(x, y, colWidth, rowHeight, 1.2, 1.2, 'S');

          // Number badge background
          doc.setFillColor(219, 234, 254); // Blue 100
          doc.roundedRect(x + 1.2, y + 1.2, rowHeight - 2.4, rowHeight - 2.4, 0.8, 0.8, 'F');

          // Number text
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fontSize - 1.5);
          doc.setTextColor(29, 78, 216); // Blue 700
          doc.text((index + 1).toString(), x + 1.2 + (rowHeight - 2.4)/2, y + 1.2 + (rowHeight - 2.4)/2 + (fontSize - 1.5)/4 + 0.3, { align: 'center' });

          // Account name text
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fontSize);
          doc.setTextColor(51, 65, 85); // Slate 700

          const maxTextWidth = colWidth - (rowHeight + 1);
          let truncatedAcc = acc;
          if (doc.getTextWidth(acc) > maxTextWidth) {
            while (doc.getTextWidth(truncatedAcc + '...') > maxTextWidth && truncatedAcc.length > 0) {
              truncatedAcc = truncatedAcc.slice(0, -1);
            }
            truncatedAcc += '...';
          }
          doc.text(truncatedAcc, x + rowHeight + 0.5, y + rowHeight / 2 + fontSize / 4 - 0.2);
        });
      }

      // 5. Footer (Single Page forced)
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("* Laporan ini sah dan dibuat secara otomatis oleh sistem GM AGENCY.", 15, 285);
      doc.text("Halaman 1 dari 1 (Dokumen 1 Lembar)", 195, 285, { align: 'right' });

      // Save PDF
      doc.save(`Laporan_GM_Agency_${item.client_name.replace(/\s+/g, '_')}.pdf`);
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
    const currentOrder = orders.find(o => o.id === orderId);
    if ((status === 'taken' || status === 'done') && (!currentOrder || !currentOrder.worker_id)) {
      toast.error(currentLang === 'id' ? 'Harap masukkan worker terlebih dahulu baru bisa mengubah status diproses/selesai!' : 'Please assign a worker first before changing status to in progress/done!');
      return;
    }
    try {
      const updatePayload: Partial<Order> = {
        worker_status: status,
        ...(status === 'unassigned' ? { worker_id: undefined, worker_proof_url: undefined } : {})
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
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="admin-panel-container">
      
      {/* Header with action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5 mb-8">
        <div>
          {activeTab === 'settings' ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveTab('orders');
                  window.history.pushState(null, '', '/admin');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all cursor-pointer border border-slate-200/50"
                id="admin-settings-back-btn"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{currentLang === 'id' ? 'Kembali' : 'Back'}</span>
              </button>
              <div className="h-6 w-px bg-slate-200" />
              <Settings className="h-6 w-6 text-blue-600 animate-spin-slow" />
              <h1 className="text-2xl font-black text-slate-950 font-sans tracking-tight uppercase">
                Settings Admin
              </h1>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-black text-slate-950 font-sans tracking-tight uppercase">
                {t.adminTitle}
              </h1>
            </div>
          )}
          <p className="text-sm text-slate-500 font-medium mt-2">
            {activeTab === 'settings' 
              ? 'Kelola katalog layanan, harga produk, dan sinkronisasi Google Spreadsheet.'
              : t.adminStats
            }
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-4 text-sm font-semibold text-red-700 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Conditionally hide the stats dashboard and tabs if activeTab is 'settings' */}
      {activeTab !== 'settings' && (
        <>
          {/* 1. STATS OVERVIEW ROW (Financial Dashboard Card) - Highly Polished & Organized */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              Ikhtisar Keuangan & Kinerja Operasional
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Featured Financial Card */}
              <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 dark:from-slate-950 dark:to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pendapatan</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                      <DollarSign className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-emerald-400 select-all">
                    {formatRupiah(stats?.totalRevenue ?? 0)}
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-800/80 relative z-10 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Total Akumulasi Transaksi</span>
                  <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md font-bold text-[10px]">Lunas</span>
                </div>
              </div>

              {/* Sub Metrics Grid */}
              <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                {/* Web Orders */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/80 dark:border-slate-800/50 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Web Orders</span>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                      {orders.length} <span className="text-xs font-medium text-slate-400">pesanan</span>
                    </span>
                  </div>
                </div>

                {/* Shopee Orders */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/80 dark:border-slate-800/50 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Shopee Orders</span>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                      {shopeeOrders.length} <span className="text-xs font-medium text-slate-400">pesanan</span>
                    </span>
                  </div>
                </div>

                {/* Pending Orders */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/80 dark:border-slate-800/50 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4 animate-pulse" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.pendingOrders}</span>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                      {stats?.pendingOrders ?? 0} <span className="text-xs font-medium text-slate-400">menunggu</span>
                    </span>
                  </div>
                </div>

                {/* Completed Orders */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/80 dark:border-slate-800/50 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.completedOrders}</span>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block">
                      {stats?.completedOrders ?? 0}
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-2">({getCompletedPercentage()}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
                  ? 'border-blue-600 text-blue-600'
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
                  ? 'border-blue-600 text-blue-600'
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
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              id="tab-maps-reviews"
            >
              <Star className="h-4 w-4 animate-pulse" />
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
                
                {/* Minimalist sorting / filtering controls */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                  {/* Status / Progres Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Progres:</span>
                    {(['pending', 'progress', 'done'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSortUnpaid(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          sortUnpaid === opt
                            ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'pending' ? 'Pending' : opt === 'progress' ? 'Progres' : 'Done'}
                      </button>
                    ))}
                  </div>

                  {/* Timeframe Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Waktu:</span>
                    {(['all', 'week', 'month'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTimeFilterUnpaid(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          timeFilterUnpaid === opt
                            ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'all' ? (currentLang === 'id' ? 'Semua' : 'All') : opt === 'week' ? (currentLang === 'id' ? 'Minggu' : 'Week') : (currentLang === 'id' ? 'Bulan' : 'Month')}
                      </button>
                    ))}
                  </div>
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
                <div className="overflow-x-auto">
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
                        filteredUnpaidOrders.map((order) => (
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
                                    diinput oleh {adminshpCreds[order.created_by]?.username || order.created_by}
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
                                <span className="font-semibold text-slate-900 block truncate" title={order.product_name}>
                                  {order.product_name}
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
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
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

                {/* Minimalist sorting / filtering controls */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                  {/* Status / Progres Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Progres:</span>
                    {(['pending', 'progress', 'done'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSortPaid(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          sortPaid === opt
                            ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'pending' ? 'Pending' : opt === 'progress' ? 'Progres' : 'Done'}
                      </button>
                    ))}
                  </div>

                  {/* Timeframe Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Waktu:</span>
                    {(['all', 'week', 'month'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTimeFilterPaid(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          timeFilterPaid === opt
                            ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'all' ? (currentLang === 'id' ? 'Semua' : 'All') : opt === 'week' ? (currentLang === 'id' ? 'Minggu' : 'Week') : (currentLang === 'id' ? 'Bulan' : 'Month')}
                      </button>
                    ))}
                  </div>
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
                <div className="overflow-x-auto">
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
                        filteredPaidOrders.map((order) => {
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
                                      diinput oleh {adminshpCreds[order.created_by]?.username || order.created_by}
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
                                  <span className="font-semibold text-slate-900 block truncate" title={order.product_name}>
                                    {order.product_name}
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
                                </td>


                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
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
                  {/* Status / Progres Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Progres:</span>
                    {(['pending', 'progress', 'ready', 'sudah_direkap', 'done'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSortShopee(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          sortShopee === opt
                            ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'pending' ? 'Pending' : opt === 'progress' ? 'Progres' : opt === 'ready' ? 'Ready' : opt === 'sudah_direkap' ? 'Sudah Direkap' : 'Done'}
                      </button>
                    ))}
                  </div>

                  {/* Timeframe Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Waktu:</span>
                    {(['all', 'week', 'month'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTimeFilterShopee(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          timeFilterShopee === opt
                            ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'all' ? (currentLang === 'id' ? 'Semua' : 'All') : opt === 'week' ? (currentLang === 'id' ? 'Minggu' : 'Week') : (currentLang === 'id' ? 'Bulan' : 'Month')}
                      </button>
                    ))}
                  </div>
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
                  <table className="w-full text-left border-collapse table-fixed">
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
                        filteredShopeeOrders.map((order) => (
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
                                  diinput oleh {adminshpCreds[order.created_by]?.username || order.created_by}
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
                              <textarea
                                value={order.work_order || ''}
                                onChange={(e) => handleUpdateShopeeWorkOrder(order.id, e.target.value)}
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
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : order.status === 'READY'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : order.status === 'SUDAH DIREKAP'
                                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
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
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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

                  {/* Tipe Review Filter - Coretan Warna Biru */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]" id="admin-tipe-review-filter">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Tipe Review:</span>
                    {(['SEMUA', 'TRIPAD', 'GMAPS', 'REVIEW APPS'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setReviewTypeFilter(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          reviewTypeFilter === opt
                            ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minimalist sorting / filtering controls */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                  {/* Status / Progres Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Progres:</span>
                    {(['pending', 'progress', 'ready', 'sudah_direkap', 'done'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSortReview(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          sortReview === opt
                            ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'pending' ? 'Pending' : opt === 'progress' ? 'Progres' : opt === 'ready' ? 'Ready' : opt === 'sudah_direkap' ? 'Sudah Direkap' : 'Done'}
                      </button>
                    ))}
                  </div>

                  {/* Timeframe Filter (Minimalist badge/pills style) */}
                  <div className="flex items-center gap-1.5 bg-white/60 p-1 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider px-1.5">Waktu:</span>
                    {(['all', 'week', 'month'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTimeFilterReview(opt)}
                        className={`px-2.5 py-1 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase ${
                          timeFilterReview === opt
                            ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {opt === 'all' ? (currentLang === 'id' ? 'Semua' : 'All') : opt === 'week' ? (currentLang === 'id' ? 'Minggu' : 'Week') : (currentLang === 'id' ? 'Bulan' : 'Month')}
                      </button>
                    ))}
                  </div>
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
                  <table className="w-full text-left border-collapse table-fixed">
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
                        <th className="px-4 py-3">Catatan</th>
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
                        filteredMapsReviews.map((review) => (
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
                                  diinput oleh {adminshpCreds[review.created_by]?.username || review.created_by}
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
                                  : review.review_type === 'TRIPADVISOR' || review.review_type === 'REVIEW_TRIPAD'
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

                                    <div className="flex gap-1">
                                      <input
                                        type="text"
                                        placeholder="Nama Akun Reviewer"
                                        value={tempAccountInput[review.id] || ''}
                                        onChange={e => setTempAccountInput(prev => ({ ...prev, [review.id]: e.target.value }))}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddReviewerAccount(review.id);
                                          }
                                        }}
                                        className="rounded border border-slate-200 px-2 py-1 text-[10px] outline-none focus:border-blue-500 flex-grow font-sans bg-white min-w-0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddReviewerAccount(review.id)}
                                        className="bg-blue-600 text-white rounded p-1 hover:bg-blue-700 transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                                      >
                                        <Plus className="h-3 w-3" />
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
                                        onClick={() => generateMapsReportPDF(review)}
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

                            {/* Notes */}
                            <td className="px-4 py-3">
                              {review.notes ? (
                                <p className="text-[11px] text-slate-600 italic truncate" title={review.notes}>
                                  "{review.notes}"
                                </p>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Link Bukti Pengerjaan */}
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                placeholder="Link bukti pengerjaan..."
                                value={review.proof_link || ''}
                                onChange={(e) => handleUpdateProofLink(review.id, e.target.value)}
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
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : review.status === 'READY'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : review.status === 'SUDAH DIREKAP'
                                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
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
                            </td>


                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. SETTINGS VIEW WITH PRODUCT MGMT AND SPREADSHEET SYNC */}
          {activeTab === 'settings' && (
            <div className="space-y-6" id="admin-settings-dashboard">
              {/* Inner settings tabs */}
              <div className="flex gap-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveSettingsTab('products')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSettingsTab === 'products'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>Manajemen Layanan & Produk</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSettingsTab('spreadsheet')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSettingsTab === 'spreadsheet'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Google Spreadsheet Sync</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSettingsTab('account_access')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSettingsTab === 'account_access'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Hak Akses Akun</span>
                </button>
              </div>

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

              {activeSettingsTab === 'spreadsheet' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="spreadsheet-sync-panel">
                  {/* Left Form (7 columns) */}
                  <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-900 font-sans uppercase tracking-tight flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Koneksi Google Spreadsheet
                      </h3>
                      <p className="text-xs text-slate-400 font-medium font-sans">
                        Konfigurasikan lembar kerja target Anda untuk melakukan sinkronisasi pesanan.
                      </p>
                    </div>

                    <form onSubmit={handleSaveSpreadsheetSettings} className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase">Google Spreadsheet URL / ID</label>
                        <input
                          type="url"
                          required
                          value={spreadsheetUrl}
                          onChange={(e) => setSpreadsheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/your-id-here/edit"
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase">Nama Lembar Kerja (Sheet Name)</label>
                        <input
                          type="text"
                          required
                          value={sheetName}
                          onChange={(e) => setSheetName(e.target.value)}
                          placeholder="Pesanan"
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          type="submit"
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer font-sans"
                        >
                          <Save className="h-4 w-4" />
                          <span>Simpan Pengaturan</span>
                        </button>

                        {isSpreadsheetConnected && (
                          <button
                            type="button"
                            onClick={handleDisconnectSpreadsheet}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer font-sans"
                          >
                            Putuskan Koneksi
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="border-t border-slate-100 pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        Status Sinkronisasi
                      </h4>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${isSpreadsheetConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-700">
                              {isSpreadsheetConnected ? 'Spreadsheet Terkoneksi' : 'Koneksi Tidak Aktif'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {isSpreadsheetConnected ? `Menyinkronkan ke lembar "${sheetName}"` : 'Harap simpan URL spreadsheet untuk memulai'}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isSyncing || !isSpreadsheetConnected}
                          onClick={handleSyncSpreadsheet}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition-colors cursor-pointer font-sans ${
                            isSpreadsheetConnected
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi Sekarang'}</span>
                        </button>
                      </div>

                      {syncResult && (
                        <div className="flex items-start gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 p-4 rounded-xl text-xs font-medium leading-relaxed">
                          <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                          <span>{syncResult}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Guide (5 columns) */}
                  <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-100 p-6 space-y-4">
                    <h4 className="text-xs font-black text-slate-900 font-sans uppercase tracking-wider">
                      Panduan Integrasi Google Sheets
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-light font-sans">
                      Ikuti langkah-langkah berikut untuk menghubungkan database GM AGENCY dengan Google Spreadsheet Anda secara mandiri:
                    </p>

                    <div className="space-y-4 pt-2">
                      <div className="flex gap-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-extrabold text-[10px]">
                          1
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 block">Buat Google Spreadsheet Baru</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                            Buat spreadsheet baru atau gunakan spreadsheet yang sudah ada di akun Google Drive Anda.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-extrabold text-[10px]">
                          2
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 block">Bagikan Hak Akses Editor</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                            Bagikan lembar kerja Anda ke email Service Account GM AGENCY berikut dengan izin akses sebagai Editor:
                          </p>
                          <div className="bg-white px-2.5 py-1.5 rounded border border-slate-200 text-[10px] font-mono text-slate-600 select-all break-all w-full block">
                            gm-sheets-sync@gm-agency-3000.iam.gserviceaccount.com
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-extrabold text-[10px]">
                          3
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 block">Masukkan URL Spreadsheet</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                            Salin URL penuh spreadsheet Anda dari address bar peramban, masukkan ke formulir koneksi, lalu simpan.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-extrabold text-[10px]">
                          4
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 block">Lakukan Sinkronisasi</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                            Tekan tombol "Sinkronisasi Sekarang" untuk mengunggah dan memperbarui seluruh data transaksi penjualan secara aman.
                          </p>
                        </div>
                      </div>
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
            </div>
          )}
        </>
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

    </div>
  );
}
