import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/dateUtils';
import { MapPin, Calendar, Users, DollarSign, Edit2, Trash2, ArrowRight, XCircle, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STAGE_CONFIG = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700' },
  cotizando: { label: 'Cotizando', color: 'bg-yellow-100 text-yellow-700' },
  propuesta_enviada: { label: 'Propuesta Enviada', color: 'bg-purple-100 text-purple-700' },
  aceptado: { label: 'Aceptado', color: 'bg-green-100 text-green-700' },
  vendido: { label: 'Vendido', color: 'bg-emerald-100 text-emerald-800' },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-700' }
};

export default function TripCard({ trip, onEdit, onDelete, onMoveStage, onMarkLost }) {
  const stageConfig = STAGE_CONFIG[trip.stage] || STAGE_CONFIG.nuevo;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ layout: { duration: 0.2 } }}
      className="bg-white rounded-xl p-4 shadow-sm border border-stone-100 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <Badge className={`${stageConfig.color} font-medium text-xs`}>
          {stageConfig.label}
        </Badge>
        <div className="flex gap-1">
          <Link to={createPageUrl(`TripDetail?id=${trip.id}`)}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-stone-400 hover:text-stone-600"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-stone-400 hover:text-stone-600"
            onClick={() => onEdit(trip)}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-stone-400 hover:text-red-500"
            onClick={() => onDelete(trip)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Clientes: mostrar todos si hay múltiples, si no el client_name normal */}
      {trip.metadata?.clients?.length > 1 ? (
        <div className="mb-1 flex flex-wrap gap-1">
          {trip.metadata.clients.map((c, i) => (
            <span key={c.id || i} className="text-xs font-medium bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded-md">
              {c.name}
            </span>
          ))}
        </div>
      ) : (
        <h4 className="font-semibold text-stone-800 mb-1 text-sm">{trip.client_name}</h4>
      )}
      
      <div className="flex items-center gap-1 text-stone-600 mb-3">
        <MapPin className="w-3.5 h-3.5" style={{ color: '#2E442A' }} />
        <span className="text-sm font-medium">{trip.destination}</span>
      </div>

      <div className="space-y-1.5 text-xs text-stone-500">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {formatDate(trip.start_date, 'd MMM yyyy', { locale: es })}
            {trip.end_date && ` - ${formatDate(trip.end_date, 'd MMM yyyy', { locale: es })}`}
          </span>
        </div>
        {trip.travelers && (
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            <span>{trip.travelers} {trip.travelers === 1 ? 'persona' : 'personas'}</span>
          </div>
        )}
        {trip.budget && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5" />
            <span>${trip.budget.toLocaleString()} USD</span>
          </div>
        )}
      </div>

      {trip.mood && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <span className="text-xs text-stone-400">Mood:</span>
          <span className="text-xs text-stone-600 ml-1">{trip.mood}</span>
        </div>
      )}

      {trip.stage === 'perdido' && trip.lost_reason && (
        <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
          <div className="flex items-start gap-2">
            <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs text-red-600 font-medium">Motivo:</span>
              <p className="text-xs text-red-700 mt-0.5">{trip.lost_reason}</p>
            </div>
          </div>
        </div>
      )}

      {trip.stage !== 'vendido' && trip.stage !== 'perdido' && (
        <div className="mt-3 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs font-medium"
            style={{ color: '#2E442A' }}
            onClick={() => onMoveStage(trip)}
          >
            Avanzar etapa <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-stone-400 hover:text-red-500"
            onClick={() => onMarkLost(trip)}
            title="Marcar como perdido"
          >
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}