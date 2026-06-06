// Shared reminder template used by both the trip detail timeline and the
// dashboard "Recordatorios Activos" panel.

export const TIMELINE_REMINDERS = {
  '6_months': {
    label: '6 meses antes',
    tasks: [
      'Pasaportes con mínimo 6 meses de vigencia al regresar',
      'Enviar foto de pasaportes para validar nombres',
      'Recomendar contratar seguro de viaje'
    ]
  },
  '3_months': {
    label: '3 meses antes',
    tasks: [
      'Revisar si necesitan visas / eVisa / ESTA',
      'Iniciar trámite de visa mínimo 3 meses antes',
      'Preparar documentos necesarios (fotos, estados de cuenta, etc.)'
    ]
  },
  '1.5_months': {
    label: '1.5 meses antes',
    tasks: [
      'Ver vacunas / certificados médicos según destino',
      'Preparar medicamentos y recetas',
      'Revisar opciones de SIM / eSIM internacional'
    ]
  },
  '1_month': {
    label: '1 mes antes',
    tasks: [
      'Revisar y confirmar itinerario final (fechas, horarios, nombres)',
      'Confirmar preferencias: camas, alergias, aniversarios, etc.'
    ]
  },
  '3_weeks': {
    label: '3 semanas antes',
    tasks: [
      'Checklist de maleta según clima',
      'Confirmar peso permitido de equipaje',
      'Descargar apps útiles: aerolíneas, mapas offline, traductor, seguro'
    ]
  },
  '1-2_weeks': {
    label: '1-2 semanas antes',
    tasks: [
      'Recibir documentos finales: vouchers, contactos, itinerario',
      'Revisar si queda saldo por liquidar',
      'Cambiar algo de divisa si aplica'
    ]
  },
  '72-48_hours': {
    label: '72-48 horas antes',
    tasks: [
      'Hacer check-in online',
      'Confirmar transfers y horarios',
      'Revisar clima del destino'
    ]
  },
  '24_hours': {
    label: '24 horas antes',
    tasks: [
      'Verificar: pasaportes, visas, boarding pass, tarjetas, efectivo, cargadores',
      'Preparar salida al aeropuerto con tiempo'
    ]
  }
};

// Chronological order of the stages (earliest first)
export const TIMELINE_ORDER = [
  '6_months',
  '3_months',
  '1.5_months',
  '1_month',
  '3_weeks',
  '1-2_weeks',
  '72-48_hours',
  '24_hours'
];

// How many days before the trip each stage becomes relevant ("due")
export const TIMELINE_THRESHOLD_DAYS = {
  '6_months': 180,
  '3_months': 90,
  '1.5_months': 45,
  '1_month': 30,
  '3_weeks': 21,
  '1-2_weeks': 14,
  '72-48_hours': 3,
  '24_hours': 1
};
