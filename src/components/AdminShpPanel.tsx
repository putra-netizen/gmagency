import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { 
  dbGetShopeeOrders, 
  dbCreateShopeeOrder, 
  dbUpdateShopeeOrder, 
  dbDeleteShopeeOrder, 
  dbGetMapsReviews, 
  dbCreateMapsReview, 
  dbUpdateMapsReview, 
  dbDeleteMapsReview,
  dbGetReportMaps,
  dbCreateReportMap,
  dbUpdateReportMap,
  dbDeleteReportMap,
  dbIsSupabaseConnected
} from '../lib/supabase';
import { logAdminShpAction } from '../utils/adminshpLogs';
import { toast } from '../utils/toast';
import { generateMapsReportPDF } from '../utils/pdfGenerator';
import { ShopeeOrder, MapsReview, ReportMap } from '../types';
import { loginWithBackend, clientLogout, getAuthUser } from '../lib/auth';
import { MonthlyDateRangePicker, TimeFilterConfig, isWithinCustomTimeframe } from './MonthlyDateRangePicker';
import { ModernFilterSelect } from './ModernFilterSelect';
import { 
  Copy, 
  Plus, 
  Check, 
  Trash2, 
  Edit,
  User, 
  ExternalLink, 
  FileText, 
  MessageSquare, 
  MapPin, 
  Star,
  RefreshCw,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Send,
  PhoneCall,
  CheckCircle2,
  Table,
  FileDown,
  Search,
  Database,
  Users,
  Download,
  FileSpreadsheet,
  X,
  ShieldCheck,
  Zap,
  Clock,
  Filter,
  Activity,
  Link2,
  ListTodo,
  Mail
} from 'lucide-react';
import { pauseAutoSyncFor } from '../utils/autoSyncManager';
import { 
  generateShopeeOrdersCsv, 
  generateMapsReviewsCsv, 
  downloadCsvFile,
  parseAccountsList
} from '../utils/csvExport';
import { sanitizeUrl } from '../utils/security';

interface AdminShpPanelProps {
  currentLang: 'id' | 'en';
  onReturnToGmAdmin?: () => void;
  viewAsSlot?: string | null;
}

const WORKERS = ['rehan', 'deky', 'panca', 'anggun', 'riyanto', 'bintang'];

const getSlotRouteName = (slot: string): string => {
  try {
    const saved = localStorage.getItem('gm_adminshp_creds');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && parsed[slot]?.username) {
        return parsed[slot].username.trim().toLowerCase();
      }
    }
  } catch (e) {}
  if (slot === 'adminshp1') return 'adminera';
  if (slot === 'adminshp2') return 'admincika';
  if (slot === 'adminshp3') return 'adminvira';
  if (slot === 'adminshp4') return 'adminali';
  return slot;
};

const getSlotFromRouteName = (routeName: string): string | null => {
  const clean = routeName.replace(/^\//, '').trim().toLowerCase();
  if (clean === 'adminshp' || clean === '') return null;
  try {
    const saved = localStorage.getItem('gm_adminshp_creds');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        for (const slot of ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4']) {
          if (parsed[slot]?.username?.trim()?.toLowerCase() === clean) {
            return slot;
          }
        }
      }
    }
  } catch (e) {}
  // Default fallback
  if (clean === 'adminera' || clean === 'adminshp1') return 'adminshp1';
  if (clean === 'admincika' || clean === 'adminshp2') return 'adminshp2';
  if (clean === 'adminvira' || clean === 'adminshp3') return 'adminshp3';
  if (clean === 'adminali' || clean === 'adminshp4') return 'adminshp4';
  return null;
};

const ITEMS_PER_PAGE = 25;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeBgColor?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  activeBgColor = 'bg-blue-600'
}) => {
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            currentPage === i
              ? `${activeBgColor} text-white`
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100 sm:px-6 mt-4">
      <div className="flex items-center justify-between flex-1 sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        >
          Previous
        </button>
        <span className="text-[11px] font-bold text-slate-600 font-mono">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-slate-700">
            Page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md -space-x-px gap-1" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {renderPageNumbers()}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const getSlotIndicatorName = (slot: string): string => {
  const clean = slot?.trim()?.toLowerCase();
  if (clean === 'adminshp1' || clean === 'adminera' || clean === 'era' || clean === 'adminera@gmail.com') return 'era';
  if (clean === 'adminshp2' || clean === 'admincika' || clean === 'cika' || clean === 'admincika@gmail.com') return 'cika';
  if (clean === 'adminshp3' || clean === 'adminvira' || clean === 'vira' || clean === 'adminvira@gmail.com') return 'vira';
  if (clean === 'adminshp4' || clean === 'adminali' || clean === 'ali' || clean === 'adminali@gmail.com') return 'ali';
  if (clean === 'admin' || clean === 'gmowner' || clean === 'owner' || clean === 'gmowner@gmail.com') return 'owner';
  return slot;
};

const isSameInputer = (creator?: string, currentUser?: string): boolean => {
  if (!creator) return true;
  if (!currentUser) return false;
  const c1 = getSlotIndicatorName(creator);
  const c2 = getSlotIndicatorName(currentUser);
  if (c2 === 'owner' || c2 === 'admin') return true;
  return c1 === c2;
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

export default function AdminShpPanel({ currentLang, onReturnToGmAdmin, viewAsSlot }: AdminShpPanelProps) {
  const activeViewAsSlot = viewAsSlot || (typeof window !== 'undefined' ? sessionStorage.getItem('gm_view_as_shp') : null);
  const isViewAsMode = Boolean(activeViewAsSlot);

  // Authentication states
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isViewAsMode) return true;
    try {
      const user = getAuthUser();
      if (user?.role === 'adminshp' || user?.role === 'admin') return true;
      const isAuth = sessionStorage.getItem('gm_adminshp_auth') === 'true' || localStorage.getItem('gm_adminshp_auth') === 'true';
      return isAuth;
    } catch (e) {
      return false;
    }
  });
  const [currentAdminUser, setCurrentAdminUser] = useState<string>(() => {
    if (activeViewAsSlot) return activeViewAsSlot;
    try {
      const user = getAuthUser();
      if (user?.slot) return user.slot;
      return sessionStorage.getItem('gm_adminshp_user') || localStorage.getItem('gm_adminshp_user') || 'adminshp1';
    } catch (e) {
      return 'adminshp1';
    }
  });
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Tabs: 'shopee' (Shopee Orders), 'maps' (Review Maps), 'report_maps' (Report Maps)
  const [activeTab, setActiveTab] = useState<'shopee' | 'maps' | 'report_maps'>('shopee');

  // Search & Sort states for tables
  const [searchShopee, setSearchShopee] = useState('');
  const [sortShopee, setSortShopee] = useState<'all' | 'pending' | 'progress' | 'ready' | 'sudah_direkap' | 'done'>('all');
  const [shopeeTypeFilter, setShopeeTypeFilter] = useState<'all' | 'report' | 'spam_wa'>('all');
  const [timeFilterShopee, setTimeFilterShopee] = useState<TimeFilterConfig>({ mode: 'all' });
  const [pageShopee, setPageShopee] = useState(1);

  // States for REVIEW MAPS tab ('maps')
  const [searchMaps, setSearchMaps] = useState('');
  const [sortMaps, setSortMaps] = useState<'all' | 'pending' | 'progress' | 'ready' | 'sudah_direkap' | 'done'>('all');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'all' | 'TRIPAD' | 'GMAPS' | 'REVIEW APPS'>('all');
  const [timeFilterMaps, setTimeFilterMaps] = useState<TimeFilterConfig>({ mode: 'all' });
  const [pageMaps, setPageMaps] = useState(1);

  // States for REPORT MAPS tab ('report_maps')
  const [searchReportMaps, setSearchReportMaps] = useState('');
  const [sortReportMaps, setSortReportMaps] = useState<'all' | 'pending' | 'progress' | 'ready' | 'sudah_direkap' | 'done'>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | 'GMAPS' | 'TRIPAD' | 'REVIEW APPS'>('all');
  const [timeFilterReportMaps, setTimeFilterReportMaps] = useState<TimeFilterConfig>({ mode: 'all' });
  const [pageReportMaps, setPageReportMaps] = useState(1);

  const recentLocalStatusUpdates = useRef<Map<string, { status: string; timestamp: number }>>(new Map());

  const isWithinTimeframe = (createdAtStr: string | undefined, timeframe: TimeFilterConfig | string) => {
    return isWithinCustomTimeframe(createdAtStr, timeframe);
  };

  const isReportItem = (r: MapsReview) => {
    return r.order_kind === 'REPORT' || (r.id && String(r.id).startsWith('rep-'));
  };

  // Loading states
  const [shopeeOrders, setShopeeOrders] = useState<ShopeeOrder[]>([]);
  const [mapsReviews, setMapsReviews] = useState<MapsReview[]>([]);
  const [reportMaps, setReportMaps] = useState<ReportMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'shopee_order' | 'maps_review' | 'report_map' } | null>(null);
  const [screenshotModalItem, setScreenshotModalItem] = useState<MapsReview | null>(null);

  // Form Collapse States
  const [activeForm, setActiveForm] = useState<'REPORT' | 'SPAM' | null>(null);
  const [isReviewMapsFormExpanded, setIsReviewMapsFormExpanded] = useState<boolean>(false);
  const [isReportMapsFormExpanded, setIsReportMapsFormExpanded] = useState<boolean>(false);

  // DOM Refs for auto-scroll
  const reportFormRef = useRef<HTMLDivElement>(null);
  const spamFormRef = useRef<HTMLDivElement>(null);
  const reviewMapsFormRef = useRef<HTMLDivElement>(null);
  const reportMapsFormRef = useRef<HTMLDivElement>(null);
  const shopeeQueueRef = useRef<HTMLDivElement>(null);
  const reviewMapsQueueRef = useRef<HTMLDivElement>(null);
  const reportMapsQueueRef = useRef<HTMLDivElement>(null);

  // Form State: Input 1 (REPORT ALL SOSMED)
  const [formSosmed, setFormSosmed] = useState({
    storeName: '',
    buyerName: '',
    serviceType: 'report tiktok',
    quantity: 1,
    targetLink: '',
    notes: ''
  });

  // Form State: Input 2 (SPAM WA)
  const [formSpam, setFormSpam] = useState({
    storeName: '',
    buyerName: '',
    serviceType: 'chat',
    quantity: 1,
    targetLink: '', // Target Phone Number
    notes: '' // Format Chat
  });

  // Form State: REVIEW MAPS
  const [formReviewMaps, setFormReviewMaps] = useState({
    storeName: '',
    clientName: '',
    reviewType: 'G_MAPS' as 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS',
    targetCount: 5,
    mapsLink: '',
    notes: ''
  });

  // Form State: REPORT MAPS
  const [formReportMaps, setFormReportMaps] = useState({
    storeName: '',
    clientName: '',
    reviewType: 'G_MAPS' as 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS',
    targetCount: 1,
    mapsLink: '',
    notes: ''
  });

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

  // Report map edit state
  const [editingReportMap, setEditingReportMap] = useState<ReportMap | null>(null);
  const [isReportMapModalOpen, setIsReportMapModalOpen] = useState(false);
  const [editRepClientName, setEditRepClientName] = useState('');
  const [editRepStoreName, setEditRepStoreName] = useState('');
  const [editRepMapsLink, setEditRepMapsLink] = useState('');
  const [editRepSlot, setEditRepSlot] = useState(1);
  const [editRepReason, setEditRepReason] = useState('');
  const [editRepServiceType, setEditRepServiceType] = useState<'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS'>('G_MAPS');

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
    setEditMapsReviewType(review.review_type || 'G_MAPS');
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
      // Reload lists without forceRefresh (cache-aware)
      const data = await dbGetMapsReviews();
      setMapsReviews(data);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui review Maps');
    }
  };

  const handleOpenEditReportMap = (item: ReportMap) => {
    setEditingReportMap(item);
    setEditRepClientName(item.client_name || '');
    setEditRepStoreName(item.store_name || '');
    setEditRepMapsLink(item.maps_link || '');
    setEditRepSlot(item.slot || 1);
    setEditRepReason(item.reason || item.notes || '');
    setEditRepServiceType((item.service_type as any) || 'G_MAPS');
    setIsReportMapModalOpen(true);
  };

  const handleSaveReportMapEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReportMap) return;
    try {
      const updated: Partial<ReportMap> = {
        client_name: editRepClientName,
        store_name: editRepStoreName,
        maps_link: editRepMapsLink,
        slot: editRepSlot,
        reason: editRepReason,
        notes: editRepReason,
        service_type: editRepServiceType,
        status: editingReportMap.status
      };
      await dbUpdateReportMap(editingReportMap.id, updated);
      toast.success(currentLang === 'id' ? 'Report Maps berhasil diperbarui' : 'Report Maps updated successfully');
      setIsReportMapModalOpen(false);
      setEditingReportMap(null);
      const data = await dbGetReportMaps();
      setReportMaps(data);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui Report Maps');
    }
  };

  // Listen to auth changes
  useEffect(() => {
    const handleRouteSync = () => {
      try {
        const viewAs = sessionStorage.getItem('gm_view_as_shp');
        if (viewAs) {
          setIsAuthenticated(true);
          setCurrentAdminUser(viewAs);
          return;
        }
        const isAuth = sessionStorage.getItem('gm_adminshp_auth') === 'true' || localStorage.getItem('gm_adminshp_auth') === 'true';
        const user = getAuthUser();
        if (isAuth || user?.role === 'adminshp' || user?.role === 'admin') {
          setIsAuthenticated(true);
          const slot = user?.slot || sessionStorage.getItem('gm_adminshp_user') || localStorage.getItem('gm_adminshp_user') || 'adminshp1';
          setCurrentAdminUser(slot);
        }
      } catch (e) {
        console.warn(e);
      }
    };

    window.addEventListener('admin-auth-change', handleRouteSync);
    window.addEventListener('adminshp-auth-change', handleRouteSync);
    window.addEventListener('gm_auth_changed', handleRouteSync);

    return () => {
      window.removeEventListener('admin-auth-change', handleRouteSync);
      window.removeEventListener('adminshp-auth-change', handleRouteSync);
      window.removeEventListener('gm_auth_changed', handleRouteSync);
    };
  }, []);

  // Fetch all initial data if authenticated
  const loadData = async (silent: boolean = false, forceRefresh: boolean = false) => {
    if (!isAuthenticated || !currentAdminUser) return;
    if (!silent && shopeeOrders.length === 0 && mapsReviews.length === 0 && reportMaps.length === 0) {
      setIsLoading(true);
    }
    try {
      const [orders, reviews, reports] = await Promise.all([
        dbGetShopeeOrders(50000, forceRefresh),
        dbGetMapsReviews(50000, forceRefresh),
        dbGetReportMaps(50000, forceRefresh)
      ]);
      
      setShopeeOrders(orders);
      setMapsReviews(reviews);
      setReportMaps(reports);
    } catch (error) {
      console.error('Error loading Shopee, Maps, and Report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData(false, false);
    }
  }, [isAuthenticated, currentAdminUser]);

  useEffect(() => {
    const handleLogoutEvent = () => {
      handleLogout();
    };
    const handleManualRefreshEvent = () => {
      if (isAuthenticated) {
        loadData(false, true);
      }
    };
    const handleSyncedEvent = (e: any) => {
      if (!isAuthenticated) return;
      const detail = e?.detail;
      if (detail && Array.isArray(detail.shopeeData) && Array.isArray(detail.mapsData)) {
        setShopeeOrders(detail.shopeeData);
        setMapsReviews(detail.mapsData);
        if (Array.isArray(detail.reportMapsData)) {
          setReportMaps(detail.reportMapsData);
        }
        return;
      }
      loadData(true, false);
    };

    window.addEventListener('adminshp-logout', handleLogoutEvent);
    window.addEventListener('adminshp-refresh', handleManualRefreshEvent);
    window.addEventListener('gm_spreadsheet_data_synced', handleSyncedEvent);
    window.addEventListener('gm_supabase_data_synced', handleSyncedEvent);

    // Background polling interval every 15s for genuine real-time parity with AdminPanel
    const autoRefreshInterval = setInterval(() => {
      if (!isAuthenticated) return;
      const now = Date.now();
      dbGetMapsReviews(50000, false).then(mapsData => {
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
      }).catch(console.error);

      dbGetShopeeOrders(50000, false).then(shopeeData => {
        setShopeeOrders(shopeeData);
      }).catch(console.error);

      dbGetReportMaps(50000, false).then(reportsData => {
        setReportMaps(reportsData);
      }).catch(console.error);
    }, 15000);

    return () => {
      clearInterval(autoRefreshInterval);
      window.removeEventListener('adminshp-logout', handleLogoutEvent);
      window.removeEventListener('adminshp-refresh', handleManualRefreshEvent);
      window.removeEventListener('gm_spreadsheet_data_synced', handleSyncedEvent);
      window.removeEventListener('gm_supabase_data_synced', handleSyncedEvent);
    };
  }, [isAuthenticated, currentAdminUser]);

  // Reset pagination when search / filter changes
  useEffect(() => {
    setPageShopee(1);
  }, [searchShopee, sortShopee, shopeeTypeFilter, timeFilterShopee]);

  useEffect(() => {
    setPageMaps(1);
  }, [searchMaps, sortMaps, reviewTypeFilter, timeFilterMaps]);

  useEffect(() => {
    setPageReportMaps(1);
  }, [searchReportMaps, sortReportMaps, reportTypeFilter, timeFilterReportMaps]);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = adminUsername.trim().toLowerCase();
    const p = adminPassword;
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const res = await loginWithBackend(u, p, rememberMe);
      if (res.success && res.user && (res.user.role === 'adminshp' || res.user.role === 'admin')) {
        const matchedSlot = res.user.slot || res.user.username;
        setIsAuthenticated(true);
        setCurrentAdminUser(matchedSlot);
        const routeName = getSlotRouteName(matchedSlot);
        window.history.pushState(null, '', `/${routeName}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
        try {
          sessionStorage.setItem('gm_adminshp_auth', 'true');
          sessionStorage.setItem('gm_adminshp_user', matchedSlot);
          if (rememberMe) {
            localStorage.setItem(`gm_adminshp_auth_${matchedSlot}`, 'true');
            localStorage.setItem('gm_adminshp_user', matchedSlot);
            localStorage.setItem('gm_adminshp_auth', 'true');
          } else {
            localStorage.removeItem(`gm_adminshp_auth_${matchedSlot}`);
            localStorage.removeItem('gm_adminshp_user');
            localStorage.removeItem('gm_adminshp_auth');
          }
        } catch (err) {
          console.warn('Storage restricted', err);
        }
        setAuthError('');
        logAdminShpAction(matchedSlot, 'Login', `Berhasil login ke sistem portal adminshp`);
        toast.success(currentLang === 'id' ? 'Autentikasi berhasil! Mengalihkan ke panel...' : 'Authentication successful! Redirecting...');
      } else {
        setAuthError(res.error || (currentLang === 'id' ? 'Email/username atau kata sandi tidak sesuai!' : 'Invalid email/username or password!'));
      }
    } catch (err: any) {
      setAuthError(err.message || 'Gagal terhubung ke server autentikasi');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clientLogout();
    if (currentAdminUser) {
      logAdminShpAction(currentAdminUser, 'Logout', `Berhasil logout dari sistem portal adminshp`);
    }
    setIsAuthenticated(false);
    setCurrentAdminUser('');
    try {
      sessionStorage.removeItem('gm_adminshp_auth');
      sessionStorage.removeItem('gm_adminshp_user');
      localStorage.removeItem('gm_adminshp_auth');
      localStorage.removeItem('gm_adminshp_user');
      for (const slot of ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4']) {
        localStorage.removeItem(`gm_adminshp_auth_${slot}`);
      }
    } catch (err) {
      console.warn('Storage restricted', err);
    }
    setAdminUsername('');
    setAdminPassword('');
    window.dispatchEvent(new CustomEvent('admin-auth-change'));
    window.dispatchEvent(new CustomEvent('adminshp-auth-change'));
    window.dispatchEvent(new Event('gm_auth_changed'));
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to generate a highly polished single-page PDF of Google Maps Reviewers list
  const handleExportPDF = async (item: MapsReview) => {
    try {
      await generateMapsReportPDF(item, currentAdminUser || item.created_by);
      toast.success("PDF Laporan berhasil diunduh!");
    } catch (err) {
      console.error("Gagal mengekspor PDF:", err);
      toast.error("Terjadi kesalahan saat memproses PDF.");
    }
  };

  // Helper to generate Format for Report All Sosmed
  const generateSosmedFormat = (data: typeof formSosmed) => {
    return `Nama St : ${data.storeName}
Nama Cust : ${data.buyerName}
Jenis Jasa : ${data.serviceType}
Slot : ${data.quantity}
Link Target : 
${data.targetLink}

Alasan : ${data.notes || '-'}`;
  };

  // Helper to generate Format for Spam WA
  const generateSpamFormat = (data: typeof formSpam) => {
    return `Nama St : ${data.storeName}
Nama Cust : ${data.buyerName}
Nomer Target :${data.targetLink}
Slot : ${data.quantity}
Order : ${data.serviceType}
Format Chat : ${data.notes || '-'}`;
  };

  // Handle Card Expand & Collapse transitions
  const handleToggleForm = (type: 'REPORT' | 'SPAM') => {
    if (activeForm === type) {
      setActiveForm(null);
    } else {
      setActiveForm(type);
      setTimeout(() => {
        const ref = type === 'REPORT' ? reportFormRef : spamFormRef;
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  };

  // Submit Input 1 (REPORT ALL SOSMED)
  const handleSubmitSosmed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSosmed.storeName || !formSosmed.buyerName || !formSosmed.targetLink) {
      toast.error(currentLang === 'id' ? 'Mohon lengkapi semua data wajib!' : 'Please fill all required fields!');
      return;
    }

    try {
      const formattedText = generateSosmedFormat(formSosmed);
      const newOrder = await dbCreateShopeeOrder({
        order_type: 'REPORT_ALL_SOSMED',
        store_name: formSosmed.storeName,
        buyer_name: formSosmed.buyerName,
        service_type: formSosmed.serviceType,
        quantity: formSosmed.quantity,
        target_link: formSosmed.targetLink,
        notes: formSosmed.notes,
        formatted_text: formattedText,
        created_by: getSlotIndicatorName(currentAdminUser),
        status: 'READY'
      });

      setShopeeOrders(prev => [newOrder, ...prev]);
      
      // Log action
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Buat Pesanan Sosmed', `Membuat pesanan Report Sosmed (${formSosmed.serviceType}) untuk target ${formSosmed.targetLink}`);
      }
      
      // Reset form
      setFormSosmed({
        storeName: '',
        buyerName: '',
        serviceType: 'report tiktok',
        quantity: 1,
        targetLink: '',
        notes: ''
      });

      // Collapse form & scroll to queue
      setActiveForm(null);
      setTimeout(() => {
        shopeeQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);

      toast.success(currentLang === 'id' ? 'Pesanan Report Sosmed berhasil ditambahkan!' : 'Sosmed Report order created successfully!');
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? `Gagal menambah order: ${err instanceof Error ? err.message : String(err)}` : `Failed to create order: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Submit Input 2 (SPAM WA)
  const handleSubmitSpam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSpam.storeName || !formSpam.buyerName || !formSpam.targetLink) {
      toast.error(currentLang === 'id' ? 'Mohon lengkapi semua data wajib!' : 'Please fill all required fields!');
      return;
    }

    try {
      const formattedText = generateSpamFormat(formSpam);
      const newOrder = await dbCreateShopeeOrder({
        order_type: 'SPAM_WA',
        store_name: formSpam.storeName,
        buyer_name: formSpam.buyerName,
        service_type: formSpam.serviceType,
        quantity: formSpam.quantity,
        target_link: formSpam.targetLink,
        notes: formSpam.notes,
        formatted_text: formattedText,
        created_by: getSlotIndicatorName(currentAdminUser),
        status: 'READY'
      });

      setShopeeOrders(prev => [newOrder, ...prev]);

      // Log action
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Buat Pesanan Spam', `Membuat pesanan Spam WA (${formSpam.serviceType}) untuk target ${formSpam.targetLink}`);
      }

      // Reset form
      setFormSpam({
        storeName: '',
        buyerName: '',
        serviceType: 'chat',
        quantity: 1,
        targetLink: '',
        notes: ''
      });

      // Collapse form & scroll to queue
      setActiveForm(null);
      setTimeout(() => {
        shopeeQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);

      toast.success(currentLang === 'id' ? 'Pesanan Spam WA berhasil ditambahkan!' : 'Spam WA order created successfully!');
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? `Gagal menambah order: ${err instanceof Error ? err.message : String(err)}` : `Failed to create order: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Assign/update worker on created Shopee Order
  const handleAssignWorker = async (id: string, workerId: string) => {
    try {
      const updated = await dbUpdateShopeeOrder(id, { worker_id: workerId || undefined });
      setShopeeOrders(prev => prev.map(o => o.id === id ? updated : o));
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Assign Worker', `Menugaskan worker "${workerId || 'None'}" untuk order ID: ${id}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui worker.');
    }
  };

  // Update work order on created Shopee Order
  const handleUpdateWorkOrder = async (id: string, workOrder: string) => {
    try {
      const updated = await dbUpdateShopeeOrder(id, { work_order: workOrder });
      setShopeeOrders(prev => prev.map(o => o.id === id ? updated : o));
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Update Work Order', `Memperbarui isi catatan/instruksi pengerjaan untuk order ID: ${id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Shopee Order
  const handleDeleteShopeeOrder = (id: string) => {
    setDeleteConfirm({ id, type: 'shopee_order' });
  };

  const executeDeleteShopeeOrder = async (id: string) => {
    try {
      await dbDeleteShopeeOrder(id);
      setShopeeOrders(prev => prev.filter(o => o.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? `Gagal menghapus order: ${err instanceof Error ? err.message : String(err)}` : `Failed to delete order: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Submit Input (REVIEW MAPS)
  const handleSubmitReviewMaps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReviewMaps.storeName || !formReviewMaps.clientName || !formReviewMaps.mapsLink) {
      toast.error(currentLang === 'id' ? 'Mohon lengkapi Nama Store, Client Name, dan Link Target!' : 'Please fill all required fields!');
      return;
    }

    try {
      const newReview = await dbCreateMapsReview({
        id: 'map-' + Date.now().toString().slice(-6),
        order_kind: 'REVIEW',
        store_name: formReviewMaps.storeName,
        client_name: formReviewMaps.clientName,
        review_type: formReviewMaps.reviewType,
        target_count: formReviewMaps.targetCount || 5,
        maps_link: formReviewMaps.mapsLink,
        notes: formReviewMaps.notes,
        reviewer_accounts: [],
        proof_link: '',
        status: 'READY',
        payment_status: '',
        created_by: getSlotIndicatorName(currentAdminUser)
      });

      setMapsReviews(prev => [newReview, ...prev]);

      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Buat Target Review Maps', `Mendaftarkan target review baru untuk store "${formReviewMaps.storeName}" (${formReviewMaps.reviewType})`);
      }

      const copypasta = `Link: ${formReviewMaps.mapsLink}\nNama cust: ${formReviewMaps.clientName}\nNama st: ${formReviewMaps.storeName || '-'}\nclue: ${formReviewMaps.notes || '-'}`;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(copypasta);
          toast.success(currentLang === 'id' ? 'Target Review berhasil dibuat & format tersalin!' : 'Review Target created and format copied!');
        } else {
          toast.success(currentLang === 'id' ? 'Target Review berhasil dibuat!' : 'Review Target created successfully!');
        }
      } catch {
        toast.success(currentLang === 'id' ? 'Target Review berhasil dibuat!' : 'Review Target created successfully!');
      }

      setFormReviewMaps({
        storeName: '',
        clientName: '',
        reviewType: 'G_MAPS',
        targetCount: 5,
        mapsLink: '',
        notes: ''
      });

      setIsReviewMapsFormExpanded(false);
      setTimeout(() => {
        reviewMapsQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? `Gagal menambah data: ${err instanceof Error ? err.message : String(err)}` : `Failed to create data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Submit Input (REPORT MAPS)
  const handleSubmitReportMaps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReportMaps.storeName || !formReportMaps.clientName || !formReportMaps.mapsLink || !formReportMaps.notes) {
      toast.error(currentLang === 'id' ? 'Mohon lengkapi semua data wajib (Nama Store, Client Name, Target Link, dan Alasan)!' : 'Please fill all required fields!');
      return;
    }

    try {
      const newReport = await dbCreateReportMap({
        id: 'rep-' + Date.now().toString().slice(-6),
        maps_link: formReportMaps.mapsLink,
        client_name: formReportMaps.clientName,
        store_name: formReportMaps.storeName,
        service_type: formReportMaps.reviewType,
        slot: formReportMaps.targetCount || 1,
        reason: formReportMaps.notes,
        notes: formReportMaps.notes,
        proof_link: '',
        status: 'READY',
        payment_status: 'UNPAID',
        created_by: getSlotIndicatorName(currentAdminUser)
      });

      setReportMaps(prev => [newReport, ...prev]);

      // Log action
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Buat Report Maps', `Mendaftarkan target report maps baru untuk store "${formReportMaps.storeName}" (${formReportMaps.reviewType})`);
      }

      // Format text auto copy (sesuai format GM: Link, Nama cust, Nama st, dst)
      const formatText = `Link: ${formReportMaps.mapsLink}\nNama cust: ${formReportMaps.clientName}\nNama st: ${formReportMaps.storeName || '-'}\nJenis Jasa: ${formReportMaps.reviewType === 'TRIPAD' ? 'TRIPAD' : formReportMaps.reviewType === 'REVIEW_APPS' ? 'APPS' : 'G MAPS'}\nSlot: ${formReportMaps.targetCount || 1}\nAlasan: ${formReportMaps.notes}`;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(formatText);
          toast.success(currentLang === 'id' ? 'Report Maps berhasil dibuat & format tersalin!' : 'Report Maps created and format copied!');
        } else {
          toast.success(currentLang === 'id' ? 'Report Maps berhasil dibuat!' : 'Report Maps created successfully!');
        }
      } catch {
        toast.success(currentLang === 'id' ? 'Report Maps berhasil dibuat!' : 'Report Maps created successfully!');
      }

      // Reset form
      setFormReportMaps({
        storeName: '',
        clientName: '',
        reviewType: 'G_MAPS',
        targetCount: 1,
        mapsLink: '',
        notes: ''
      });

      // Collapse form & scroll to report maps queue
      setIsReportMapsFormExpanded(false);
      setTimeout(() => {
        reportMapsQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? `Gagal menambah data: ${err instanceof Error ? err.message : String(err)}` : `Failed to create data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Update Report Maps Payment Status
  const handleUpdateReportPaymentStatus = async (id: string, payment_status: 'PAID' | 'UNPAID') => {
    setReportMaps(prev => prev.map(r => r.id === id ? { ...r, payment_status } : r));
    try {
      await dbUpdateReportMap(id, { payment_status });
      if (currentAdminUser) {
        const target = reportMaps.find(r => r.id === id);
        logAdminShpAction(currentAdminUser, 'Update Status Pembayaran Report', `Mengubah status bayar "${target?.store_name || id}" menjadi ${payment_status}`);
      }
      toast.success(payment_status === 'PAID' ? 'Status: PAID' : 'Status: UNPAID');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status pembayaran');
    }
  };

  // Update Report Maps Proof Link
  const handleUpdateReportProofLink = async (id: string, value: string) => {
    const target = reportMaps.find(r => r.id === id);
    try {
      await dbUpdateReportMap(id, { proof_link: value });
      setReportMaps(prev => prev.map(r => r.id === id ? { ...r, proof_link: value } : r));
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Update Bukti Link Report', `Memperbarui bukti link untuk report store "${target?.store_name || 'unknown'}"`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Report Maps Reason/Notes
  const handleUpdateReportReason = async (id: string, value: string) => {
    try {
      await dbUpdateReportMap(id, { reason: value, notes: value });
      setReportMaps(prev => prev.map(r => r.id === id ? { ...r, reason: value, notes: value } : r));
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Report Map Item
  const handleDeleteReportMap = (id: string) => {
    setDeleteConfirm({ id, type: 'report_map' });
  };

  const executeDeleteReportMap = async (id: string) => {
    try {
      await dbDeleteReportMap(id);
      setReportMaps(prev => prev.filter(r => r.id !== id));
      setDeleteConfirm(null);
      toast.success('Data Report Maps berhasil dihapus.');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus data.');
    }
  };

  // Update Payment Status (PAID / UNPAID)
  const handleUpdatePaymentStatus = async (id: string, payment_status: 'PAID' | 'UNPAID') => {
    setMapsReviews(prev => prev.map(r => r.id === id ? { ...r, payment_status } : r));
    try {
      await dbUpdateMapsReview(id, { payment_status });
      if (currentAdminUser) {
        const target = mapsReviews.find(r => r.id === id);
        logAdminShpAction(currentAdminUser, 'Update Status Pembayaran', `Mengubah status bayar "${target?.store_name || id}" menjadi ${payment_status}`);
      }
      toast.success(payment_status === 'PAID' ? 'Status: PAID' : 'Status: UNPAID');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status pembayaran');
    }
  };


  // Update Bukti Link
  const handleUpdateProofLink = async (reviewId: string, value: string) => {
    const targetReview = mapsReviews.find(r => r.id === reviewId);
    try {
      await dbUpdateMapsReview(reviewId, {
        proof_link: value
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, proof_link: value } : r));
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Update Bukti Link', `Memperbarui bukti link untuk review store "${targetReview?.store_name || 'unknown'}"`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Notes/Clue on the fly
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

  // Update Store Name on the fly
  const handleUpdateStoreName = async (reviewId: string, value: string) => {
    try {
      await dbUpdateMapsReview(reviewId, {
        store_name: value
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, store_name: value } : r));
    } catch (err) {
      console.error(err);
    }
  };

  // Update Status Review on the fly with optimistic UI and lock
  const handleUpdateMapsStatus = async (id: string, status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE') => {
    pauseAutoSyncFor(30000);
    recentLocalStatusUpdates.current.set(id, { status, timestamp: Date.now() });
    setMapsReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));

    try {
      const updated = await dbUpdateMapsReview(id, { status });
      if (updated) {
        setMapsReviews(prev => prev.map(r => r.id === id ? { ...r, ...updated, status: updated.status || status } : r));
      }
      if (currentAdminUser) {
        const target = mapsReviews.find(r => r.id === id);
        logAdminShpAction(currentAdminUser, 'Update Status Review', `Mengubah status review store "${target?.store_name || id}" menjadi ${status}`);
      }
      toast.success(currentLang === 'id' ? `Status Review diubah ke ${status}` : `Review status updated to ${status}`);
      window.dispatchEvent(new CustomEvent('gm_supabase_data_synced', { detail: { timestamp: Date.now() } }));
    } catch (err) {
      console.error(err);
      recentLocalStatusUpdates.current.delete(id);
      toast.error('Gagal memperbarui status Review');
    }
  };

  // Delete Maps Review Item
  const handleDeleteMapsReview = (id: string) => {
    setDeleteConfirm({ id, type: 'maps_review' });
  };

  const executeDeleteMapsReview = async (id: string) => {
    try {
      await dbDeleteMapsReview(id);
      setMapsReviews(prev => prev.filter(r => r.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus data.');
    }
  };

  // Render Login Portal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-[82vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50/70" id="adminshp-login-portal">
        <motion.div 
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/50 space-y-6"
        >
          {/* Header section inspired by Image 2 (Light, custom wording) */}
          <div className="flex items-start gap-3.5 border-b border-slate-100 pb-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 shadow-xs">
              <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight font-sans">
                {currentLang === 'id' ? 'Portal Admin SHP' : 'Admin SHP Portal'}
              </h2>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {authError && (
              <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200/80 p-3.5 text-xs font-bold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{authError}</span>
              </div>
            )}

            {/* Email / Username input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider font-sans">
                {currentLang === 'id' ? 'Email / Username Admin' : 'Admin Email / Username'}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Email atau username"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white pl-10 pr-4 py-3 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all font-sans shadow-xs"
                />
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider font-sans">
                {currentLang === 'id' ? 'Kata Sandi' : 'Password'}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white pl-10 pr-10 py-3 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all font-sans shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Checklist Ingat Saya di Perangkat Ini */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2.5 text-xs text-slate-600 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>{currentLang === 'id' ? 'Ingat saya di perangkat ini' : 'Remember me on this device'}</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:shadow-lg transition-all cursor-pointer font-sans flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>{currentLang === 'id' ? 'Memverifikasi Autentikasi...' : 'Verifying Authentication...'}</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-slate-300" />
                  <span>{currentLang === 'id' ? 'Masuk ke Dashboard' : 'Enter Dashboard'}</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Filtered and sorted Shopee Orders
  const filteredShopeeOrders = shopeeOrders
    .filter(order => isWithinTimeframe(order.created_at, timeFilterShopee))
    .filter(order => {
      const stat = order.status || 'PENDING';
      if (sortShopee === 'pending') return stat === 'PENDING';
      if (sortShopee === 'progress') return stat === 'PROGRESS';
      if (sortShopee === 'ready') return stat === 'READY';
      if (sortShopee === 'sudah_direkap') return stat === 'SUDAH DIREKAP';
      if (sortShopee === 'done') return stat === 'DONE';
      return true; // if 'all'
    })
    .filter(order => {
      if (shopeeTypeFilter === 'report') return order.order_type === 'REPORT_ALL_SOSMED';
      if (shopeeTypeFilter === 'spam_wa') return order.order_type === 'SPAM_WA';
      return true; // if 'all'
    })
    .filter(order => {
      if (!searchShopee) return true;
      const q = searchShopee.toLowerCase();
      return (
        (order.id || '').toLowerCase().includes(q) ||
        (order.store_name || '').toLowerCase().includes(q) ||
        (order.buyer_name || '').toLowerCase().includes(q) ||
        (order.service_type || '').toLowerCase().includes(q) ||
        (order.target_link || '').toLowerCase().includes(q) ||
        (order.notes || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filtered and sorted Review Maps (for Tab 'maps')
  const filteredReviewMaps = mapsReviews
    .filter(review => !isReportItem(review))
    .filter(review => isWithinTimeframe(review.created_at, timeFilterMaps))
    .filter(review => {
      const stat = review.status || 'PENDING';
      if (sortMaps === 'pending') return stat === 'PENDING';
      if (sortMaps === 'progress') return stat === 'PROGRESS';
      if (sortMaps === 'ready') return stat === 'READY';
      if (sortMaps === 'sudah_direkap') return stat === 'SUDAH DIREKAP';
      if (sortMaps === 'done') return stat === 'DONE';
      return true; // if 'all'
    })
    .filter(review => {
      if (reviewTypeFilter === 'TRIPAD') {
        return review.review_type === 'TRIPAD' || (review.review_type as string) === 'TRIPADVISOR' || (review.review_type as string) === 'REVIEW_TRIPAD';
      }
      if (reviewTypeFilter === 'GMAPS') {
        return review.review_type === 'G_MAPS' || !review.review_type;
      }
      if (reviewTypeFilter === 'REVIEW APPS') {
        return review.review_type === 'REVIEW_APPS';
      }
      return true; // if 'all'
    })
    .filter(review => {
      if (!searchMaps) return true;
      const q = searchMaps.toLowerCase();
      return (
        (review.id || '').toLowerCase().includes(q) ||
        (review.store_name || '').toLowerCase().includes(q) ||
        (review.client_name || '').toLowerCase().includes(q) ||
        (review.notes || '').toLowerCase().includes(q) ||
        (review.review_type || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
    });

  const paginatedShopeeOrders = filteredShopeeOrders.slice((pageShopee - 1) * ITEMS_PER_PAGE, pageShopee * ITEMS_PER_PAGE);
  const paginatedReviewMaps = filteredReviewMaps.slice((pageMaps - 1) * ITEMS_PER_PAGE, pageMaps * ITEMS_PER_PAGE);
  const paginatedMapsReviews = paginatedReviewMaps; // Alias for safety
  const mapsReviewsOnly = mapsReviews.filter(review => !isReportItem(review));
  
  // Combine dedicated reportMaps with any legacy items from mapsReviews
  const legacyReportMaps: ReportMap[] = mapsReviews
    .filter(review => isReportItem(review))
    .map(r => ({
      id: r.id,
      maps_link: r.maps_link || '',
      client_name: r.client_name || '',
      store_name: r.store_name || '',
      service_type: (r.review_type as any) || 'G_MAPS',
      slot: r.target_count || 1,
      reason: r.notes || '',
      notes: r.notes || '',
      proof_link: r.proof_link || '',
      status: (r.status as any) || 'READY',
      payment_status: r.payment_status || 'UNPAID',
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

  const allReportMaps: ReportMap[] = [
    ...reportMaps,
    ...legacyReportMaps.filter(leg => !reportMaps.some(rm => rm.id === leg.id))
  ];

  // Filtered and sorted Report Maps (for Tab 'report_maps')
  const filteredReportMaps = allReportMaps
    .filter(item => isWithinTimeframe(item.created_at, timeFilterReportMaps))
    .filter(item => {
      const stat = item.status || 'READY';
      if (sortReportMaps === 'pending') return stat === 'PENDING';
      if (sortReportMaps === 'progress') return stat === 'PROGRESS';
      if (sortReportMaps === 'ready') return stat === 'READY';
      if (sortReportMaps === 'sudah_direkap') return stat === 'SUDAH DIREKAP';
      if (sortReportMaps === 'done') return stat === 'DONE';
      return true; // if 'all'
    })
    .filter(item => {
      const st = item.service_type || 'G_MAPS';
      if (reportTypeFilter === 'TRIPAD') {
        return st === 'TRIPAD';
      }
      if (reportTypeFilter === 'GMAPS') {
        return st === 'G_MAPS';
      }
      if (reportTypeFilter === 'REVIEW APPS') {
        return st === 'REVIEW_APPS';
      }
      return true; // if 'all'
    })
    .filter(item => {
      if (!searchReportMaps) return true;
      const q = searchReportMaps.toLowerCase();
      return (
        (item.id || '').toLowerCase().includes(q) ||
        (item.store_name || '').toLowerCase().includes(q) ||
        (item.client_name || '').toLowerCase().includes(q) ||
        (item.reason || item.notes || '').toLowerCase().includes(q) ||
        (item.service_type || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
    });

  const paginatedReportMaps = filteredReportMaps.slice((pageReportMaps - 1) * ITEMS_PER_PAGE, pageReportMaps * ITEMS_PER_PAGE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans" id="shopee-portal-container">
      {/* Header Portal */}
      <div className="mb-6 border-b border-slate-100 pb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-850 tracking-tight font-sans uppercase">
            WORKING SPACE - SHOPEE INPUT
          </h1>
        </div>
      </div>

      {/* Tab Switches */}
      <div className="w-full overflow-x-auto no-scrollbar scrollbar-none border-b border-slate-100 mb-8 pb-0.5">
        <div className="flex items-center gap-2 sm:gap-3 min-w-max">
          <button
            onClick={() => setActiveTab('shopee')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === 'shopee'
                ? 'border-orange-500 text-orange-600 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-750'
            }`}
          >
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <span>Report Sosmed & Spam WA</span>
          </button>

          <button
            onClick={() => setActiveTab('maps')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === 'maps'
                ? 'border-purple-600 text-purple-600 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-750'
            }`}
          >
            <Star className="h-4 w-4 shrink-0" />
            <span>Review Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('report_maps')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === 'report_maps'
                ? 'border-blue-600 text-blue-600 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-750'
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span>Report Orders</span>
          </button>
        </div>
      </div>

      {/* Tab contents */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Memuat basis data shopee...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: SHOPEE & SPAM WA INPUTS */}
          {activeTab === 'shopee' && (
            <div className="space-y-8 fade-in">
              {/* FORMS COLLAPSIBLE GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* CARD 1: REPORT ALL SOSMED */}
                <div 
                  className={`bg-white rounded-3xl border transition-all duration-400 ${
                    activeForm === 'REPORT' 
                      ? 'border-orange-500 ring-4 ring-orange-500/10 shadow-lg' 
                      : activeForm === 'SPAM'
                      ? 'border-slate-200 opacity-75 blur-[0.2px]'
                      : 'border-slate-200 shadow-sm'
                  }`}
                  id="card-report-sosmed"
                >
                  {/* Card Header Section always visible */}
                  <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                    <div className="flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black shrink-0">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-900 leading-snug">
                          REPORT ALL SOSMED
                        </h2>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleToggleForm('REPORT')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        activeForm === 'REPORT'
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20'
                      }`}
                    >
                      {activeForm === 'REPORT' ? 'Hide Form' : 'Input Pesanan Report'}
                    </button>
                  </div>

                  {/* Collapsible Form Panel using Framer Motion */}
                  <AnimatePresence initial={false}>
                    {activeForm === 'REPORT' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.25, 0.8, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div ref={reportFormRef} className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                          <form onSubmit={handleSubmitSosmed} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Nama Store <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Contoh: GM Store"
                                  value={formSosmed.storeName}
                                  onChange={e => setFormSosmed(prev => ({ ...prev, storeName: e.target.value }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 font-sans"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Nama Customer <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Nama pembeli"
                                  value={formSosmed.buyerName}
                                  onChange={e => setFormSosmed(prev => ({ ...prev, buyerName: e.target.value }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 font-sans"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Jenis Jasa <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={formSosmed.serviceType}
                                  onChange={e => setFormSosmed(prev => ({ ...prev, serviceType: e.target.value }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 font-sans cursor-pointer font-semibold text-slate-700"
                                >
                                  <option value="report tiktok">Report TikTok</option>
                                  <option value="report instagram">Report Instagram</option>
                                  <option value="report threads">Report Threads</option>
                                  <option value="report x">Report X</option>
                                  <option value="report facebook">Report Facebook</option>
                                  <option value="report whatsapp">Report WhatsApp</option>
                                  <option value="report youtube">Report YouTube</option>
                                  <option value="report telegram">Report Telegram</option>
                                  <option value="report shopee">Report Shopee</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Jumlah Slot / Pcs <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  required
                                  min={1}
                                  value={formSosmed.quantity}
                                  onChange={e => setFormSosmed(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 font-mono"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Link Target <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Contoh: wa.me/+628211116955 atau +628211116955"
                                value={formSosmed.targetLink}
                                onChange={e => setFormSosmed(prev => ({ ...prev, targetLink: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 font-mono"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Alasan / Notes <span className="text-slate-400">(Opsional)</span>
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Contoh: Akun melakukan penipuan kuis, mohon segera ditakedown"
                                value={formSosmed.notes}
                                onChange={e => setFormSosmed(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 font-sans"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-3 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] transition-all text-white rounded-xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/10"
                            >
                              <Send className="h-4 w-4" />
                              <span>Submit & Generate Format</span>
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* CARD 2: SPAM WA (WHATSAPP) */}
                <div 
                  className={`bg-white rounded-3xl border transition-all duration-400 ${
                    activeForm === 'SPAM' 
                      ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg' 
                      : activeForm === 'REPORT'
                      ? 'border-slate-200 opacity-75 blur-[0.2px]'
                      : 'border-slate-200 shadow-sm'
                  }`}
                  id="card-spam-wa"
                >
                  {/* Card Header Section always visible */}
                  <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                    <div className="flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black shrink-0">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-900 leading-snug">
                          SPAM WA (WHATSAPP)
                        </h2>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleToggleForm('SPAM')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        activeForm === 'SPAM'
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20'
                      }`}
                    >
                      {activeForm === 'SPAM' ? 'Hide Form' : 'Input Pesanan Spam WA'}
                    </button>
                  </div>

                  {/* Collapsible Form Panel using Framer Motion */}
                  <AnimatePresence initial={false}>
                    {activeForm === 'SPAM' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.25, 0.8, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div ref={spamFormRef} className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                          <form onSubmit={handleSubmitSpam} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Nama Store <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Contoh: GM Store"
                                  value={formSpam.storeName}
                                  onChange={e => setFormSpam(prev => ({ ...prev, storeName: e.target.value }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 font-sans"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Nama Customer <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Nama pembeli"
                                  value={formSpam.buyerName}
                                  onChange={e => setFormSpam(prev => ({ ...prev, buyerName: e.target.value }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 font-sans"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Order Jasa <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={formSpam.serviceType}
                                  onChange={e => setFormSpam(prev => ({ ...prev, serviceType: e.target.value }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 font-sans cursor-pointer font-semibold text-slate-700"
                                >
                                  <option value="chat">Chat</option>
                                  <option value="call">Call</option>
                                  <option value="chat&call">Chat & Call</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Jumlah Slot / Pcs <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  required
                                  min={1}
                                  value={formSpam.quantity}
                                  onChange={e => setFormSpam(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 font-mono"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Nomer Target WA <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Contoh: +6281234567890"
                                value={formSpam.targetLink}
                                onChange={e => setFormSpam(prev => ({ ...prev, targetLink: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 font-mono"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Format Chat / Notes <span className="text-slate-400">(Opsional)</span>
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Contoh: Tolong spam sampai kapok, langgar hak cipta..."
                                value={formSpam.notes}
                                onChange={e => setFormSpam(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 font-sans"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white rounded-xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                            >
                              <PhoneCall className="h-4 w-4" />
                              <span>Submit & Generate Format</span>
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* TABLE: LIST OF MANUAL SHOPEE ORDERS */}
              <div ref={shopeeQueueRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-visible scroll-mt-24">
                <div className="bg-slate-50/40 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                      Shopee Orders
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                      {filteredShopeeOrders.length} / {shopeeOrders.length} Pesanan
                    </span>
                  </div>
                </div>

                {/* Search & Sort Bar for Shopee Manual Orders */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-50/70 p-4 border-b border-slate-100">
                  <div className="relative w-full lg:w-80 group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Search className="w-4 h-4 text-purple-500 group-focus-within:text-purple-600 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={searchShopee}
                      onChange={(e) => setSearchShopee(e.target.value)}
                      placeholder="Cari pesanan, toko, pembeli..."
                      className="w-full bg-white text-xs sm:text-sm text-slate-800 rounded-full pl-10 pr-4 py-2 sm:py-2.5 outline-none border border-purple-200/80 shadow-[0_0_14px_rgba(168,85,247,0.14)] focus:shadow-[0_0_20px_rgba(168,85,247,0.28)] focus:border-purple-400 font-sans transition-all"
                    />
                    {searchShopee && (
                      <button
                        type="button"
                        onClick={() => setSearchShopee('')}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Minimalist sorting / filtering controls with Modern Backlight */}
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
                    {/* Tipe Jasa / Jenis Filter */}
                    <ModernFilterSelect
                      value={shopeeTypeFilter}
                      onChange={(v) => setShopeeTypeFilter(v as any)}
                      icon={<Filter className="w-4 h-4 text-purple-600" />}
                      glowColor="purple"
                      options={[
                        { value: 'all', label: 'Semua Jasa' },
                        { value: 'report', label: 'Report Sosmed' },
                        { value: 'spam_wa', label: 'Spam WA' },
                      ]}
                    />

                    {/* Status / Progres Filter */}
                    <ModernFilterSelect
                      value={sortShopee}
                      onChange={(v) => setSortShopee(v as any)}
                      icon={<Activity className="w-4 h-4 text-purple-600" />}
                      glowColor="purple"
                      options={[
                        { value: 'all', label: 'Semua Progres' },
                        { value: 'pending', label: 'Pending' },
                        { value: 'progress', label: 'Progres' },
                        { value: 'ready', label: 'Ready' },
                        { value: 'sudah_direkap', label: 'Sudah Direkap' },
                        { value: 'done', label: 'Done' },
                      ]}
                    />

                    {/* Timeframe Filter (Monthly Date Range Picker) */}
                    <MonthlyDateRangePicker
                      value={timeFilterShopee}
                      onChange={setTimeFilterShopee}
                      currentLang="id"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                    <colgroup>
                      <col className="w-[9%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                      <col className="w-[11%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                        <th className="px-4 py-3.5">ID / Tipe</th>
                        <th className="px-4 py-3.5">Store Name</th>
                        <th className="px-4 py-3.5">Buyer Name</th>
                        <th className="px-4 py-3.5">Jasa / Slot</th>
                        <th className="px-4 py-3.5">Target</th>
                        <th className="px-4 py-3.5">Notes</th>
                        <th className="px-4 py-3.5">Format Pesanan</th>
                        <th className="px-4 py-3.5">Work Order</th>
                        <th className="px-4 py-3.5 text-center">Assign Worker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredShopeeOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-semibold font-sans">
                            {searchShopee ? 'Tidak ada hasil pencarian yang cocok.' : 'Belum ada pesanan shopee manual dimasukkan.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedShopeeOrders.map((order) => {
                          const isSosmed = order.order_type === 'REPORT_ALL_SOSMED';
                          return (
                            <tr key={order.id} className="hover:bg-slate-50/40 transition-colors">
                              {/* ID / Tipe */}
                              <td className="px-4 py-3 font-mono">
                                <span className="font-bold text-slate-900 block">{order.id}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                  {new Date(order.created_at).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                <div className="flex flex-col gap-1 mt-1">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md inline-block w-fit ${
                                    isSosmed 
                                      ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {isSosmed ? 'REPORT' : 'SPAM WA'}
                                  </span>
                                  {order.created_by && (
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 border ${
                                      isSameInputer(order.created_by, currentAdminUser) 
                                        ? 'bg-slate-100 text-slate-600 border-slate-200' 
                                        : 'bg-violet-50 text-violet-700 border-violet-200'
                                    }`}>
                                      {!isSameInputer(order.created_by, currentAdminUser) && <Lock className="h-2 w-2 shrink-0 text-violet-500" />}
                                      <span>diinput oleh {getSlotIndicatorName(order.created_by)}</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Store Name */}
                              <td className="px-4 py-3 font-semibold text-slate-900 truncate" title={order.store_name}>
                                {order.store_name}
                              </td>

                              {/* Buyer Name */}
                              <td className="px-4 py-3 font-medium text-slate-700 truncate" title={order.buyer_name}>
                                {order.buyer_name}
                              </td>

                              {/* Jasa / Slot */}
                              <td className="px-4 py-3">
                                <span className="font-bold text-slate-800 uppercase block tracking-wider text-[10px]">{order.service_type}</span>
                                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{order.quantity} Slot / Pcs</span>
                              </td>

                              {/* Target */}
                              <td className="px-4 py-3 truncate">
                                {sanitizeUrl(order.target_link) !== '#' ? (
                                  <a 
                                    href={sanitizeUrl(order.target_link)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold"
                                    title={order.target_link}
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span>Target Link</span>
                                  </a>
                                ) : (
                                  <span className="font-mono text-slate-700 font-bold">{order.target_link}</span>
                                )}
                              </td>

                              {/* Notes */}
                              <td className="px-4 py-3 font-medium text-slate-700 truncate" title={order.notes || ''}>
                                {order.notes || '-'}
                              </td>

                              {/* Format text output with single button copy */}
                              <td className="px-4 py-3">
                                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 relative group max-h-[110px] overflow-y-auto">
                                  <pre className="font-mono text-[9px] text-slate-600 leading-normal whitespace-pre-wrap select-all">
                                    {order.formatted_text}
                                  </pre>
                                  <button
                                    onClick={() => copyToClipboard(order.formatted_text, order.id)}
                                    className="absolute top-1.5 right-1.5 bg-white border border-slate-200 hover:border-slate-400 p-1 rounded-lg shadow-sm opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Salin Format"
                                  >
                                    {copiedId === order.id ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Work Order text field */}
                              <td className="px-4 py-3">
                                <DebouncedTextarea
                                  rows={2}
                                  placeholder="Input work order..."
                                  value={order.work_order || ''}
                                  onSave={val => handleUpdateWorkOrder(order.id, val)}
                                  disabled={order.created_by !== undefined && !isSameInputer(order.created_by, currentAdminUser)}
                                  className={`w-full rounded-xl border border-slate-200 p-2 text-[10px] font-medium text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-sans resize-y min-h-[50px] ${
                                    order.created_by && !isSameInputer(order.created_by, currentAdminUser) 
                                      ? 'bg-slate-50 cursor-not-allowed text-slate-450' 
                                      : 'bg-white'
                                  }`}
                                />
                              </td>

                              {/* Assign Worker Select & Delete Action */}
                              <td className="px-4 py-3 text-center space-y-2">
                                <select
                                  value={order.worker_id || ''}
                                  onChange={e => handleAssignWorker(order.id, e.target.value)}
                                  disabled={order.created_by !== undefined && !isSameInputer(order.created_by, currentAdminUser)}
                                  className={`w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-orange-500 cursor-pointer ${
                                    order.created_by && !isSameInputer(order.created_by, currentAdminUser) 
                                      ? 'bg-slate-50 cursor-not-allowed text-slate-450' 
                                      : 'bg-white'
                                  }`}
                                >
                                  <option value="">-- No Worker --</option>
                                  {WORKERS.map(w => (
                                    <option key={w} value={w}>{w.toUpperCase()}</option>
                                  ))}
                                </select>

                                <div className="flex items-center justify-between gap-1.5 px-0.5">
                                  <span className="text-[9px] font-semibold text-slate-400">
                                    {order.worker_id ? (
                                      <span className="text-emerald-600 font-bold">Assigned</span>
                                    ) : (
                                      <span>Pending</span>
                                    )}
                                  </span>
                                  {(!order.created_by || isSameInputer(order.created_by, currentAdminUser)) && (
                                    <div className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => handleDeleteShopeeOrder(order.id)}
                                        className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors cursor-pointer"
                                        title="Hapus Order"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleOpenEditShopee(order)}
                                        className="p-1 text-blue-400 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                        title="Edit Order"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(order.formatted_text, order.id)}
                                  className={`w-full mt-1.5 px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                    copiedId === order.id
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                  }`}
                                  title="Salin Format"
                                >
                                  {copiedId === order.id ? (
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
                              </td>
                            </tr>
                          );
                        })
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

          {/* TAB 2: REVIEW MAPS */}
          {activeTab === 'maps' && (
            <div className="space-y-8 fade-in" id="adminshp-review-maps-view">
              {/* COLLAPSIBLE REVIEW MAPS FORM CARD */}
              <div 
                className={`bg-white rounded-3xl border transition-all duration-400 ${
                  isReviewMapsFormExpanded 
                    ? 'border-purple-500 ring-4 ring-purple-500/10 shadow-lg' 
                    : 'border-slate-200 shadow-sm'
                }`}
                id="card-review-maps"
              >
                {/* Card Header Section always visible */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-black shrink-0">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 leading-snug">
                        REVIEW ORDERS
                      </h2>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setIsReviewMapsFormExpanded(!isReviewMapsFormExpanded)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isReviewMapsFormExpanded
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-600/20'
                    }`}
                  >
                    {isReviewMapsFormExpanded ? 'Hide Form' : 'Input Pesanan Review Orders'}
                  </button>
                </div>

                {/* Collapsible Form Panel */}
                <AnimatePresence initial={false}>
                  {isReviewMapsFormExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.25, 0.8, 0.25, 1] }}
                      className="overflow-hidden"
                    >
                      <div ref={reviewMapsFormRef} className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                        <form onSubmit={handleSubmitReviewMaps} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Nama Store <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Contoh: GM Store"
                                value={formReviewMaps.storeName}
                                onChange={e => setFormReviewMaps(prev => ({ ...prev, storeName: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 font-sans"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Client Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Nama pembeli / client"
                                value={formReviewMaps.clientName}
                                onChange={e => setFormReviewMaps(prev => ({ ...prev, clientName: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 font-sans"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Jenis Jasa <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={formReviewMaps.reviewType}
                                onChange={e => setFormReviewMaps(prev => ({ ...prev, reviewType: e.target.value as 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 font-sans cursor-pointer font-bold text-slate-700"
                              >
                                <option value="G_MAPS">G MAPS</option>
                                <option value="TRIPAD">TRIPAD</option>
                                <option value="REVIEW_APPS">APPS</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Jumlah Slot / Target <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                required
                                min={1}
                                value={formReviewMaps.targetCount}
                                onChange={e => setFormReviewMaps(prev => ({ ...prev, targetCount: Math.max(1, Number(e.target.value)) }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Target Link <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="https://maps.app.goo.gl/... link tripadvisor, atau link app store / play store"
                              value={formReviewMaps.mapsLink}
                              onChange={e => setFormReviewMaps(prev => ({ ...prev, mapsLink: e.target.value }))}
                              className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Catatan / Clue Review <span className="text-slate-400 font-normal">(Opsional)</span>
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Clue review / catatan..."
                              value={formReviewMaps.notes}
                              onChange={e => setFormReviewMaps(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 font-sans"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-all text-white rounded-xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/10 cursor-pointer"
                          >
                            <Send className="h-4 w-4" />
                            <span>Submit &amp; Generate Format</span>
                          </button>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* TABLE LIST REVIEW MAPS */}
              <div ref={reviewMapsQueueRef} className="space-y-4 scroll-mt-24">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-visible">
                  <div className="bg-slate-50/40 border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                        DATA REVIEW ORDERS
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                        {filteredReviewMaps.length} / {mapsReviewsOnly.length} Data
                      </span>
                    </div>
                  </div>

                  {/* Search & Sort Bar for Maps Reviews */}
                  <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-50/70 p-4 border-b border-slate-100">
                    <div className="relative w-full lg:w-80 group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-purple-500 group-focus-within:text-purple-600 transition-colors" />
                      </div>
                      <input
                        type="text"
                        value={searchMaps}
                        onChange={(e) => setSearchMaps(e.target.value)}
                        placeholder="Cari toko, klien, tipe, catatan..."
                        className="w-full bg-white text-xs sm:text-sm text-slate-800 rounded-full pl-10 pr-4 py-2 sm:py-2.5 outline-none border border-purple-200/80 shadow-[0_0_14px_rgba(168,85,247,0.14)] focus:shadow-[0_0_20px_rgba(168,85,247,0.28)] focus:border-purple-400 font-sans transition-all"
                      />
                      {searchMaps && (
                        <button
                          type="button"
                          onClick={() => setSearchMaps('')}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Sorting / filtering controls */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
                      <ModernFilterSelect
                        value={reviewTypeFilter}
                        onChange={(v) => setReviewTypeFilter(v as any)}
                        icon={<Filter className="w-4 h-4 text-purple-600" />}
                        glowColor="purple"
                        options={[
                          { value: 'all', label: 'Semua Review' },
                          { value: 'GMAPS', label: 'Google Maps' },
                          { value: 'TRIPAD', label: 'Tripadvisor' },
                          { value: 'REVIEW APPS', label: 'Apps' },
                        ]}
                      />

                      <ModernFilterSelect
                        value={sortMaps}
                        onChange={(v) => setSortMaps(v as any)}
                        icon={<Activity className="w-4 h-4 text-purple-600" />}
                        glowColor="purple"
                        options={[
                          { value: 'all', label: 'Semua Progres' },
                          { value: 'pending', label: 'Pending' },
                          { value: 'progress', label: 'Progres' },
                          { value: 'ready', label: 'Ready' },
                          { value: 'sudah_direkap', label: 'Sudah Direkap' },
                          { value: 'done', label: 'Done' },
                        ]}
                      />

                      <MonthlyDateRangePicker
                        value={timeFilterMaps}
                        onChange={setTimeFilterMaps}
                        currentLang="id"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
                      <colgroup>
                        <col className="w-[12%]" />
                        <col className="w-[14%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[13%]" />
                        <col className="w-[17%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                          <th className="px-4 py-3.5">ID / Tanggal</th>
                          <th className="px-4 py-3.5">Store & Klien</th>
                          <th className="px-4 py-3.5">Jasa / Slot</th>
                          <th className="px-4 py-3.5">Target</th>
                          <th className="px-4 py-3.5">Clue / Catatan</th>
                          <th className="px-4 py-3.5">Format Pesanan</th>
                          <th className="px-4 py-3.5">Link Bukti</th>
                          <th className="px-4 py-3.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {filteredReviewMaps.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-semibold font-sans">
                              {searchMaps ? 'Tidak ada hasil pencarian yang cocok.' : 'Belum ada data review maps dimasukkan.'}
                            </td>
                          </tr>
                        ) : (
                          paginatedReviewMaps.map((item) => {
                            const isTripad = item.review_type === 'TRIPAD';
                            const isApps = item.review_type === 'REVIEW_APPS';
                            const formatStr = `Link: ${item.maps_link}\nNama cust: ${item.client_name}\nNama st: ${item.store_name || '-'}\nclue: ${item.notes || '-'}`;

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                                {/* ID / Tanggal / Status */}
                                <td className="px-4 py-3 font-mono">
                                  <span className="font-bold text-slate-900 block truncate" title={item.id}>{item.id}</span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                    {new Date(item.created_at).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  <div className="flex flex-col gap-1 mt-1">
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md inline-block w-fit ${
                                      isTripad
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : isApps
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                                    }`}>
                                      {isTripad ? 'TRIPAD' : isApps ? 'APPS' : 'G MAPS'}
                                    </span>
                                    {item.created_by && (
                                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 border ${
                                        isSameInputer(item.created_by, currentAdminUser) 
                                          ? 'bg-slate-100 text-slate-600 border-slate-200' 
                                          : 'bg-violet-50 text-violet-700 border-violet-200'
                                      }`}>
                                        {!isSameInputer(item.created_by, currentAdminUser) && <Lock className="h-2 w-2 shrink-0 text-violet-500" />}
                                        <span>diinput oleh {getSlotIndicatorName(item.created_by)}</span>
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Store & Klien (Ditumpuk) */}
                                <td className="px-4 py-3">
                                  <span className="font-extrabold text-slate-900 block truncate" title={item.store_name}>
                                    {item.store_name || '-'}
                                  </span>
                                  <span className="text-xs text-slate-600 font-medium block truncate mt-0.5" title={item.client_name}>
                                    {item.client_name}
                                  </span>
                                </td>

                                {/* Jasa / Slot */}
                                <td className="px-4 py-3">
                                  <span className="font-bold text-slate-800 uppercase block tracking-wider text-[10px]">
                                    {isTripad ? 'TRIPAD' : isApps ? 'APPS' : 'G MAPS'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                                    {item.target_count || 1} Slot
                                  </span>
                                </td>

                                {/* Target */}
                                <td className="px-4 py-3 truncate">
                                  {sanitizeUrl(item.maps_link) !== '#' ? (
                                    <a
                                      href={sanitizeUrl(item.maps_link)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-purple-600 hover:underline inline-flex items-center gap-1 font-mono text-[10px] font-semibold truncate max-w-full"
                                      title={item.maps_link}
                                    >
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                      <span className="truncate">Target Link</span>
                                    </a>
                                  ) : (
                                    <span className="font-mono text-slate-700 font-bold truncate block">{item.maps_link}</span>
                                  )}
                                </td>

                                {/* Clue / Catatan */}
                                <td className="px-4 py-3">
                                  <DebouncedTextarea
                                    rows={2}
                                    placeholder="Clue..."
                                    value={item.notes || ''}
                                    onSave={val => handleUpdateNotes(item.id, val)}
                                    disabled={item.created_by !== undefined && !isSameInputer(item.created_by, currentAdminUser)}
                                    className={`w-full rounded-lg border border-slate-200 p-1.5 text-[10px] font-medium text-slate-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 font-sans resize-y min-h-[55px] ${
                                      item.created_by && !isSameInputer(item.created_by, currentAdminUser) 
                                        ? 'bg-slate-50 cursor-not-allowed text-slate-400' 
                                        : 'bg-white'
                                    }`}
                                  />
                                </td>

                                {/* Format Pesanan with Single Button Copy */}
                                <td className="px-4 py-3">
                                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 relative group max-h-[110px] overflow-y-auto">
                                    <pre className="font-mono text-[9px] text-slate-600 leading-normal whitespace-pre-wrap select-all">
                                      {formatStr}
                                    </pre>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(formatStr, item.id)}
                                      className="absolute top-1.5 right-1.5 bg-white border border-slate-200 hover:border-slate-400 p-1 rounded-lg shadow-sm opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                      title="Salin Format"
                                    >
                                      {copiedId === item.id ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                                      )}
                                    </button>
                                  </div>
                                </td>

                                {/* Link Bukti */}
                                <td className="px-4 py-3">
                                  <DebouncedInput
                                    type="text"
                                    placeholder="Input link bukti..."
                                    value={item.proof_link || ''}
                                    onSave={val => handleUpdateProofLink(item.id, val)}
                                    disabled={item.created_by !== undefined && !isSameInputer(item.created_by, currentAdminUser)}
                                    className={`w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-purple-500 text-slate-700 font-mono ${
                                      item.created_by && !isSameInputer(item.created_by, currentAdminUser) 
                                        ? 'bg-slate-50 cursor-not-allowed text-slate-400' 
                                        : 'bg-white'
                                    }`}
                                  />
                                  {item.proof_link && sanitizeUrl(item.proof_link) !== '#' && (
                                    <a
                                      href={sanitizeUrl(item.proof_link)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[9px] text-purple-600 hover:underline font-mono inline-flex items-center gap-1 mt-1.5 truncate max-w-full font-bold"
                                      title={item.proof_link}
                                    >
                                      <ExternalLink className="h-2.5 w-2.5" />
                                      <span>Buka Bukti →</span>
                                    </a>
                                  )}
                                </td>

                                {/* Aksi */}
                                <td className="px-4 py-3 text-center space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(formatStr, item.id)}
                                    className={`w-full px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                      copiedId === item.id
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    }`}
                                    title="Salin Format"
                                  >
                                    {copiedId === item.id ? (
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

                                  {(!item.created_by || isSameInputer(item.created_by, currentAdminUser)) && (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditMaps(item)}
                                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                        title="Edit Target"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMapsReview(item.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                        title="Hapus Target"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={pageMaps}
                    totalPages={Math.ceil(filteredReviewMaps.length / ITEMS_PER_PAGE)}
                    onPageChange={setPageMaps}
                    activeBgColor="bg-purple-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REPORT MAPS */}
          {activeTab === 'report_maps' && (
            <div className="space-y-8 fade-in" id="adminshp-report-maps-view">
              {/* COLLAPSIBLE REPORT MAPS FORM CARD */}
              <div 
                className={`bg-white rounded-3xl border transition-all duration-400 ${
                  isReportMapsFormExpanded 
                    ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg' 
                    : 'border-slate-200 shadow-sm'
                }`}
                id="card-report-maps"
              >
                {/* Card Header Section always visible */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black shrink-0">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 leading-snug">
                        REPORT ORDERS
                      </h2>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setIsReportMapsFormExpanded(!isReportMapsFormExpanded)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isReportMapsFormExpanded
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20'
                    }`}
                  >
                    {isReportMapsFormExpanded ? 'Hide Form' : 'Input Pesanan Report Orders'}
                  </button>
                </div>

                {/* Collapsible Form Panel */}
                <AnimatePresence initial={false}>
                  {isReportMapsFormExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.25, 0.8, 0.25, 1] }}
                      className="overflow-hidden"
                    >
                      <div ref={reportMapsFormRef} className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                        <form onSubmit={handleSubmitReportMaps} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Nama Store <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Contoh: GM Store"
                                value={formReportMaps.storeName}
                                onChange={e => setFormReportMaps(prev => ({ ...prev, storeName: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Client Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Nama pembeli / client"
                                value={formReportMaps.clientName}
                                onChange={e => setFormReportMaps(prev => ({ ...prev, clientName: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Jenis Jasa <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={formReportMaps.reviewType}
                                onChange={e => setFormReportMaps(prev => ({ ...prev, reviewType: e.target.value as 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans cursor-pointer font-bold text-slate-700"
                              >
                                <option value="G_MAPS">G MAPS</option>
                                <option value="TRIPAD">TRIPAD</option>
                                <option value="REVIEW_APPS">APPS</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Jumlah Slot / Target <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                required
                                min={1}
                                value={formReportMaps.targetCount}
                                onChange={e => setFormReportMaps(prev => ({ ...prev, targetCount: Math.max(1, Number(e.target.value)) }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Target Link <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="https://maps.app.goo.gl/... atau link tripadvisor"
                              value={formReportMaps.mapsLink}
                              onChange={e => setFormReportMaps(prev => ({ ...prev, mapsLink: e.target.value }))}
                              className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Alasan <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              rows={2}
                              required
                              placeholder="Alasan report / detail pengerjaan..."
                              value={formReportMaps.notes}
                              onChange={e => setFormReportMaps(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white rounded-xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 cursor-pointer"
                          >
                            <Send className="h-4 w-4" />
                            <span>Submit &amp; Generate Format</span>
                          </button>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* TABLE PROGRESS & LIST */}

                {/* TABLE LIST REPORT MAPS */}
                <div ref={reportMapsQueueRef} className="space-y-4 scroll-mt-24">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-visible">
                    <div className="bg-slate-50/40 border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                          DATA REPORT ORDERS
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                          {filteredReportMaps.length} / {allReportMaps.length} Data
                        </span>
                      </div>
                    </div>

                    {/* Search & Sort Bar for Maps Reviews */}
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-50/70 p-4 border-b border-slate-100">
                      <div className="relative w-full lg:w-80 group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Search className="w-4 h-4 text-blue-500 group-focus-within:text-blue-600 transition-colors" />
                        </div>
                        <input
                          type="text"
                          value={searchReportMaps}
                          onChange={(e) => setSearchReportMaps(e.target.value)}
                          placeholder="Cari toko, klien, tipe, alasan..."
                          className="w-full bg-white text-xs sm:text-sm text-slate-800 rounded-full pl-10 pr-4 py-2 sm:py-2.5 outline-none border border-blue-200/80 shadow-[0_0_14px_rgba(59,130,246,0.14)] focus:shadow-[0_0_20px_rgba(59,130,246,0.28)] focus:border-blue-400 font-sans transition-all"
                        />
                        {searchReportMaps && (
                          <button
                            type="button"
                            onClick={() => setSearchReportMaps('')}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Sorting / filtering controls */}
                      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
                        <ModernFilterSelect
                          value={reportTypeFilter}
                          onChange={(v) => setReportTypeFilter(v as any)}
                          icon={<Filter className="w-4 h-4 text-blue-600" />}
                          glowColor="blue"
                          options={[
                            { value: 'all', label: 'Semua Report' },
                            { value: 'GMAPS', label: 'Google Maps' },
                            { value: 'TRIPAD', label: 'Tripadvisor' },
                            { value: 'REVIEW APPS', label: 'Apps' },
                          ]}
                        />

                        <ModernFilterSelect
                          value={sortReportMaps}
                          onChange={(v) => setSortReportMaps(v as any)}
                          icon={<Activity className="w-4 h-4 text-blue-600" />}
                          glowColor="blue"
                          options={[
                            { value: 'all', label: 'Semua Progres' },
                            { value: 'pending', label: 'Pending' },
                            { value: 'progress', label: 'Progres' },
                            { value: 'ready', label: 'Ready' },
                            { value: 'sudah_direkap', label: 'Sudah Direkap' },
                            { value: 'done', label: 'Done' },
                          ]}
                        />

                        <MonthlyDateRangePicker
                          value={timeFilterReportMaps}
                          onChange={setTimeFilterReportMaps}
                          currentLang="id"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
                        <colgroup>
                          <col className="w-[12%]" />
                          <col className="w-[14%]" />
                          <col className="w-[10%]" />
                          <col className="w-[12%]" />
                          <col className="w-[13%]" />
                          <col className="w-[17%]" />
                          <col className="w-[12%]" />
                          <col className="w-[10%]" />
                        </colgroup>
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                            <th className="px-4 py-3.5">ID / Tanggal</th>
                            <th className="px-4 py-3.5">Store & Klien</th>
                            <th className="px-4 py-3.5">Jasa / Slot</th>
                            <th className="px-4 py-3.5">Target</th>
                            <th className="px-4 py-3.5">Alasan</th>
                            <th className="px-4 py-3.5">Format Pesanan</th>
                            <th className="px-4 py-3.5">Link Bukti</th>
                            <th className="px-4 py-3.5 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {filteredReportMaps.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-semibold font-sans">
                                {searchReportMaps ? 'Tidak ada hasil pencarian yang cocok.' : 'Belum ada data report maps dimasukkan.'}
                              </td>
                            </tr>
                          ) : (
                            paginatedReportMaps.map((item) => {
                              const isTripad = (item.service_type as any) === 'TRIPAD';
                              const isApps = (item.service_type as any) === 'REVIEW_APPS';
                              const formatStr = `Link: ${item.maps_link}\nNama cust: ${item.client_name}\nNama st: ${item.store_name || '-'}\nJenis Jasa: ${isTripad ? 'TRIPAD' : isApps ? 'APPS' : 'G MAPS'}\nSlot: ${item.slot || 1}\nAlasan: ${item.reason || item.notes || '-'}`;

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                                  {/* ID / Tanggal / Status */}
                                  <td className="px-4 py-3 font-mono">
                                    <span className="font-bold text-slate-900 block truncate" title={item.id}>{item.id}</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                      {new Date(item.created_at).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                    <div className="flex flex-col gap-1 mt-1">
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md inline-block w-fit ${
                                        isTripad
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : isApps
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}>
                                        {isTripad ? 'TRIPAD' : isApps ? 'APPS' : 'G MAPS'}
                                      </span>
                                      {item.created_by && (
                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 border ${
                                          isSameInputer(item.created_by, currentAdminUser) 
                                            ? 'bg-slate-100 text-slate-600 border-slate-200' 
                                            : 'bg-violet-50 text-violet-700 border-violet-200'
                                        }`}>
                                          {!isSameInputer(item.created_by, currentAdminUser) && <Lock className="h-2 w-2 shrink-0 text-violet-500" />}
                                          <span>diinput oleh {getSlotIndicatorName(item.created_by)}</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Store & Klien (Ditumpuk) */}
                                  <td className="px-4 py-3">
                                    <span className="font-extrabold text-slate-900 block truncate" title={item.store_name}>
                                      {item.store_name || '-'}
                                    </span>
                                    <span className="text-xs text-slate-600 font-medium block truncate mt-0.5" title={item.client_name}>
                                      {item.client_name}
                                    </span>
                                  </td>

                                  {/* Jasa / Slot */}
                                  <td className="px-4 py-3">
                                    <span className="font-bold text-slate-800 uppercase block tracking-wider text-[10px]">
                                      {isTripad ? 'TRIPAD' : isApps ? 'APPS' : 'G MAPS'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                                      {item.slot || 1} Slot
                                    </span>
                                  </td>

                                  {/* Target */}
                                  <td className="px-4 py-3 truncate">
                                    {sanitizeUrl(item.maps_link) !== '#' ? (
                                      <a
                                        href={sanitizeUrl(item.maps_link)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-purple-600 hover:underline inline-flex items-center gap-1 font-mono text-[10px] font-semibold truncate max-w-full"
                                        title={item.maps_link}
                                      >
                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                        <span className="truncate">Target Link</span>
                                      </a>
                                    ) : (
                                      <span className="font-mono text-slate-700 font-bold truncate block">{item.maps_link}</span>
                                    )}
                                  </td>

                                  {/* Alasan */}
                                  <td className="px-4 py-3">
                                    <DebouncedTextarea
                                      rows={2}
                                      placeholder="Alasan..."
                                      value={item.reason || item.notes || ''}
                                      onSave={val => handleUpdateReportReason(item.id, val)}
                                      disabled={item.created_by !== undefined && !isSameInputer(item.created_by, currentAdminUser)}
                                      className={`w-full rounded-lg border border-slate-200 p-1.5 text-[10px] font-medium text-slate-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 font-sans resize-y min-h-[55px] ${
                                        item.created_by && !isSameInputer(item.created_by, currentAdminUser) 
                                          ? 'bg-slate-50 cursor-not-allowed text-slate-400' 
                                          : 'bg-white'
                                      }`}
                                    />
                                  </td>

                                  {/* Format Pesanan with Single Button Copy */}
                                  <td className="px-4 py-3">
                                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 relative group max-h-[110px] overflow-y-auto">
                                      <pre className="font-mono text-[9px] text-slate-600 leading-normal whitespace-pre-wrap select-all">
                                        {formatStr}
                                      </pre>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(formatStr, item.id)}
                                        className="absolute top-1.5 right-1.5 bg-white border border-slate-200 hover:border-slate-400 p-1 rounded-lg shadow-sm opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        title="Salin Format"
                                      >
                                        {copiedId === item.id ? (
                                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5 text-slate-500" />
                                        )}
                                      </button>
                                    </div>
                                  </td>

                                  {/* Link Bukti (input di luar form seperti di table sosmed lainnya) */}
                                  <td className="px-4 py-3">
                                    <DebouncedInput
                                      type="text"
                                      placeholder="Input link bukti..."
                                      value={item.proof_link || ''}
                                      onSave={val => handleUpdateReportProofLink(item.id, val)}
                                      disabled={item.created_by !== undefined && !isSameInputer(item.created_by, currentAdminUser)}
                                      className={`w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-purple-500 text-slate-700 font-mono ${
                                        item.created_by && !isSameInputer(item.created_by, currentAdminUser) 
                                          ? 'bg-slate-50 cursor-not-allowed text-slate-400' 
                                          : 'bg-white'
                                      }`}
                                    />
                                    {item.proof_link && sanitizeUrl(item.proof_link) !== '#' && (
                                      <a
                                        href={sanitizeUrl(item.proof_link)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[9px] text-purple-600 hover:underline font-mono inline-flex items-center gap-1 mt-1.5 truncate max-w-full font-bold"
                                        title={item.proof_link}
                                      >
                                        <ExternalLink className="h-2.5 w-2.5" />
                                        <span>Buka Bukti →</span>
                                      </a>
                                    )}
                                  </td>

                                  {/* Aksi */}
                                  <td className="px-4 py-3 text-center space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(formatStr, item.id)}
                                      className={`w-full px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                        copiedId === item.id
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                      }`}
                                      title="Salin Format"
                                    >
                                      {copiedId === item.id ? (
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

                                    {(!item.created_by || isSameInputer(item.created_by, currentAdminUser)) && (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditReportMap(item)}
                                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                          title="Edit Target"
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteReportMap(item.id)}
                                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                          title="Hapus Target"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      currentPage={pageReportMaps}
                      totalPages={Math.ceil(filteredReportMaps.length / ITEMS_PER_PAGE)}
                      onPageChange={setPageReportMaps}
                      activeBgColor="bg-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

        </>
      )}

      {/* Modal screenshot ready view */}
      {screenshotModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Visual Area to take screenshot of */}
            <div id="screenshot-content" className="p-8 bg-white flex-grow overflow-y-auto space-y-6">
              {/* Branding / Title */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-5">
                <div>
                  <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase bg-blue-50 px-2.5 py-1 rounded-md">
                    GM AGENCY - STATUS LAPORAN
                  </span>
                  <h2 className="text-xl font-black text-slate-900 mt-2 font-sans">
                    {screenshotModalItem.review_type === 'REVIEW_APPS' 
                      ? 'Review Apps Reviewer List' 
                      : screenshotModalItem.review_type === 'TRIPAD' 
                      ? 'Tripadvisor Reviewer List' 
                      : 'Google Maps Reviewer List'
                    }
                  </h2>
                </div>
                <div className="text-right col-span-1 shrink-0">
                  <span className="text-xs font-bold text-slate-400 block">Tanggal Laporan</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {new Date(screenshotModalItem.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">NAMA CLIENT:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{screenshotModalItem.client_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-1">PROGRES ULASAN:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {screenshotModalItem.reviewer_accounts?.length || 0} dari {screenshotModalItem.target_count} Target
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-bold block mb-1">
                    {screenshotModalItem.review_type === 'REVIEW_APPS' 
                      ? 'LINK TARGET APPS:' 
                      : screenshotModalItem.review_type === 'TRIPAD' 
                      ? 'LINK TRIPADVISOR:' 
                      : 'LINK GOOGLE MAPS:'
                    }
                  </span>
                  <span className="font-mono text-[10px] text-blue-600 truncate block">
                    {screenshotModalItem.maps_link}
                  </span>
                </div>
              </div>

              {/* Fully Visible Non-Scrolling Grid of Reviewers */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  List Akun Reviewer Real Selesai:
                </span>
                
                {screenshotModalItem.reviewer_accounts && screenshotModalItem.reviewer_accounts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {screenshotModalItem.reviewer_accounts.map((acc, index) => (
                      <div key={index} className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-150 font-semibold text-slate-800">
                        <span className="h-5 w-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-mono font-bold text-[10px]">
                          {index + 1}
                        </span>
                        <span className="truncate">{acc}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                    Belum ada ulasan akun yang selesai diinput.
                  </div>
                )}
              </div>
            </div>

            {/* Footer Controls */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[10px] text-slate-400 font-medium">
                * Ekspor PDF akan otomatis mengatur tata letak agar muat dalam 1 lembar A4.
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleExportPDF(screenshotModalItem)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Unduh PDF (1 Lembar)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const accountsText = screenshotModalItem.reviewer_accounts?.map((acc, i) => `${i + 1}. ${acc}`).join('\n') || '';
                    navigator.clipboard.writeText(`*GM AGENCY - LAPORAN MAPS REVIEW*\n\nClient: ${screenshotModalItem.client_name}\nTarget: ${screenshotModalItem.reviewer_accounts?.length || 0} / ${screenshotModalItem.target_count}\n\nList Akun:\n${accountsText}`);
                    toast.success('Format Laporan berhasil disalin ke clipboard!');
                  }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Salin Teks Laporan
                </button>
                <button
                  type="button"
                  onClick={() => setScreenshotModalItem(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SHOPEE EDIT MODAL */}
      {isShopeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8 animate-in fade-in zoom-in-95 duration-250">
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
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
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
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8 animate-in fade-in zoom-in-95 duration-250">
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
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                    onChange={(e) => setEditMapsReviewType(e.target.value as 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS')}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
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
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
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

      {/* REPORT MAPS EDIT MODAL */}
      {isReportMapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8 animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <h3 className="font-black text-slate-950 text-base font-sans uppercase">
                {currentLang === 'id' ? 'EDIT INPUTAN REPORT MAPS' : 'EDIT REPORT MAPS INPUT'}
              </h3>
              <button 
                onClick={() => {
                  setIsReportMapModalOpen(false);
                  setEditingReportMap(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReportMapEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Nama Klien / Cust' : 'Client Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editRepClientName}
                    onChange={(e) => setEditRepClientName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Nama Toko / Store' : 'Store Name'}
                  </label>
                  <input
                    type="text"
                    value={editRepStoreName}
                    onChange={(e) => setEditRepStoreName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Jenis Jasa' : 'Service Type'}
                  </label>
                  <select
                    value={editRepServiceType}
                    onChange={(e) => setEditRepServiceType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="G_MAPS">GOOGLE MAPS</option>
                    <option value="TRIPAD">TRIPADVISOR</option>
                    <option value="REVIEW_APPS">REVIEW APPS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {currentLang === 'id' ? 'Slot Target' : 'Target Slot'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editRepSlot}
                    onChange={(e) => setEditRepSlot(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Target Link' : 'Target Link'}
                </label>
                <input
                  type="text"
                  required
                  value={editRepMapsLink}
                  onChange={(e) => setEditRepMapsLink(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {currentLang === 'id' ? 'Alasan (Reason)' : 'Reason'}
                </label>
                <textarea
                  rows={3}
                  value={editRepReason}
                  onChange={(e) => setEditRepReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsReportMapModalOpen(false);
                    setEditingReportMap(null);
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

      {/* Delete Confirmation Modal */}
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
                  } else if (deleteConfirm.type === 'maps_review') {
                    executeDeleteMapsReview(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'report_map') {
                    executeDeleteReportMap(deleteConfirm.id);
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
