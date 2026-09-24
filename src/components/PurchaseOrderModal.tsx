import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Printer, 
  ShoppingCart, 
  AlertCircle, 
  Layers, 
  FileText, 
  Table as TableIcon,
  Truck,
  Database,
  RefreshCw
} from 'lucide-react';
import { MaterialItem, MaterialCategory } from '../types';
import { formatMultipleOrdersText, formatSingleOrderItemText } from '../utils/orderFormat';
import confetti from 'canvas-confetti';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsToOrder: MaterialItem[];
  monthName: string;
  onMarkBatchOrdered?: (items: MaterialItem[]) => Promise<void> | void;
  onToggleOrdered?: (id: string, isOrdered: boolean) => Promise<void> | void;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  itemsToOrder,
  monthName,
  onMarkBatchOrdered,
  onToggleOrdered,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'preview'>('table');
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [savedBatchSuccess, setSavedBatchSuccess] = useState(false);

  if (!isOpen) return null;

  const categories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];

  // Filter items by category
  const filteredItems = itemsToOrder.filter((item) => {
    return selectedCategory === 'all' || item.category === selectedCategory;
  });

  const totalUnits = filteredItems.reduce((acc, i) => acc + i.unitsToOrder, 0);

  // Generate formatted text according to the exact requested format
  const generatedText = formatMultipleOrdersText(filteredItems);

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopySingle = (item: MaterialItem) => {
    const text = formatSingleOrderItemText(item);
    navigator.clipboard.writeText(text);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRegisterBatch = async () => {
    if (!onMarkBatchOrdered || filteredItems.length === 0 || isSavingBatch) return;
    setIsSavingBatch(true);
    try {
      await onMarkBatchOrdered(filteredItems);
      setSavedBatchSuccess(true);
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
      setTimeout(() => setSavedBatchSuccess(false), 4000);
    } catch {
      // handled in parent
    } finally {
      setIsSavingBatch(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Orden de Reposición y Cotización
              </h3>
              <p className="text-xs text-slate-500">
                Formato formal para solicitud a proveedores ({monthName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar: By Product Type / Category and View mode toggle */}
        <div className="px-6 py-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Product Type / Category */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> Tipo:
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden cursor-pointer"
              >
                <option value="all">Todos los Tipos ({itemsToOrder.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c} ({itemsToOrder.filter((i) => i.category === c).length})
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                  viewMode === 'table'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3 h-3" />
                <span>Tabla</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                  viewMode === 'preview'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Vista Previa del Texto</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-700">
            <span className="text-xs">
              Materiales: <strong>{filteredItems.length}</strong>
            </span>
            <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-bold text-xs font-mono shadow-xs">
              Total: {totalUnits.toLocaleString('es-AR')} unidades
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm font-semibold">No hay materiales para pedir en esta categoría.</p>
              <p className="text-xs mt-1 text-slate-400">El stock actual cubre el mínimo fijado para {monthName}.</p>
            </div>
          ) : viewMode === 'preview' ? (
            /* Text Preview Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Texto listo para copiar y enviar por correo o WhatsApp:</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {filteredItems.length} {filteredItems.length === 1 ? 'producto' : 'productos'}
                </span>
              </div>
              <div className="relative">
                <pre className="p-5 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner select-all">
                  {generatedText}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Table Mode */
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Material / Denominación</th>
                    <th className="py-3 px-4 text-right">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Stock Mínimo</th>
                    <th className="py-3 px-4 text-right bg-indigo-50 font-bold text-indigo-950 text-sm">
                      Cantidad Solicitada
                    </th>
                    <th className="py-3 px-4 text-center">Urgencia</th>
                    <th className="py-3 px-4 text-center">Estado en Base de Datos</th>
                    <th className="py-3 px-3 text-center">Copiar Individual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const isItemCopied = copiedItemId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {item.name}
                          {item.notes && (
                            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                              {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-mono">
                          {item.totalUnits.toLocaleString('es-AR')} un.
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-mono">
                          {item.minStockAdjusted.toLocaleString('es-AR')} un.
                        </td>
                        <td className="py-3 px-4 text-right font-black text-indigo-700 font-mono text-base bg-indigo-50/50">
                          {item.unitsToOrder.toLocaleString('es-AR')} unidades
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.status === 'CRITICO' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <AlertCircle className="w-3 h-3" /> Crítico
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Reposición
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.isOrdered ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-300">
                              <Truck className="w-3 h-3 text-sky-600" /> Pedido Registrado
                            </span>
                          ) : onToggleOrdered ? (
                            <button
                              type="button"
                              onClick={() => onToggleOrdered(item.id, true)}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 border border-sky-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                              title="Marcar pedido en la base de datos central"
                            >
                              <Truck className="w-3 h-3 text-sky-600" /> Marcar Pedido
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Pendiente</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleCopySingle(item)}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer active:scale-95 ${
                              isItemCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                            title="Copiar texto formal de este producto individual"
                          >
                            {isItemCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-center sm:text-left">
            <span>
              Formato formal con solicitud de cotización y plazo de entrega.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Imprimir</span>
            </button>

            {onMarkBatchOrdered && (
              <button
                type="button"
                onClick={handleRegisterBatch}
                disabled={filteredItems.length === 0 || isSavingBatch}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Cargar y registrar estos pedidos en la base de datos central"
              >
                {isSavingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Guardando en BD...</span>
                  </>
                ) : savedBatchSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>¡Guardado en BD!</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Registrar en Base de Datos</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleCopy}
              disabled={filteredItems.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>
                    {filteredItems.length <= 1
                      ? 'Copiar Pedido (Texto Formal)'
                      : `Copiar Pedido (${filteredItems.length} materiales)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

