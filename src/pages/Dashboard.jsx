import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Plane, Users, TrendingUp, Loader2, AlertCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { ViewModeContext } from '@/Layout';
import StatsCard from '@/components/ui/StatsCard';
import UpcomingTrips from '@/components/dashboard/UpcomingTrips';
import UpcomingPayments from '@/components/dashboard/UpcomingPayments';
import ActiveReminders from '@/components/dashboard/ActiveReminders';
import { parseLocalDate, formatDate } from '@/components/utils/dateHelpers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSpoofableUser } from '@/contexts/SpoofContext';

export default function Dashboard() {
  const { viewMode } = useContext(ViewModeContext);
  const { user: clerkUser } = useSpoofableUser();

  // Convert Clerk user to app user format
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    full_name: clerkUser.fullName || clerkUser.username,
    role: clerkUser.publicMetadata?.role || 'user',
    custom_role: clerkUser.publicMetadata?.custom_role
  } : null;

  const [selectedTrip, setSelectedTrip] = useState('all');
  const [showPendingCollection, setShowPendingCollection] = useState(false);

  // Time filter for the stat cards (defaults to the current month)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-11, or 'all' for the whole year

  const isAdmin = user?.role === 'admin' && viewMode === 'admin';

  const { data: allTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['trips', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return supabaseAPI.entities.Trip.list();
      return supabaseAPI.entities.Trip.filter({ created_by: user.email });
    },
    enabled: !!user
  });

  const { data: allSoldTrips = [], isLoading: soldLoading } = useQuery({
    queryKey: ['soldTrips', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return supabaseAPI.entities.SoldTrip.list();
      return supabaseAPI.entities.SoldTrip.filter({ created_by: user.email });
    },
    enabled: !!user
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return supabaseAPI.entities.Client.list();
      return supabaseAPI.entities.Client.filter({ created_by: user.email });
    },
    enabled: !!user
  });

  // Filter out deleted records
  const trips = allTrips.filter(t => !t.is_deleted);
  const soldTrips = allSoldTrips.filter(t => !t.is_deleted);
  const clients = allClients.filter(c => !c.is_deleted);

  const soldTripIds = soldTrips.map(t => t.id);
  const { data: allServices = [] } = useQuery({
    queryKey: ['services', soldTripIds],
    queryFn: async () => {
      if (soldTripIds.length === 0) return [];
      return supabaseAPI.entities.TripService.list();
    },
    enabled: soldTripIds.length > 0
  });

  // Filter services to only show user's trips
  const services = allServices.filter(service => 
    soldTripIds.includes(service.sold_trip_id)
  );

  const { data: allClientPayments = [] } = useQuery({
    queryKey: ['clientPayments'],
    queryFn: () => supabaseAPI.entities.ClientPayment.list(),
    enabled: !!user
  });

  const { data: allSupplierPayments = [] } = useQuery({
    queryKey: ['supplierPayments'],
    queryFn: () => supabaseAPI.entities.SupplierPayment.list(),
    enabled: !!user
  });

  // --- Time filter (year + month) applied to the 4 stat cards ---
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Selectable years come from the data itself (plus the current year)
  const availableYears = (() => {
    const years = new Set([now.getFullYear()]);
    [...soldTrips, ...trips, ...clients].forEach(r => {
      if (!r.created_date) return;
      const y = new Date(r.created_date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  })();

  const isInSelectedPeriod = (dateValue) => {
    if (!dateValue) return false;
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() !== selectedYear) return false;
    if (selectedMonth !== 'all' && d.getMonth() !== selectedMonth) return false;
    return true;
  };

  const periodLabel = selectedMonth === 'all'
    ? `Todo ${selectedYear}`
    : `${monthNames[selectedMonth]} ${selectedYear}`;

  const periodSoldTrips = soldTrips.filter(t => isInSelectedPeriod(t.created_date));
  const periodSales = periodSoldTrips.reduce((sum, trip) => sum + (trip.total_price || 0), 0);
  const periodCommission = periodSoldTrips.reduce((sum, trip) => sum + (trip.total_commission || 0), 0);
  const periodTripsCount = trips.filter(t => isInSelectedPeriod(t.created_date)).length;
  const periodClientsCount = clients.filter(c => isInSelectedPeriod(c.created_date)).length;

  // Clients with negative balance
  const myClientsWithNegativeBalance = soldTrips.map(trip => {
    const clientPayments = allClientPayments
      .filter(p => p.sold_trip_id === trip.id)
      .reduce((sum, p) => sum + (p.amount_usd_fixed || p.amount || 0), 0);

    const supplierPayments = allSupplierPayments
      .filter(p => p.sold_trip_id === trip.id)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const tripServices = services.filter(s => s.sold_trip_id === trip.id);
    const totalServices = tripServices.reduce((sum, s) => sum + (s.price || 0), 0);

    // Balance = totalServices - totalClientPaid (same as FinancialSummary "Por Cobrar")
    const rawBalance = totalServices - clientPayments;
    const balance = Math.abs(rawBalance) < 2 ? 0 : rawBalance;

    if (balance > 0) {
      return {
        ...trip,
        balance,
        clientPayments,
        supplierPayments,
        totalServices
      };
    }
    return null;
  }).filter(Boolean);

  // Net Commissions Post-Trip Control
  const today = new Date();
  const myFinishedTripsWithNetCommissions = soldTrips
    .filter(trip => {
      if (!trip.end_date) return false;
      const endDate = parseLocalDate(trip.end_date);
      return endDate && !isNaN(endDate.getTime()) && isPast(endDate);
    })
    .map(trip => {
      const totalPrice = trip.total_price || 0;
      const totalPaidByClient = trip.total_paid_by_client || 0;
      const clientBalance = totalPaidByClient - totalPrice;

      const tripServices = services.filter(s => s.sold_trip_id === trip.id);
      const supplierPaymentsForTrip = allSupplierPayments.filter(p => p.sold_trip_id === trip.id);

      const netCommissionsPending = tripServices.reduce((sum, service) => {
        const hasNetoPayment = supplierPaymentsForTrip.some(
          p => p.trip_service_id === service.id && p.payment_type === 'neto'
        );

        if (!service.paid_to_agent && hasNetoPayment) {
          return sum + ((service.commission || 0) * 0.5);
        }
        return sum;
      }, 0);

      if (netCommissionsPending > 0) {
        const status = clientBalance >= netCommissionsPending ? 'ready' : 'review';
        
        return {
          ...trip,
          clientBalance,
          netCommissionsPending,
          status
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'ready' ? -1 : 1;
      return new Date(b.end_date) - new Date(a.end_date);
    });

  const readyCount = myFinishedTripsWithNetCommissions.filter(t => t.status === 'ready').length;
  const reviewCount = myFinishedTripsWithNetCommissions.filter(t => t.status === 'review').length;

  // Account Balance Panel (similar to admin but filtered by user)
  const confirmedClientPayments = allClientPayments.filter(p => p.confirmed === true);
  const confirmedSupplierPayments = allSupplierPayments.filter(p => p.confirmed === true && p.method !== 'tarjeta_cliente');

  let filteredClientPaymentsForBalance = confirmedClientPayments;
  let filteredSupplierPaymentsForBalance = confirmedSupplierPayments;
  let selectedTripData = null;

  if (selectedTrip !== 'all') {
    filteredClientPaymentsForBalance = confirmedClientPayments.filter(p => p.sold_trip_id === selectedTrip);
    filteredSupplierPaymentsForBalance = confirmedSupplierPayments.filter(p => p.sold_trip_id === selectedTrip);
    selectedTripData = soldTrips.find(t => t.id === selectedTrip);
  } else {
    // Filter by user's trips only
    const userTripIds = soldTrips.map(t => t.id);
    filteredClientPaymentsForBalance = confirmedClientPayments.filter(p => userTripIds.includes(p.sold_trip_id));
    filteredSupplierPaymentsForBalance = confirmedSupplierPayments.filter(p => userTripIds.includes(p.sold_trip_id));
  }

  const totalIncome = filteredClientPaymentsForBalance.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalExpenses = filteredSupplierPaymentsForBalance.reduce((sum, p) => sum + (p.amount || 0), 0);
  const accountBalance = totalIncome - totalExpenses;

  const tripsForSelector = soldTrips
    .filter(t => t.client_name)
    .map(t => ({
      id: t.id,
      label: `${t.client_name} - ${t.destination}`,
      client: t.client_name,
      destination: t.destination
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const isLoading = tripsLoading || soldLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#AEAEB2' }}>Vista general de tu actividad</p>
        </div>

        {/* Period filter (year + month) */}
        <div className="flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(v === 'all' ? 'all' : Number(v))}>
            <SelectTrigger className="w-36 h-9 text-xs rounded-xl" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el año</SelectItem>
              {monthNames.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24 h-9 text-xs rounded-xl" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Ventas" value={`$${periodSales.toLocaleString()}`} subtitle={periodLabel} icon={DollarSign} />
        <StatsCard title="Comisiones" value={`$${periodCommission.toLocaleString()}`} subtitle={periodLabel} icon={TrendingUp} />
        <StatsCard title="Viajes" value={periodTripsCount} subtitle={periodLabel} icon={Plane} />
        <StatsCard title="Clientes" value={periodClientsCount} subtitle={periodLabel} icon={Users} />
      </div>

      {/* Account Balance Panel */}
      <div className="bg-white rounded-2xl overflow-hidden"
           style={{ border: '1px solid rgba(0,0,0,0.055)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #2D4629, #C9A84C)' }} />
        <div className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-5">
            {/* Balance info */}
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide mb-1"
                 style={{ color: '#AEAEB2', letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif' }}>
                Mi Saldo en Cuenta
              </p>
              <p className="text-xs mb-2" style={{ color: '#AEAEB2' }}>
                Efectivo neto que pasó por tu cuenta. No incluye lo que el cliente pagó directo al proveedor con su tarjeta.
              </p>
              {selectedTrip !== 'all' && selectedTripData && (
                <p className="text-xs mb-2" style={{ color: '#6B6B6F' }}>
                  {selectedTripData.client_name} — {selectedTripData.destination}
                </p>
              )}
              <p className="text-4xl font-bold mb-4"
                 style={{ color: '#1C1C1E', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' }}>
                ${accountBalance.toLocaleString()}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.12)' }}>
                  <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: '#16A34A', letterSpacing: '0.06em' }}>Cobrado en tu cuenta</p>
                  <p className="text-lg font-bold" style={{ color: '#1C1C1E', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
                    ${totalIncome.toLocaleString()}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{filteredClientPaymentsForBalance.length} pagos</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.1)' }}>
                  <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: '#DC2626', letterSpacing: '0.06em' }}>Pagado a proveedores</p>
                  <p className="text-lg font-bold" style={{ color: '#1C1C1E', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
                    ${totalExpenses.toLocaleString()}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{filteredSupplierPaymentsForBalance.length} pagos</p>
                </div>
              </div>
            </div>
            {/* Trip selector */}
            <div className="lg:w-64">
              <p className="text-xs font-medium mb-1.5" style={{ color: '#6B6B6F' }}>Filtrar por viaje</p>
              <Select value={selectedTrip} onValueChange={setSelectedTrip}>
                <SelectTrigger className="w-full h-9 text-xs rounded-xl" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                  <SelectValue placeholder="Todos mis viajes" />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  <SelectItem value="all">Todos mis viajes</SelectItem>
                  {tripsForSelector.map(trip => (
                    <SelectItem key={trip.id} value={trip.id}>{trip.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTrip !== 'all' && (
                <>
                  <p className="text-xs mt-1.5" style={{ color: '#AEAEB2' }}>Solo pagos confirmados de este viaje</p>
                  <Link
                    to={createPageUrl(`SoldTripDetail?id=${selectedTrip}`)}
                    className="mt-2 inline-flex items-center justify-center gap-1.5 w-full h-9 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: '#2D4629' }}
                  >
                    Ir al viaje
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Payment detail rows when trip selected */}
          {selectedTrip !== 'all' && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.055)' }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.055)', background: '#FAFAFA' }}>
                  <DollarSign className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                  <p className="text-xs font-semibold" style={{ color: '#1C1C1E' }}>Pagos del Cliente</p>
                </div>
                <div className="divide-y max-h-52 overflow-y-auto" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  {filteredClientPaymentsForBalance.length > 0
                    ? [...filteredClientPaymentsForBalance].sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => (
                        <div key={p.id} className="px-4 py-2.5 flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#16A34A' }}>${(p.amount || 0).toLocaleString()}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{formatDate(p.date, 'd MMM yyyy', { locale: es })}</p>
                            {p.method && <p className="text-xs capitalize" style={{ color: '#6B6B6F' }}>{p.method}</p>}
                          </div>
                          {p.notes && <p className="text-xs max-w-[140px] text-right" style={{ color: '#AEAEB2' }}>{p.notes}</p>}
                        </div>
                      ))
                    : <p className="px-4 py-3 text-xs" style={{ color: '#AEAEB2' }}>Sin pagos registrados</p>}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.055)' }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.055)', background: '#FAFAFA' }}>
                  <DollarSign className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
                  <p className="text-xs font-semibold" style={{ color: '#1C1C1E' }}>Pagos a Proveedores</p>
                </div>
                <div className="divide-y max-h-52 overflow-y-auto" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  {filteredSupplierPaymentsForBalance.length > 0
                    ? [...filteredSupplierPaymentsForBalance].sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => (
                        <div key={p.id} className="px-4 py-2.5 flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>${(p.amount || 0).toLocaleString()}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{formatDate(p.date, 'd MMM yyyy', { locale: es })}</p>
                            {p.supplier && <p className="text-xs" style={{ color: '#6B6B6F' }}>{p.supplier}</p>}
                          </div>
                          {p.notes && <p className="text-xs max-w-[140px] text-right" style={{ color: '#AEAEB2' }}>{p.notes}</p>}
                        </div>
                      ))
                    : <p className="px-4 py-3 text-xs" style={{ color: '#AEAEB2' }}>Sin pagos registrados</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pending Collection Alert */}
      {myClientsWithNegativeBalance.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden"
             style={{ border: '1px solid rgba(220,38,38,0.18)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <button
            onClick={() => setShowPendingCollection(!showPendingCollection)}
            className="w-full px-5 py-3.5 flex items-center justify-between transition-colors"
            style={{ background: showPendingCollection ? 'rgba(220,38,38,0.05)' : 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = showPendingCollection ? 'rgba(220,38,38,0.05)' : 'transparent'; }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <AlertCircle className="w-4 h-4" style={{ color: '#DC2626' }} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold" style={{ color: '#1C1C1E' }}>Clientes con Saldo Por Cobrar</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                        style={{ background: '#DC2626' }}>
                    {myClientsWithNegativeBalance.length}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#AEAEB2' }}>
                  {myClientsWithNegativeBalance.length === 1 ? 'viaje tiene' : 'viajes tienen'} pagos pendientes de cobro
                </p>
              </div>
            </div>
            {showPendingCollection
              ? <ChevronUp className="w-4 h-4 flex-shrink-0 ml-3" style={{ color: '#DC2626' }} />
              : <ChevronDown className="w-4 h-4 flex-shrink-0 ml-3" style={{ color: '#AEAEB2' }} />}
          </button>
          {showPendingCollection && (
            <div className="px-5 pb-5">
              <div className="space-y-2">
                {myClientsWithNegativeBalance.map(trip => (
                  <div key={trip.id} className="rounded-xl p-3"
                       style={{ background: '#FAFAFA', border: '1px solid rgba(220,38,38,0.1)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#1C1C1E' }}>{trip.client_name || 'Sin cliente'}</p>
                        <p className="text-xs truncate mb-1" style={{ color: '#AEAEB2' }}>{trip.destination}</p>
                        <div className="flex gap-3 text-xs">
                          <span style={{ color: '#1D4ED8' }}>Total: ${(trip.total_price || 0).toLocaleString()}</span>
                          <span style={{ color: '#16A34A' }}>Recibido: ${trip.clientPayments.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-bold" style={{ color: '#DC2626' }}>${trip.balance.toLocaleString()}</p>
                        <p className="text-xs" style={{ color: '#AEAEB2' }}>por cobrar</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
        <ActiveReminders userEmail={user?.email} isAdmin={isAdmin} />
        <UpcomingTrips soldTrips={soldTrips} />
        <div className="lg:col-span-2">
          <UpcomingPayments services={services} soldTrips={soldTrips} />
        </div>
      </div>
    </div>
  );
}