import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import ErrorReportDialog from './ErrorReportDialog';

export default function ErrorReportButton() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-24 left-4 lg:bottom-auto lg:top-6 lg:left-auto lg:right-6 z-40 p-3 lg:px-4 lg:py-2 rounded-full shadow-lg flex items-center gap-2 text-white font-semibold text-sm transition-all hover:shadow-xl"
        style={{ backgroundColor: '#dc2626' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Reportar Error"
      >
        <AlertCircle className="w-4 h-4" />
        <span className="hidden lg:inline">Reportar Error</span>
      </motion.button>

      <ErrorReportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
