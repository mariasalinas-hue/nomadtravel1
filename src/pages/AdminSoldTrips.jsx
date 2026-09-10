import React, { useState, useMemo, memo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";
import { CheckCircle, Search, Eye, Loader2, TrendingUp, DollarSign, Filter, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from '@/components/ui/EmptyState';
import { es } from 'date-fns/locale';
import { formatDate } from '@/components/utils/dateHelpers';

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  pagado: { label: 'Pagado', color: 'bg-green-100 text-green-700 border-green-200' },
  completado: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
};

// Skeleton Loading Component
const TableSkeleton = memo(() => (
  <div className="space-y-3 p-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex gap-4 animate-pulse">
        <div className="h-12 bg-stone-200 rounded flex-1"></div>
        <div className="h-12 bg-stone-200 rounded w-32"></div>
        <div className="h-12 bg-stone-200 rounded w-24"></div>
      </div>
    ))}
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

// Stats Card Component
const StatsCard = memo(({ title, value, icon: Icon, color = "emerald" }) => {
  const colorClasses = {
    emerald: "from-emerald-500 to-teal-600",
    green: "from-green-500 to-emerald-600",
  };

  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
      <div className="p-4 md:p-5 relative">
        <div className="flex items-center justify-between mb-2">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <div>
          <p className="text-xs md:text-sm text-stone-500 font-medium mb-1">{title}</p>
          <p className="text-xl md:text-2xl font-bold text-stone-900">{value}</p>
        </div>
      </div>
    </Card>
  );
});

StatsCard.displayName = 'StatsCard';

export default function AdminSoldTrips() {
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => supabaseAPI.entities.User.list()
  });

  const { data: allSoldTrips = [], isLoading } = useQuery({
    queryKey: ['soldTrips'],
    queryFn: () => supabaseAPI.entities.SoldTrip.list(),
    refetchOnWindowFocus: true
  });

  const agents = useMemo(
    () => allUsers.filter(u => u.role === 'user' || u.role === 'admin' || u.custom_role === 'supervisor'),
    [allUsers]
  );

  const updateSoldTripAgent = useMutation({
    mutationFn: ({ tripId, newAgentEmail }) =>
      supabaseAPI.entities.SoldTrip.update(tripId, { created_by: newAgentEmail }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldTrips'] });
      toast.success('Viaje reasignado correctamente');
    },
    onError: () => {
      toast.error('Error al reasignar el viaje');
    }
  });

  const filteredSoldTrips = useMemo(() =>
    allSoldTrips
      .filter(t => {
        if (selectedAgent === 'all') return true;
        if (selectedAgent === '__unassigned__') return !t.created_by;
        return t.created_by === selectedAgent;
      })
      .filter(t => selectedStatus === 'all' || t.status === selectedStatus)
      .filter(t => {
        const searchLower = search.toLowerCase();
        return (
          t.client_name?.toLowerCase().includes(searchLower) ||
          t.destination?.toLowerCase().includes(searchLower) ||
          t.trip_name?.toLowerCase().includes(searchLower) ||
          t.file_number?.toLowerCase().includes(searchLower)
        );
      }),
    [allSoldTrips, selectedAgent, selectedStatus, search]
  );

  const { totalSales, totalCommissions } = useMemo(() => ({
    totalSales: filteredSoldTrips.reduce((sum, t) => sum + (t.total_price || 0), 0),
    totalCommissions: filteredSoldTrips.reduce((sum, t) => sum + (t.total_commission || 0), 0)
  }), [filteredSoldTrips]);

  const hasActiveFilters = selectedAgent !== 'all' || selectedStatus !== 'all' || search !== '';

  const clearFilters = () => {
    setSelectedAgent('all');
    setSelectedStatus('all');
    setSearch('');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-stone-200 rounded-lg w-64 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="h-24 bg-stone-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-stone-200 rounded-xl animate-pulse"></div>
        </div>
        <div className="bg-white rounded-xl overflow-hidden">
          <TableSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-stone-800">
            Todos los Viajes Vendidos
          </h1>
          <p className="text-sm md:text-base text-stone-500 mt-1">
            {filteredSoldTrips.length} viaje{filteredSoldTrips.length !== 1 ? 's' : ''} vendido{filteredSoldTrips.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' (filtrados)'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-initial sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Buscar por cliente o destino..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Todos los agentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              <SelectItem value="__unassigned__">⚠️ Sin asignar</SelectItem>
              {agents.map(agent => (
                <SelectItem key={agent.email} value={agent.email}>
                  {agent.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="w-full sm:w-auto"
            >
              <X className="w-4 h-4 mr-2" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <StatsCard
          title="Total en Ventas"
          value={`$${totalSales.toLocaleString()}`}
          icon={DollarSign}
          color="emerald"
        />
        <StatsCard
          title="Total en Comisiones"
          value={`$${totalCommissions.toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Cliente</th>
                <th className="text-left p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Destino</th>
                <th className="text-left p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Fecha</th>
                <th className="text-right p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Total</th>
                <th className="text-right p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Comisión</th>
                <th className="text-left p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Estado</th>
                <th className="text-left p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Agente</th>
                <th className="text-center p-4 font-semibold text-stone-700 text-xs uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredSoldTrips.map((trip) => {
                const agent = allUsers.find(u => u.email === trip.created_by);
                const statusConfig = STATUS_CONFIG[trip.status];
                return (
                  <tr key={trip.id} className="hover:bg-stone-50 transition-colors group">
                    <td className="p-4">
                      <div>
                        <span className="font-semibold text-stone-900">{trip.client_name}</span>
                        {trip.trip_name && (
                          <p className="text-xs text-stone-500 mt-0.5 truncate max-w-[180px]">{trip.trip_name}</p>
                        )}
                        {trip.file_number && (
                          <span className="text-xs font-mono bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded border border-stone-200 mt-1 inline-block">
                            {trip.file_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-stone-600">{trip.destination}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-stone-600 text-sm">
                        {formatDate(trip.start_date, 'd MMM yy', { locale: es })}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-semibold text-stone-900">
                        ${(trip.total_price || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-semibold text-green-600">
                        ${(trip.total_commission || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={`${statusConfig?.color} border`}>
                        {statusConfig?.label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Select
                        value={trip.created_by || ''}
                        onValueChange={(value) => updateSoldTripAgent.mutate({
                          tripId: trip.id,
                          newAgentEmail: value === '' ? null : value
                        })}
                      >
                        <SelectTrigger className="w-[180px] text-sm">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Sin asignar</SelectItem>
                          {agents.map(agentOption => (
                            <SelectItem key={agentOption.email} value={agentOption.email}>
                              {agentOption.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(createPageUrl(`SoldTripDetail?id=${trip.id}`))}
                        className="hover:bg-stone-100"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSoldTrips.length === 0 && (
          <EmptyState
            icon={CheckCircle}
            title="No hay viajes vendidos"
            description="No se encontraron viajes con los filtros seleccionados"
          />
        )}
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {filteredSoldTrips.length > 0 ? (
          filteredSoldTrips.map((trip) => {
            const agent = allUsers.find(u => u.email === trip.created_by);
            const statusConfig = STATUS_CONFIG[trip.status];
            return (
              <Card key={trip.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-stone-900 text-sm truncate">{trip.client_name}</h3>
                      {trip.trip_name && (
                        <p className="text-xs text-stone-500 truncate">{trip.trip_name}</p>
                      )}
                      <p className="text-xs text-stone-400 truncate">{trip.destination}</p>
                      {trip.file_number && (
                        <span className="text-xs font-mono bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded border border-stone-200 mt-1 inline-block">
                          {trip.file_number}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className={`${statusConfig?.color} border flex-shrink-0`}>
                      {statusConfig?.label}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 py-3 border-y border-stone-100">
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Total</p>
                      <p className="font-semibold text-stone-900">${(trip.total_price || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Comisión</p>
                      <p className="font-semibold text-green-600">${(trip.total_commission || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 text-xs">Fecha:</span>
                      <span className="text-stone-700 font-medium text-xs">
                        {formatDate(trip.start_date, 'd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 text-xs">Agente:</span>
                      <span className="text-stone-700 font-medium text-xs">{agent?.full_name || 'Sin asignar'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(createPageUrl(`SoldTripDetail?id=${trip.id}`))}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Detalles
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon={CheckCircle}
            title="No hay viajes vendidos"
            description="No se encontraron viajes con los filtros seleccionados"
          />
        )}
      </div>
    </div>
  );
}
