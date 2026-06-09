import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import {
  LayoutDashboard, Users, Plane, CheckCircle, Menu, X, MapPin,
  DollarSign, Loader2, Building2, BarChart3, BookOpen, Key, Wallet,
  Lock, Eye, ShieldCheck, Upload, CreditCard, ChevronLeft, ChevronRight,
  Database, Search, UserCheck, ListChecks
} from 'lucide-react';
import QuickPaymentFAB from '@/components/ui/QuickPaymentFAB';
import PaymentInfoModal from '@/components/ui/PaymentInfoModal';
import CommissionInfoModal from '@/components/ui/CommissionInfoModal';
import CheatSheetBar from '@/components/ui/CheatSheetBar';
import ErrorReportButton from '@/components/ui/ErrorReportButton';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { useUser, useClerk, UserButton } from '@clerk/clerk-react';
import { isAdminEmail } from '@/config/adminEmails';
import { useSpoof } from '@/contexts/SpoofContext';

export const ViewModeContext = createContext({ viewMode: 'admin', isActualAdmin: false });

const EXCHANGE_RATE_CACHE_KEY = 'exchange_rate_cache';
const CACHE_DURATION = 15 * 60 * 1000;

const SidebarNavItem = memo(({ item, isActive, collapsed, onClick }) => (
  <Link
    to={createPageUrl(item.page)}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 transition-all duration-200 group relative rounded-lg px-3 py-2.5",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
      collapsed ? "lg:justify-center lg:px-0 lg:py-3" : "",
      isActive
        ? "bg-white/15 text-white"
        : "text-white/55 hover:text-white/90 hover:bg-white/8"
    )}
  >
    {/* Gold left bar for active */}
    {isActive && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
           style={{ background: 'var(--luxury-gold)' }} />
    )}

    <item.icon className={cn(
      "w-4 h-4 transition-all duration-200 flex-shrink-0",
      isActive ? "text-white" : "text-white/50 group-hover:text-white/80"
    )} />

    {!collapsed && (
      <span className={cn(
        "text-sm tracking-wide truncate transition-all duration-200",
        isActive ? "font-medium text-white" : "font-normal"
      )}>
        {item.name}
      </span>
    )}
  </Link>
));

SidebarNavItem.displayName = 'SidebarNavItem';

const NavDivider = memo(({ text, collapsed }) => {
  if (collapsed) return <div className="hidden lg:block h-px mx-3 my-3 bg-white/10" />;
  return (
    <div className="px-3 pt-5 pb-1">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-white/30">{text}</p>
    </div>
  );
});

NavDivider.displayName = 'NavDivider';

const ExchangeRateWidget = memo(({ collapsed, onPaymentInfoClick, onCommissionInfoClick }) => {
  const [exchangeRate, setExchangeRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(true);

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const cached = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setExchangeRate(data);
            setRateLoading(false);
            return;
          }
        }
      } catch (e) {}

      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: "¿Cuál es el tipo de cambio de VENTA de dólares USD a pesos mexicanos MXN de BBVA México hoy? Solo responde con el número del tipo de cambio de venta, nada más.",
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              sell_rate: { type: "number" },
              date: { type: "string" }
            }
          }
        });
        setExchangeRate(result);
        try {
          localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
        } catch (e) {}
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
      } finally {
        setRateLoading(false);
      }
    };
    fetchExchangeRate();
  }, []);

  if (collapsed) return null;

  return (
    <div className="mt-5 space-y-1.5">
      {/* Rate */}
      <div className="rounded-lg px-3 py-2.5 flex items-center justify-between"
           style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-xs text-white/40 tracking-wide">USD / MXN</span>
        {rateLoading ? (
          <div className="h-4 w-14 bg-white/10 rounded animate-pulse" />
        ) : exchangeRate?.sell_rate ? (
          <span className="text-sm font-semibold text-white">${exchangeRate.sell_rate.toFixed(2)}</span>
        ) : (
          <span className="text-xs text-white/30">—</span>
        )}
      </div>

      <button
        onClick={onPaymentInfoClick}
        className="w-full text-left text-xs py-2 px-3 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/6 transition-all duration-150 flex items-center justify-between group"
      >
        <span>Info de Pagos</span>
        <Wallet className="w-3 h-3 opacity-40 group-hover:opacity-70" />
      </button>

      <button
        onClick={onCommissionInfoClick}
        className="w-full text-left text-xs py-2 px-3 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/6 transition-all duration-150 flex items-center justify-between group"
      >
        <span>Info Comisiones</span>
        <CreditCard className="w-3 h-3 opacity-40 group-hover:opacity-70" />
      </button>
    </div>
  );
});

ExchangeRateWidget.displayName = 'ExchangeRateWidget';

export default function Layout({ children, currentPageName }) {
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const { spoofedUser, isSpoofing, stopSpoof } = useSpoof();

  const realAppUser = useMemo(() => user ? {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    full_name: user.fullName || user.username,
    role: user.publicMetadata?.role || 'user',
    custom_role: user.publicMetadata?.custom_role
  } : null, [user]);

  const appUser = useMemo(() => {
    if (isSpoofing && spoofedUser) {
      return { id: spoofedUser.id, email: spoofedUser.email, full_name: spoofedUser.full_name, role: 'user', custom_role: null };
    }
    return realAppUser;
  }, [isSpoofing, spoofedUser, realAppUser]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebar_collapsed')) || false; } catch { return false; }
  });
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  const [commissionInfoOpen, setCommissionInfoOpen] = useState(false);
  const [viewMode, setViewMode] = useState('admin');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', JSON.stringify(sidebarCollapsed)); } catch (e) {}
  }, [sidebarCollapsed]);

  const isActualAdmin = useMemo(() => isAdminEmail(realAppUser?.email), [realAppUser?.email]);
  const isSupervisor = useMemo(() => appUser?.custom_role === 'supervisor', [appUser?.custom_role]);
  const isAdmin = isSpoofing ? false : (isActualAdmin && viewMode === 'admin');

  const adminNavigation = useMemo(() => [
    { name: 'Dashboard Global', page: 'AdminDashboard', icon: LayoutDashboard },
    { name: 'Todos los Clientes', page: 'AdminClients', icon: Users },
    { name: 'Todos los Viajes', page: 'AdminTrips', icon: Plane },
    { name: 'Viajes Vendidos', page: 'AdminSoldTrips', icon: CheckCircle },
    { name: 'Progreso de Agentes', page: 'Statistics', icon: BarChart3 },
    { name: 'Comisiones Internas', page: 'InternalCommissions', icon: Wallet },
    { name: 'Pagos Internos de Proveedores', page: 'InternalPayments', icon: DollarSign },
    { name: 'Pagos Internos Clientes', page: 'InternalClientPayments', icon: CreditCard },
    { name: 'Proveedores', page: 'Suppliers', icon: Building2 },
    { name: 'Learning & Reviews', page: 'Reviews', icon: BookOpen },
    { name: 'Contraseñas', page: 'Credentials', icon: Key },
    { name: 'Control Interno', divider: true },
    { name: 'Asistencia', page: 'Attendance', icon: Users },
    { name: 'FAM Trips', page: 'FamTrips', icon: Plane },
    { name: 'Ferias', page: 'IndustryFairs', icon: LayoutDashboard },
    { name: 'Herramientas Admin', divider: true },
    { name: 'Spoof de Usuarios', page: 'AdminSpoof', icon: UserCheck },
    { name: 'Opciones de Servicios', page: 'AdminServiceOptions', icon: ListChecks },
    { name: 'Exportar Datos', page: 'AdminExport', icon: Database },
  ], []);

  const userNavigation = useMemo(() => [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
    { name: 'Clientes', page: 'Clients', icon: Users },
    { name: 'Cotizaciones', page: 'Trips', icon: Plane },
    { name: 'Viajes Vendidos', page: 'SoldTrips', icon: CheckCircle },
    { name: 'Comisiones', page: 'Commissions', icon: DollarSign },
    { name: 'Mi Progreso', page: 'Statistics', icon: BarChart3 },
    { name: 'Proveedores', page: 'Suppliers', icon: Building2 },
    { name: 'Learning & Reviews', page: 'Reviews', icon: BookOpen },
    { name: 'Contraseñas', page: 'Credentials', icon: Key },
    { name: 'Mis Contraseñas', page: 'PersonalCredentials', icon: Lock },
    ...(isSupervisor ? [
      { name: 'Control Interno', divider: true },
      { name: 'Asistencia', page: 'Attendance', icon: Users },
      { name: 'FAM Trips', page: 'FamTrips', icon: Plane },
      { name: 'Ferias', page: 'IndustryFairs', icon: LayoutDashboard },
    ] : [])
  ], [isSupervisor]);

  const navigation = useMemo(() => isAdmin ? adminNavigation : userNavigation, [isAdmin, adminNavigation, userNavigation]);

  const filteredNavigation = useMemo(() => {
    if (!searchQuery.trim()) return navigation;
    const q = searchQuery.toLowerCase();
    return navigation.filter(item => !item.divider && item.name.toLowerCase().includes(q));
  }, [navigation, searchQuery]);

  const handleSidebarClose = useCallback(() => setSidebarOpen(false), []);
  const handleSidebarToggle = useCallback(() => setSidebarOpen(p => !p), []);
  const handleCollapsedToggle = useCallback(() => setSidebarCollapsed(p => !p), []);
  const handlePaymentInfoOpen = useCallback(() => setPaymentInfoOpen(true), []);
  const handlePaymentInfoClose = useCallback(() => setPaymentInfoOpen(false), []);
  const handleCommissionInfoOpen = useCallback(() => setCommissionInfoOpen(true), []);
  const handleCommissionInfoClose = useCallback(() => setCommissionInfoOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); handleCollapsedToggle(); }
      if (e.key === 'Escape' && sidebarOpen) handleSidebarClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, handleCollapsedToggle, handleSidebarClose]);

  return (
    <div className="min-h-screen" style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: '#F8F8FA'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        h1, h2, h3, .heading-serif {
          font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
          letter-spacing: -0.01em;
        }

        h4, h5, h6 {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        p, span, label, input, button, td, th {
          font-family: 'Inter', sans-serif;
        }

        :root {
          --nomad-green: #2D4629;
          --nomad-green-light: #3F5E39;
          --nomad-green-medium: #243A20;
          --nomad-green-dark: #1A2E17;
          --nomad-green-glow: rgba(45, 70, 41, 0.2);
          --luxury-gold: #C9A84C;
          --luxury-gold-light: #DFC078;
          --luxury-gold-muted: rgba(201, 168, 76, 0.15);
          --page-bg: #F8F8FA;
          --card-bg: #FFFFFF;
          --border-subtle: rgba(0, 0, 0, 0.06);
          --text-primary: #1C1C1E;
          --text-secondary: #6B6B6F;
          --text-tertiary: #AEAEB2;
        }

        /* Scrollbar */
        .scrollbar-thin::-webkit-scrollbar { width: 3px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }

        /* Sidebar */
        .sidebar-bg {
          background: linear-gradient(180deg, #2D4629 0%, #1F3320 60%, #1A2E1B 100%);
        }

        /* Cards */
        .lux-card {
          background: #FFFFFF;
          border: 1px solid rgba(0,0,0,0.055);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
        }

        .lux-card-hover:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05);
          transform: translateY(-1px);
          transition: all 0.2s ease;
        }

        /* Gold accent */
        .gold-rule {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--luxury-gold), transparent);
          opacity: 0.4;
        }

        /* Mobile header */
        .mobile-header {
          background: rgba(248, 248, 250, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        /* Shimmer for active nav item */
        @keyframes gold-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .gold-pulse { animation: gold-pulse 2.5s ease-in-out infinite; }

        /* Page heading overrides */
        .page-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        /* Table refinements */
        table { border-collapse: collapse; }
        thead th {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }

        /* Input focus */
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: rgba(45, 70, 41, 0.4) !important;
          box-shadow: 0 0 0 3px rgba(45, 70, 41, 0.08) !important;
        }

        /* Badge base tweak */
        .badge-lux {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
          padding: 2px 8px;
          border-radius: 6px;
        }
      `}</style>

      {/* ── Mobile Header ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 mobile-header px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #2D4629 0%, #1A2E17 100%)' }}>
              <MapPin className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}>
                Nomad Travel
              </h1>
              <p className="text-xs" style={{ color: 'var(--luxury-gold)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}>
                Luxury Travel CRM
              </p>
            </div>
          </div>
          <button
            onClick={handleSidebarToggle}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={handleSidebarClose} />
      )}

      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full flex flex-col sidebar-bg transition-all duration-300 ease-out",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        sidebarCollapsed ? "lg:w-[72px]" : "lg:w-72",
        "w-72"
      )}
      style={{ boxShadow: '4px 0 32px rgba(0,0,0,0.18)' }}>

        {/* Logo */}
        <div className={cn(
          "flex-shrink-0 transition-all duration-300",
          sidebarCollapsed ? "lg:py-5 lg:px-3 lg:flex lg:justify-center" : "px-5 pt-7 pb-5"
        )}>
          {sidebarCollapsed ? (
            <div className="hidden lg:flex w-10 h-10 rounded-xl items-center justify-center"
                 style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <span style={{ fontFamily: 'Playfair Display, serif', color: 'var(--luxury-gold)', fontSize: 18, fontWeight: 600 }}>N</span>
            </div>
          ) : (
            <div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                Nomad Travel
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '0.1em', color: 'var(--luxury-gold)', marginTop: 4, textTransform: 'uppercase' }}>
                Luxury Travel CRM
              </p>
              <div className="gold-rule mt-4" />
            </div>
          )}
        </div>

        {/* Admin switch */}
        {isActualAdmin && !sidebarCollapsed && !isSpoofing && (
          <div className="flex-shrink-0 px-5 mb-3">
            <div className="rounded-lg px-3 py-2.5 flex items-center justify-between"
                 style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                {viewMode === 'admin'
                  ? <ShieldCheck className="w-3.5 h-3.5 text-white/60" />
                  : <Eye className="w-3.5 h-3.5 text-white/60" />
                }
                <div>
                  <p className="text-xs font-medium text-white/80">{viewMode === 'admin' ? 'Admin' : 'Usuario'}</p>
                  <p className="text-[10px] text-white/35">{viewMode === 'admin' ? 'Todos los datos' : 'Solo tus datos'}</p>
                </div>
              </div>
              <Switch
                checked={viewMode === 'admin'}
                onCheckedChange={(c) => setViewMode(c ? 'admin' : 'user')}
              />
            </div>
          </div>
        )}

        {/* Exchange rate + quick links */}
        {!sidebarCollapsed && (
          <div className="flex-shrink-0 px-5">
            <ExchangeRateWidget
              collapsed={false}
              onPaymentInfoClick={handlePaymentInfoOpen}
              onCommissionInfoClick={handleCommissionInfoOpen}
            />
          </div>
        )}

        {/* Search */}
        {!sidebarCollapsed && (
          <div className="flex-shrink-0 px-5 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 rounded-lg transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className={cn(
          "flex-1 overflow-y-auto scrollbar-thin mt-3",
          sidebarCollapsed ? "px-2" : "px-4"
        )}>
          <div className="space-y-0.5 pb-4">
            {(searchQuery ? filteredNavigation : navigation).map((item, idx) => {
              if (item.divider) return <NavDivider key={idx} text={item.name} collapsed={sidebarCollapsed} />;
              return (
                <SidebarNavItem
                  key={item.page}
                  item={item}
                  isActive={currentPageName === item.page}
                  collapsed={sidebarCollapsed}
                  onClick={handleSidebarClose}
                />
              );
            })}
            {searchQuery && filteredNavigation.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-white/25">Sin resultados</p>
              </div>
            )}
          </div>
        </nav>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={handleCollapsedToggle}
          className="hidden lg:flex flex-shrink-0 items-center justify-center w-full py-3 transition-colors"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
          title={`${sidebarCollapsed ? 'Expandir' : 'Colapsar'} (Ctrl+B)`}
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />
          }
        </button>

        {/* User footer */}
        <div className={cn(
          "flex-shrink-0 transition-all duration-300",
          sidebarCollapsed ? "lg:py-4 lg:flex lg:justify-center" : "px-5 py-4"
        )}
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {sidebarCollapsed ? (
            <div className="hidden lg:flex justify-center group relative">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
              <div className="absolute left-full ml-3 bottom-0 z-[100] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-stone-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  {appUser?.full_name || 'Usuario'}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-stone-900" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/85 truncate leading-tight">{appUser?.full_name || 'Usuario'}</p>
                <p className="text-xs text-white/35 truncate mt-0.5">{appUser?.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className={cn(
        "pt-16 lg:pt-0 min-h-screen transition-all duration-300",
        sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-72"
      )}>
        {/* Spoof banner */}
        {isSpoofing && spoofedUser && (
          <div className="sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between"
               style={{ background: '#B91C1C' }}>
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-white/80" />
              <p className="text-sm text-white">
                Viendo como <span className="font-semibold">{spoofedUser.full_name}</span>
                <span className="text-white/60 ml-1">({spoofedUser.email})</span>
              </p>
            </div>
            <button
              onClick={stopSpoof}
              className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Salir
            </button>
          </div>
        )}

        <div className="p-5 lg:p-8">
          <ViewModeContext.Provider value={{
            viewMode: isSpoofing ? 'user' : (isActualAdmin ? viewMode : 'user'),
            isActualAdmin: isSpoofing ? false : isActualAdmin
          }}>
            {children}
          </ViewModeContext.Provider>
        </div>
      </main>

      <CheatSheetBar />
      <QuickPaymentFAB />
      <ErrorReportButton />
      <PaymentInfoModal open={paymentInfoOpen} onClose={handlePaymentInfoClose} />
      <CommissionInfoModal open={commissionInfoOpen} onClose={handleCommissionInfoClose} />
    </div>
  );
}
