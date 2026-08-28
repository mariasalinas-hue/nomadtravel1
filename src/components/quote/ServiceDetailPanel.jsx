import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ServiceEditor, { TYPE_LABEL } from './ServiceEditor';

// Panel lateral (⤢) para editar un servicio. Guarda al salir de cada campo.
// El cuerpo es el mismo ServiceEditor que usa el folder por tipo.
export default function ServiceDetailPanel({ service, onSet, onSetMeta, onApplyPricing, onDelete, onClose }) {
  const type = service?.service_type || 'otro';
  return (
    <Sheet open={!!service} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {service && (
          <div className="pb-8">
            <SheetHeader className="space-y-1 text-left mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{TYPE_LABEL[type]}</span>
              <SheetTitle className="text-lg">Detalle del servicio</SheetTitle>
            </SheetHeader>
            <ServiceEditor
              service={service}
              onSet={onSet}
              onSetMeta={onSetMeta}
              onApplyPricing={onApplyPricing}
              onDelete={onDelete}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
