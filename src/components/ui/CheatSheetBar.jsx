import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Hotel, Building2, Compass, Plane, Car, Train, DollarSign, BookOpen } from 'lucide-react';

const CHEAT_SHEETS = [
  { id: 'hoteles', label: 'Hoteles', icon: Hotel },
  { id: 'dmc', label: 'DMC', icon: Building2 },
  { id: 'tours', label: 'Tours', icon: Compass },
  { id: 'aviones', label: 'Aviones', icon: Plane },
  { id: 'traslados', label: 'Traslados', icon: Car },
  { id: 'trenes', label: 'Trenes', icon: Train },
  { id: 'comisiones', label: 'Comisiones', icon: DollarSign }
];

export default function CheatSheetBar() {
  const [openModal, setOpenModal] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const currentSheet = CHEAT_SHEETS.find(s => s.id === openModal);

  return (
    <>
      {/* Hover Detection Zone (solo escritorio; en móvil no hay hover y tapa el header) */}
      <div
        className="hidden lg:block fixed top-0 left-0 right-0 h-12 z-40 pointer-events-auto"
        onMouseEnter={() => setIsVisible(true)}
      />

      {/* Floating Cheat Sheet Bar */}
      <div
        className={`hidden lg:block fixed top-0 left-1/2 transform -translate-x-1/2 z-50 transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        onMouseLeave={() => setIsVisible(false)}
      >
        <div className="shadow-lg px-4 py-2 flex items-center gap-2 rounded-b-2xl" style={{ backgroundColor: '#2E442A' }}>
          <div className="flex items-center gap-1 px-2">
            <BookOpen className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold text-white">Guías Rápidas</span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          {CHEAT_SHEETS.map((sheet) => {
            const Icon = sheet.icon;
            return (
              <Button
                key={sheet.id}
                size="sm"
                onClick={() => setOpenModal(sheet.id)}
                className="h-8 px-3 rounded-lg text-xs font-medium transition-colors bg-white hover:bg-white/90"
                style={{ 
                  color: '#2E442A'
                }}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {sheet.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={!!openModal} onOpenChange={() => setOpenModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#2E442A' }}>
              {currentSheet && <currentSheet.icon className="w-5 h-5" />}
              Guía Rápida: {currentSheet?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 text-center text-stone-500">
              <p className="text-sm">Contenido de la guía para {currentSheet?.label} próximamente...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}