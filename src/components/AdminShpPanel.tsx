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
  dbIsSupabaseConnected
} from '../lib/supabase';
import { logAdminShpAction } from '../utils/adminshpLogs';
import { toast } from '../utils/toast';
import { ShopeeOrder, MapsReview } from '../types';
import { 
  Copy, 
  Plus, 
  Check, 
  Trash2, 
  User, 
  ExternalLink, 
  FileText, 
  MessageSquare, 
  MapPin, 
  RefreshCw,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  ChevronRight,
  Send,
  PhoneCall,
  CheckCircle2,
  Table,
  FileDown,
  Search
} from 'lucide-react';

interface AdminShpPanelProps {
  currentLang: 'id' | 'en';
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
  if (['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'].includes(clean)) {
    return clean;
  }
  return null;
};

export default function AdminShpPanel({ currentLang }: AdminShpPanelProps) {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const pathname = window.location.pathname;
      if (pathname === '/adminshp') return false; // Force NOT authenticated on portal!
      
      const slot = getSlotFromRouteName(pathname);
      if (!slot) return false;

      const isAuth = sessionStorage.getItem('gm_adminshp_auth') === 'true';
      const authUser = sessionStorage.getItem('gm_adminshp_user');
      return isAuth && authUser === slot;
    } catch (e) {
      return false;
    }
  });
  const [currentAdminUser, setCurrentAdminUser] = useState<string>(() => {
    try {
      const pathname = window.location.pathname;
      if (pathname === '/adminshp') return ''; // Force empty user on portal!
      
      const slot = getSlotFromRouteName(pathname);
      if (!slot) return '';

      return sessionStorage.getItem('gm_adminshp_user') || '';
    } catch (e) {
      return '';
    }
  });
  const [adminUsername, setAdminUsername] = useState(() => {
    const pathname = window.location.pathname;
    const slot = getSlotFromRouteName(pathname);
    return slot ? getSlotRouteName(slot) : '';
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Tabs: 'shopee' (Shopee Orders), 'maps' (Maps Reviews)
  const [activeTab, setActiveTab] = useState<'shopee' | 'maps'>('shopee');

  // Search & Sort states for tables
  const [searchShopee, setSearchShopee] = useState('');
  const [sortShopee, setSortShopee] = useState<'pending' | 'progress' | 'done'>('pending');
  const [timeFilterShopee, setTimeFilterShopee] = useState<'all' | 'week' | 'month'>('all');

  const [searchMaps, setSearchMaps] = useState('');
  const [sortMaps, setSortMaps] = useState<'pending' | 'progress' | 'done'>('pending');
  const [timeFilterMaps, setTimeFilterMaps] = useState<'all' | 'week' | 'month'>('all');

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

  // Loading states
  const [shopeeOrders, setShopeeOrders] = useState<ShopeeOrder[]>([]);
  const [mapsReviews, setMapsReviews] = useState<MapsReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'shopee_order' | 'maps_review' } | null>(null);
  const [screenshotModalItem, setScreenshotModalItem] = useState<MapsReview | null>(null);

  // Form Collapse States
  // 'REPORT' | 'SPAM' | null
  const [activeForm, setActiveForm] = useState<'REPORT' | 'SPAM' | null>(null);
  const [isMapsFormExpanded, setIsMapsFormExpanded] = useState<boolean>(false);

  // DOM Refs for auto-scroll
  const reportFormRef = useRef<HTMLDivElement>(null);
  const spamFormRef = useRef<HTMLDivElement>(null);
  const mapsFormRef = useRef<HTMLDivElement>(null);
  const shopeeQueueRef = useRef<HTMLDivElement>(null);
  const mapsQueueRef = useRef<HTMLDivElement>(null);

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

  // Form State: Input 3 (MAPS REVIEW)
  const [formMaps, setFormMaps] = useState({
    clientName: '',
    mapsLink: '',
    targetCount: 5,
    storeName: '',
    notes: '',
    reviewType: 'G_MAPS' as 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS'
  });

  // Temporary state for typing "Nama Akun" per MapsReview row
  const [tempAccountInput, setTempAccountInput] = useState<Record<string, string>>({});

  // Listen to route changes and sync with username pre-fill & session security
  useEffect(() => {
    const handleRouteSync = () => {
      const pathname = window.location.pathname;
      const slot = getSlotFromRouteName(pathname);
      const routeName = slot ? getSlotRouteName(slot) : null;

      if (slot && routeName) {
        // If they visited /adminshp1 but it's customized as /adminera, we sync the URL pathname
        const currentSegment = pathname.replace(/^\//, '').trim().toLowerCase();
        if (currentSegment !== routeName) {
          window.history.replaceState(null, '', `/${routeName}`);
        }

        // If the matched user is different from the currently logged in session,
        // we automatically logout the current user to keep logs and accounts separate.
        if (isAuthenticated && currentAdminUser !== slot) {
          setIsAuthenticated(false);
          setCurrentAdminUser('');
          try {
            sessionStorage.removeItem('gm_adminshp_auth');
            sessionStorage.removeItem('gm_adminshp_user');
          } catch (e) {
            console.warn(e);
          }
        }
        setAdminUsername(routeName);
      } else if (pathname === '/adminshp') {
        // General adminshp portal - force clean login form and clear session
        if (isAuthenticated) setIsAuthenticated(false);
        if (currentAdminUser) setCurrentAdminUser('');
        if (adminUsername) setAdminUsername('');
        if (adminPassword) setAdminPassword('');
        if (authError) setAuthError('');
        try {
          sessionStorage.removeItem('gm_adminshp_auth');
          sessionStorage.removeItem('gm_adminshp_user');
        } catch (e) {
          console.warn(e);
        }
      }
    };

    handleRouteSync();
    window.addEventListener('popstate', handleRouteSync);
    return () => {
      window.removeEventListener('popstate', handleRouteSync);
    };
  }, [isAuthenticated, currentAdminUser]);

  // Fetch all initial data if authenticated
  const loadData = async () => {
    if (!isAuthenticated || !currentAdminUser) return;
    setIsLoading(true);
    try {
      const orders = await dbGetShopeeOrders();
      const reviews = await dbGetMapsReviews();
      
      // Filter logs per account: each account only logs and sees their own data.
      // Pre-existing/legacy records are shown to all for safety.
      const ADMIN_ACCOUNTS = ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'];
      try {
        const credsStr = localStorage.getItem('gm_adminshp_creds');
        if (credsStr) {
          const custom = JSON.parse(credsStr);
          Object.keys(custom).forEach(k => {
            if (!ADMIN_ACCOUNTS.includes(k)) {
              ADMIN_ACCOUNTS.push(k);
            }
          });
        }
      } catch (e) {
        console.error(e);
      }

      const filteredOrders = orders.filter(o => 
        !o.created_by || 
        o.created_by === currentAdminUser || 
        !ADMIN_ACCOUNTS.includes(o.created_by)
      );
      const filteredReviews = reviews.filter(r => 
        !r.created_by || 
        r.created_by === currentAdminUser || 
        !ADMIN_ACCOUNTS.includes(r.created_by)
      );

      setShopeeOrders(filteredOrders);
      setMapsReviews(filteredReviews);
    } catch (error) {
      console.error('Error loading Shopee and Maps data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, currentAdminUser]);

  useEffect(() => {
    const handleLogoutEvent = () => {
      handleLogout();
    };
    const handleRefreshEvent = () => {
      if (isAuthenticated) {
        loadData();
      }
    };
    window.addEventListener('adminshp-logout', handleLogoutEvent);
    window.addEventListener('adminshp-refresh', handleRefreshEvent);
    return () => {
      window.removeEventListener('adminshp-logout', handleLogoutEvent);
      window.removeEventListener('adminshp-refresh', handleRefreshEvent);
    };
  }, [isAuthenticated, currentAdminUser]);

  // Handle Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = adminUsername.trim().toLowerCase();
    const p = adminPassword;

    const credsStr = localStorage.getItem('gm_adminshp_creds');
    let validCreds: Record<string, string> = {
      'adminshp1': 'gmadminshp1',
      'adminshp2': 'gmadminshp2',
      'adminshp3': 'gmadminshp3',
      'adminshp4': 'gmadminshp4',
    };

    let matchedSlot: string | null = null;

    if (credsStr) {
      try {
        const customCreds = JSON.parse(credsStr);
        for (const slot of ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4']) {
          const slotCred = customCreds[slot];
          if (slotCred && slotCred.username && slotCred.username.trim().toLowerCase() === u) {
            if (slotCred.password === p) {
              matchedSlot = slot;
            }
          }
        }
      } catch (e) {}
    }

    if (!matchedSlot) {
      // Check default fallback only if slot hasn't been customized
      for (const slot of ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4']) {
        let isCustomized = false;
        if (credsStr) {
          try {
            const customCreds = JSON.parse(credsStr);
            if (customCreds[slot]) isCustomized = true;
          } catch (e) {}
        }
        if (!isCustomized && slot === u && validCreds[slot] === p) {
          matchedSlot = slot;
        }
      }
    }

    if (matchedSlot) {
      setIsAuthenticated(true);
      setCurrentAdminUser(matchedSlot);
      const routeName = getSlotRouteName(matchedSlot);
      window.history.pushState(null, '', `/${routeName}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      try {
        sessionStorage.setItem('gm_adminshp_auth', 'true');
        sessionStorage.setItem('gm_adminshp_user', matchedSlot);
      } catch (err) {
        console.warn('Session storage restricted', err);
      }
      setAuthError('');
      // Log login activity
      logAdminShpAction(matchedSlot, 'Login', `Berhasil login ke sistem portal adminshp`);
    } else {
      setAuthError(currentLang === 'id' ? 'Username atau password salah!' : 'Invalid username or password!');
    }
  };

  const handleLogout = () => {
    if (currentAdminUser) {
      logAdminShpAction(currentAdminUser, 'Logout', `Berhasil logout dari sistem portal adminshp`);
    }
    setIsAuthenticated(false);
    setCurrentAdminUser('');
    try {
      sessionStorage.removeItem('gm_adminshp_auth');
      sessionStorage.removeItem('gm_adminshp_user');
    } catch (err) {
      console.warn('Session storage restricted', err);
    }
    setAdminUsername('');
    setAdminPassword('');
    window.history.pushState(null, '', '/adminshp');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
        created_by: currentAdminUser
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
        created_by: currentAdminUser
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

  // Submit Input 3 (MAPS REVIEW)
  const handleSubmitMaps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMaps.clientName || !formMaps.mapsLink || !formMaps.targetCount || !formMaps.storeName || !formMaps.notes) {
      toast.error(currentLang === 'id' ? 'Mohon lengkapi semua data wajib (termasuk Nama Store & Notes/Clue)!' : 'Please fill all required fields (including Store Name & Notes/Clue)!');
      return;
    }

    try {
      const newReview = await dbCreateMapsReview({
        client_name: formMaps.clientName,
        maps_link: formMaps.mapsLink,
        target_count: formMaps.targetCount,
        store_name: formMaps.storeName,
        notes: formMaps.notes,
        review_type: formMaps.reviewType,
        reviewer_accounts: [],
        proof_link: '',
        status: 'PENDING',
        created_by: currentAdminUser
      });

      setMapsReviews(prev => [newReview, ...prev]);

      // Log action
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Buat Maps Target', `Mendaftarkan target review baru untuk store "${formMaps.storeName}" dengan target ${formMaps.targetCount} review`);
      }

      // Reset form
      setFormMaps({
        clientName: '',
        mapsLink: '',
        targetCount: 5,
        storeName: '',
        notes: '',
        reviewType: 'G_MAPS'
      });

      // Collapse form & scroll to maps queue
      setIsMapsFormExpanded(false);
      setTimeout(() => {
        mapsQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);

      toast.success(currentLang === 'id' ? 'Target review maps berhasil didaftarkan!' : 'Maps Review target created successfully!');
    } catch (err) {
      console.error(err);
      toast.error(currentLang === 'id' ? `Gagal menambah data: ${err instanceof Error ? err.message : String(err)}` : `Failed to create data: ${err instanceof Error ? err.message : String(err)}`);
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
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Tambah Reviewer', `Menambahkan akun reviewer "${nameToAdd}" ke review store "${targetReview.store_name}"`);
      }
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
      if (currentAdminUser) {
        logAdminShpAction(currentAdminUser, 'Hapus Reviewer', `Menghapus akun reviewer dari review store "${targetReview.store_name}"`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus akun progres.');
    }
  };

  // Update Bukti Link and check if Done
  const handleUpdateProofLink = async (reviewId: string, value: string) => {
    const status = value.trim() !== '' ? 'DONE' : 'PENDING';
    const targetReview = mapsReviews.find(r => r.id === reviewId);
    try {
      await dbUpdateMapsReview(reviewId, {
        proof_link: value,
        status: status
      });
      setMapsReviews(prev => prev.map(r => r.id === reviewId ? { ...r, proof_link: value, status: status } : r));
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
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8" id="adminshp-login-portal">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 mb-2 border border-orange-500/20">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight font-sans">
              Admin Shopee Portal
            </h2>
            <p className="text-xs text-slate-400 font-medium font-sans">
              Silakan login dengan akun admin Anda
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {authError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs font-bold text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="adminshp1"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-sans pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-orange-700 transition-all cursor-pointer mt-2 font-sans flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span>Authenticate Portal</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered and sorted Shopee Orders
  const filteredShopeeOrders = shopeeOrders
    .filter(order => isWithinTimeframe(order.created_at, timeFilterShopee))
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
    .sort((a, b) => {
      const getStatusScore = (o: any) => {
        const stat = o.status || 'PENDING';
        if (sortShopee === 'pending') {
          if (stat === 'PENDING') return 0;
          if (stat === 'PROGRESS') return 1;
          return 2;
        }
        if (sortShopee === 'progress') {
          if (stat === 'PROGRESS') return 0;
          if (stat === 'PENDING') return 1;
          return 2;
        }
        if (sortShopee === 'done') {
          if (stat === 'DONE') return 0;
          if (stat === 'PROGRESS') return 1;
          return 2;
        }
        return 0;
      };

      const scoreA = getStatusScore(a);
      const scoreB = getStatusScore(b);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Filtered and sorted Maps Reviews
  const filteredMapsReviews = mapsReviews
    .filter(review => isWithinTimeframe(review.created_at, timeFilterMaps))
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
      const getStatusScore = (o: any) => {
        const stat = o.status || 'PENDING';
        if (sortMaps === 'pending') {
          if (stat === 'PENDING') return 0;
          if (stat === 'PROGRESS') return 1;
          return 2;
        }
        if (sortMaps === 'progress') {
          if (stat === 'PROGRESS') return 0;
          if (stat === 'PENDING') return 1;
          return 2;
        }
        if (sortMaps === 'done') {
          if (stat === 'DONE') return 0;
          if (stat === 'PROGRESS') return 1;
          return 2;
        }
        return 0;
      };

      const scoreA = getStatusScore(a);
      const scoreB = getStatusScore(b);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans" id="shopee-portal-container">
      {/* Header Portal */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5 border-b border-slate-100 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-sans">
              Shopee Integration
            </span>
            <span className="bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-sans flex items-center gap-1.5">
              <User className="h-3 w-3 text-slate-450" />
              <span>Admin: {currentAdminUser.toUpperCase()}</span>
            </span>
            {dbIsSupabaseConnected() ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-sans flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Server Online</span>
              </span>
            ) : (
              <span className="bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-sans flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span>Server Offline</span>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight font-sans">
            Manual Shopee Order Entry Portal
          </h1>
          <p className="text-slate-550 text-xs mt-1.5 leading-relaxed">
            Silakan masukkan data transaksi pesanan shopee secara manual sesuai dengan jenis layanan di bawah ini.
          </p>
        </div>

      </div>

      {/* Tab Switches */}
      <div className="flex border-b border-slate-100 mb-8 gap-3">
        <button
          onClick={() => setActiveTab('shopee')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-all cursor-pointer ${
            activeTab === 'shopee'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-400 hover:text-slate-750'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>SOSMED & SPAM WA</span>
        </button>
        <button
          onClick={() => setActiveTab('maps')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-all cursor-pointer ${
            activeTab === 'maps'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-750'
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span>G MAPS & REVIEW APPS</span>
        </button>
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
                                type="url"
                                required
                                placeholder="https://example.com/target"
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
              <div ref={shopeeQueueRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-24">
                <div className="bg-slate-50/40 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                      Daftar Antrean Order Shopee Manual
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {filteredShopeeOrders.length} / {shopeeOrders.length} Pesanan
                  </span>
                </div>

                {/* Search & Sort Bar for Shopee Manual Orders */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white p-4 border-b border-slate-50">
                  <div className="relative w-full lg:w-80">
                    <input
                      type="text"
                      value={searchShopee}
                      onChange={(e) => setSearchShopee(e.target.value)}
                      placeholder="Cari pesanan, toko, pembeli..."
                      className="w-full bg-slate-50/50 text-xs text-slate-700 rounded-xl px-4 py-2.5 outline-none border border-slate-150 focus:border-slate-300 focus:bg-white font-sans transition-all shadow-sm"
                    />
                  </div>

                  {/* Minimalist sorting / filtering controls */}
                  <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                    {/* Status / Progres Filter (Minimalist badge/pills style) */}
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100 text-[10px]">
                      <span className="text-slate-450 font-bold uppercase tracking-wider px-2">Progres:</span>
                      {(['pending', 'progress', 'done'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSortShopee(opt)}
                          className={`px-3 py-1.5 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase text-[10px] ${
                            sortShopee === opt
                              ? 'bg-orange-50 text-orange-600 border border-orange-150/40 font-extrabold shadow-sm'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                          }`}
                        >
                          {opt === 'pending' ? 'Pending' : opt === 'progress' ? 'Progres' : 'Done'}
                        </button>
                      ))}
                    </div>

                    {/* Timeframe Filter (Minimalist badge/pills style) */}
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100 text-[10px]">
                      <span className="text-slate-450 font-bold uppercase tracking-wider px-2">Waktu:</span>
                      {(['all', 'week', 'month'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setTimeFilterShopee(opt)}
                          className={`px-3 py-1.5 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase text-[10px] ${
                            timeFilterShopee === opt
                              ? 'bg-blue-50 text-blue-600 border border-blue-150/40 font-extrabold shadow-sm'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                          }`}
                        >
                          {opt === 'all' ? 'Semua' : opt === 'week' ? 'Minggu' : 'Bulan'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
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
                        filteredShopeeOrders.map((order) => {
                          const isSosmed = order.order_type === 'REPORT_ALL_SOSMED';
                          return (
                            <tr key={order.id} className="hover:bg-slate-50/40 transition-colors">
                              {/* ID / Tipe */}
                              <td className="px-4 py-3 font-mono">
                                <span className="font-bold text-slate-900 block">{order.id}</span>
                                <div className="flex flex-col gap-1 mt-1">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md inline-block w-fit ${
                                    isSosmed 
                                      ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {isSosmed ? 'REPORT' : 'SPAM WA'}
                                  </span>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md inline-block w-fit border ${
                                    order.status === 'DONE'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : order.status === 'PROGRESS'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {order.status || 'PENDING'}
                                  </span>
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
                                {order.target_link.startsWith('http') ? (
                                  <a 
                                    href={order.target_link} 
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
                                <textarea
                                  rows={2}
                                  placeholder="Input work order..."
                                  value={order.work_order || ''}
                                  onChange={e => handleUpdateWorkOrder(order.id, e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-[10px] font-medium text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-sans resize-y min-h-[50px]"
                                />
                              </td>

                              {/* Assign Worker Select & Delete Action */}
                              <td className="px-4 py-3 text-center space-y-2">
                                <select
                                  value={order.worker_id || ''}
                                  onChange={e => handleAssignWorker(order.id, e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-orange-500 cursor-pointer"
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
                                  <button
                                    onClick={() => handleDeleteShopeeOrder(order.id)}
                                    className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors cursor-pointer"
                                    title="Hapus Order"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
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

          {/* TAB 2: MAPS REVIEWS PROGRESS TRACKER */}
          {activeTab === 'maps' && (
            <div className="space-y-8 fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* COLLAPSIBLE MAPS FORM CARD (4 columns) */}
                <div 
                  className={`lg:col-span-4 bg-white rounded-3xl border transition-all duration-400 h-fit ${
                    isMapsFormExpanded 
                      ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg' 
                      : 'border-slate-200 shadow-sm'
                  }`}
                  id="card-maps-review"
                >
                  {/* Card Header Section always visible */}
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black shrink-0">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900 leading-snug">
                          G MAPS, TRIPAD & REVIEW APPS
                        </h2>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setIsMapsFormExpanded(!isMapsFormExpanded)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        isMapsFormExpanded
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20'
                      }`}
                    >
                      {isMapsFormExpanded ? 'Hide' : 'Input Target Review'}
                    </button>
                  </div>

                  {/* Collapsible Form Panel */}
                  <AnimatePresence initial={false}>
                    {isMapsFormExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.25, 0.8, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div ref={mapsFormRef} className="p-5 border-t border-slate-100 bg-slate-50/30 space-y-4">
                          <form onSubmit={handleSubmitMaps} className="space-y-4">
                            {/* Tipe Review Selector Dropdown */}
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Tipe Review <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <select
                                  value={formMaps.reviewType}
                                  onChange={e => setFormMaps(prev => ({ ...prev, reviewType: e.target.value as 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' }))}
                                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans cursor-pointer appearance-none pr-8 font-black text-slate-700 uppercase tracking-wider"
                                >
                                  <option value="G_MAPS">G Maps (Google Maps)</option>
                                  <option value="TRIPAD">Tripadvisor (Tripad)</option>
                                  <option value="REVIEW_APPS">Review Apps</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Nama Client <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Contoh: Hotel Melati Indah"
                                value={formMaps.clientName}
                                onChange={e => setFormMaps(prev => ({ ...prev, clientName: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Nama Store <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Pilih atau ketik nama store..."
                                value={formMaps.storeName}
                                onChange={e => setFormMaps(prev => ({ ...prev, storeName: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans"
                              />
                              <div className="flex flex-wrap gap-1 mt-1">
                                {['KN', 'SPL', 'MP', 'PC', 'ADI', 'KYF', 'TWG', 'AC', 'GDM', 'VJ', 'LKS', 'ACS', 'NA', 'NRW', 'WNL'].map(st => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => setFormMaps(prev => ({ ...prev, storeName: st }))}
                                    className={`px-2 py-0.5 text-[9px] font-black rounded-lg transition-all ${
                                      formMaps.storeName === st
                                        ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                    } cursor-pointer`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Notes / Clue <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                required
                                placeholder="Contoh: ulasan harus bintang 5, foto tempat, clue ulasan positif"
                                value={formMaps.notes}
                                onChange={e => setFormMaps(prev => ({ ...prev, notes: e.target.value }))}
                                rows={2}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-sans resize-y"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {formMaps.reviewType === 'G_MAPS' 
                                  ? 'Link Maps' 
                                  : formMaps.reviewType === 'TRIPAD' 
                                  ? 'Link Tripadvisor' 
                                  : 'Link Target Apps'
                                } <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="url"
                                required
                                placeholder={
                                  formMaps.reviewType === 'G_MAPS' 
                                    ? 'https://maps.google.com/?cid=...' 
                                    : formMaps.reviewType === 'TRIPAD' 
                                    ? 'https://www.tripadvisor.com/...' 
                                    : 'https://play.google.com/store/apps/details?id=...'
                                }
                                value={formMaps.mapsLink}
                                onChange={e => setFormMaps(prev => ({ ...prev, mapsLink: e.target.value }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-mono"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Target Count <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                required
                                min={1}
                                placeholder="Jumlah ulasan target"
                                value={formMaps.targetCount}
                                onChange={e => setFormMaps(prev => ({ ...prev, targetCount: Math.max(1, Number(e.target.value)) }))}
                                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-mono"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white rounded-xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10"
                            >
                              <Plus className="h-4 w-4" />
                              <span>
                                {formMaps.reviewType === 'G_MAPS' 
                                  ? 'Buat Target Review Maps' 
                                  : formMaps.reviewType === 'TRIPAD' 
                                  ? 'Buat Target Review Tripadvisor' 
                                  : 'Buat Target Review Apps'
                                }
                              </span>
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                 {/* TABLE PROGRESS & LIST (8 columns) */}
                 <div ref={mapsQueueRef} className="lg:col-span-8 space-y-4 scroll-mt-24">
                   <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                     <div className="bg-slate-50/40 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                         <span className="h-2 w-2 rounded-full bg-blue-500" />
                         <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                           Progres Target Review (G Maps, Tripadvisor & Review Apps)
                         </h3>
                       </div>
                       <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                         {filteredMapsReviews.length} / {mapsReviews.length} Data
                       </span>
                     </div>
 
                     {/* Search & Sort Bar for Maps Reviews */}
                     <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white p-4 border-b border-slate-50">
                       <div className="relative w-full lg:w-80">
                         <input
                           type="text"
                           value={searchMaps}
                           onChange={(e) => setSearchMaps(e.target.value)}
                           placeholder="Cari toko, klien, tipe, clue..."
                           className="w-full bg-slate-50/50 text-xs text-slate-700 rounded-xl px-4 py-2.5 outline-none border border-slate-150 focus:border-slate-300 focus:bg-white font-sans transition-all shadow-sm"
                         />
                       </div>
 
                       {/* Minimalist sorting / filtering controls */}
                       <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-start lg:justify-end">
                         {/* Status / Progres Filter (Minimalist badge/pills style) */}
                         <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100 text-[10px]">
                           <span className="text-slate-450 font-bold uppercase tracking-wider px-2">Progres:</span>
                           {(['pending', 'progress', 'done'] as const).map((opt) => (
                             <button
                               key={opt}
                               type="button"
                               onClick={() => setSortMaps(opt)}
                               className={`px-3 py-1.5 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase text-[10px] ${
                                 sortMaps === opt
                                   ? 'bg-blue-50 text-blue-650 border border-blue-150/40 font-extrabold shadow-sm'
                                   : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                               }`}
                             >
                               {opt === 'pending' ? 'Pending' : opt === 'progress' ? 'Progres' : 'Done'}
                             </button>
                           ))}
                         </div>
 
                         {/* Timeframe Filter (Minimalist badge/pills style) */}
                         <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100 text-[10px]">
                           <span className="text-slate-450 font-bold uppercase tracking-wider px-2">Waktu:</span>
                           {(['all', 'week', 'month'] as const).map((opt) => (
                             <button
                               key={opt}
                               type="button"
                               onClick={() => setTimeFilterMaps(opt)}
                               className={`px-3 py-1.5 rounded-lg transition-all font-sans font-bold cursor-pointer uppercase text-[10px] ${
                                 timeFilterMaps === opt
                                   ? 'bg-blue-50 text-blue-650 border border-blue-150/40 font-extrabold shadow-sm'
                                   : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                               }`}
                             >
                               {opt === 'all' ? 'Semua' : opt === 'week' ? 'Minggu' : 'Bulan'}
                             </button>
                           ))}
                         </div>
                       </div>
                     </div>
 
                     <div className="overflow-x-auto">
                       <table className="w-full text-left border-collapse table-fixed">
                         <colgroup>
                           <col className="w-[14%]" />
                           <col className="w-[18%]" />
                           <col className="w-[14%]" />
                           <col className="w-[20%]" />
                           <col className="w-[14%]" />
                          <col className="w-[12%]" />
                          <col className="w-[10%]" />
                        </colgroup>
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                            <th className="px-3 py-3.5">Nama Store</th>
                            <th className="px-3 py-3.5">Client / Target Link</th>
                            <th className="px-3 py-3.5">Progres Target</th>
                            <th className="px-3 py-3.5">Input Progres Akun</th>
                            <th className="px-3 py-3.5">Clue</th>
                            <th className="px-3 py-3.5">Link Bukti</th>
                            <th className="px-3 py-3.5 text-center">Status / Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-sans">
                          {filteredMapsReviews.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-semibold font-sans">
                                {searchMaps ? 'Tidak ada hasil pencarian yang cocok.' : 'Belum ada data progres review dimasukkan.'}
                              </td>
                            </tr>
                          ) : (
                            filteredMapsReviews.map((item) => {
                              const doneCount = item.reviewer_accounts?.length || 0;
                              const pct = Math.min(100, Math.round((doneCount / item.target_count) * 100));
                              const isFinished = item.status === 'DONE';

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                                  {/* Nama Store (Static Readonly Badge as requested) */}
                                  <td className="px-3 py-3 font-sans font-extrabold text-slate-900">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 block text-center uppercase tracking-wider text-[11px] font-black">
                                      {item.store_name || '-'}
                                    </span>
                                  </td>

                                  {/* Client / Target Link */}
                                  <td className="px-3 py-3 font-sans">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      {item.review_type === 'TRIPAD' ? (
                                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Tripadvisor</span>
                                      ) : item.review_type === 'REVIEW_APPS' ? (
                                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">Review Apps</span>
                                      ) : (
                                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">G Maps</span>
                                      )}
                                    </div>
                                    <span className="font-bold text-slate-900 block truncate" title={item.client_name}>
                                      {item.client_name}
                                    </span>
                                    <a 
                                      href={item.maps_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-mono text-[10px] mt-1.5 truncate max-w-full font-semibold"
                                      title={item.maps_link}
                                    >
                                      {item.review_type === 'REVIEW_APPS' ? (
                                        <>
                                          <ExternalLink className="h-3 w-3 shrink-0 text-purple-500" />
                                          <span className="truncate">View Target Apps</span>
                                        </>
                                      ) : item.review_type === 'TRIPAD' ? (
                                        <>
                                          <ExternalLink className="h-3 w-3 shrink-0 text-emerald-500" />
                                          <span className="truncate">View Tripadvisor</span>
                                        </>
                                      ) : (
                                        <>
                                          <MapPin className="h-3 w-3 shrink-0 text-red-500" />
                                          <span className="truncate">View Google Maps</span>
                                        </>
                                      )}
                                    </a>
                                  </td>

                                  {/* Progres Target indicator with beautiful progress bar */}
                                  <td className="px-3 py-3">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1.5 font-mono">
                                      <span>{doneCount} / {item.target_count}</span>
                                      <span>{pct}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          isFinished ? 'bg-emerald-500' : 'bg-blue-600'
                                        }`} 
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </td>

                                  {/* Input Progres Akun - NEAT MINI-TABLE FOR REPORTING */}
                                  <td className="px-3 py-3 space-y-2">
                                    <div className="flex gap-1">
                                      <input
                                        type="text"
                                        placeholder="Nama Akun Reviewer"
                                        value={tempAccountInput[item.id] || ''}
                                        onChange={e => setTempAccountInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddReviewerAccount(item.id);
                                          }
                                        }}
                                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] outline-none focus:border-blue-500 flex-grow font-sans bg-white min-w-0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddReviewerAccount(item.id)}
                                        className="bg-blue-600 text-white rounded-lg p-1.5 hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    </div>

                                    {/* Efficient compact grid with 5 columns for reviewer accounts (stops excessive scrolling) */}
                                    {item.reviewer_accounts && item.reviewer_accounts.length > 0 ? (
                                      <div className="border border-slate-200 rounded-xl p-2 bg-white max-h-[140px] overflow-y-auto shadow-inner">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1">
                                          {item.reviewer_accounts.map((acc, index) => (
                                            <div key={index} className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[9px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                                              <span className="truncate font-mono" title={`${index + 1}. ${acc}`}>
                                                {index + 1}. {acc}
                                              </span>
                                              <button
                                                onClick={() => handleRemoveReviewerAccount(item.id, index)}
                                                className="text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 px-1 rounded transition-all cursor-pointer"
                                                title="Hapus Akun"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-slate-400 italic py-2 text-center bg-slate-50/60 border border-dashed border-slate-200 rounded-lg">
                                        Belum ada ulasan akun diinput
                                      </div>
                                    )}

                                    {item.reviewer_accounts && item.reviewer_accounts.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setScreenshotModalItem(item)}
                                        className="w-full mt-2 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                      >
                                        <FileDown className="h-3.5 w-3.5 text-blue-600 animate-bounce" />
                                        <span>Export PDF ({item.reviewer_accounts.length})</span>
                                      </button>
                                    )}
                                  </td>

                                  {/* Clue/Notes Column */}
                                  <td className="px-3 py-3">
                                    <textarea
                                      rows={2}
                                      placeholder="Input clue/notes..."
                                      value={item.notes || ''}
                                      onChange={e => handleUpdateNotes(item.id, e.target.value)}
                                      className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-sans resize-y min-h-[60px]"
                                    />
                                  </td>

                                  {/* Link Bukti Pengerjaan */}
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      placeholder="Link bukti pengerjaan..."
                                      value={item.proof_link || ''}
                                      onChange={e => handleUpdateProofLink(item.id, e.target.value)}
                                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-emerald-500 text-slate-700 font-mono bg-white"
                                    />
                                    {item.proof_link && (
                                      <a
                                        href={item.proof_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[9px] text-emerald-600 hover:underline font-mono inline-block mt-1.5 truncate max-w-full font-bold"
                                        title={item.proof_link}
                                      >
                                        Buka Bukti →
                                      </a>
                                    )}
                                  </td>

                                  {/* Status Badges & Action */}
                                  <td className="px-3 py-3 text-center space-y-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      isFinished
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : item.status === 'PROGRESS'
                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}>
                                      <span className={`h-1.5 w-1.5 rounded-full ${
                                        isFinished 
                                          ? 'bg-emerald-500' 
                                          : item.status === 'PROGRESS'
                                          ? 'bg-blue-500 animate-pulse'
                                          : 'bg-amber-500 animate-pulse'
                                      }`} />
                                      <span>{isFinished ? 'DONE' : item.status === 'PROGRESS' ? 'PROGRESS' : 'PENDING'}</span>
                                    </span>

                                    <button
                                      onClick={() => {
                                        const copypasta = `Link: ${item.maps_link}\nNama cust: ${item.client_name}\nNama st: ${item.store_name || '-'}\nclue: ${item.notes || '-'}`;
                                        navigator.clipboard.writeText(copypasta);
                                        setCopiedId(item.id);
                                        setTimeout(() => setCopiedId(null), 2000);
                                      }}
                                      className={`w-full mt-1.5 px-2 py-1.5 text-[9px] font-black rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
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

                                    <button
                                      onClick={() => handleDeleteMapsReview(item.id)}
                                      className="block mx-auto text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                      title="Hapus Target"
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
                  onClick={() => generateMapsReportPDF(screenshotModalItem)}
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
