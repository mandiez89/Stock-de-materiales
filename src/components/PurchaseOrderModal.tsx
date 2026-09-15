import React, { useState } from 'react';
import { X, Copy, Check, Printer, ShoppingCart, Truck, AlertCircle, Layers } from 'lucide-react';
import { MaterialItem, MaterialCategory } from '../types';
import confetti from 'canvas-confetti';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsToOrder: MaterialItem[];
  monthName: string;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  itemsToOrder,
  monthName,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  if (!isOpen) return null;

  const categories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];
  const providers = Array.from(new Set(itemsToOrder.map((i) => i.provider)));

  // Filter items by category AND provider
  const filteredItems = itemsToOrder.filter((item) => {
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchProv = selectedProvider === 'all' || item.provider === selectedProvider;
    return matchCat && matchProv;
  });

  const totalUnits = filteredItems.reduce((acc, i) => acc + i.unitsToOrder, 0);

  const generateWhatsAppText = () => {
    let text = `📦 *SOLICITUD DE COMPRA / REPOSICIÓN DE MATERIALES - SUGESTIÓN*\n`;
    text += `📅 *Mes:* ${monthName}\n`;
    if (selectedCategory !== 'all') {
      text += `📂 *Tipo de Producto:* ${selectedCategory}\n`;
    }
    if (selectedProvider !== 'all') {
      text += `🏢 *Proveedor:* ${selectedProvider}\n`;
    }
    text += `🔢 *Volumen Total a Pedir:* ${totalUnits.toLocaleString('es-AR')} unidades\n\n`;
    text += `*DETALLE DE CANTIDADES TOTALES A PEDIR:*\n`;

    filteredItems.forEach((item, index) => {
      text += `${index + 1}. *${item.name}* [${item.category}]\n`;
      text += `   ↳ Cantidad a pedir: *${item.unitsToOrder.toLocaleString('es-AR')} unidades*\n`;
      text += `   ↳ Stock actual en depósito: ${item.totalUnits.toLocaleString('es-AR')} un. (Mínimo: ${item.minStockAdjusted.toLocaleString('es-AR')} un.)\n`;
      if (item.status === 'CRITICO') {
        text += `   ↳ ⚠️ *PRIORIDAD CRÍTICA*\n`;
      }
      text += `\n`;
    });

    text += `_Por favor confirmar cotización actualizada, disponibilidad y fecha de entrega. Muchas gracias._`;
    return text;
  };

  const handleCopy = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
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
                Orden de Reposición por Cantidades Totales
              </h3>
              <p className="text-xs text-slate-500">
                Cantidades exactas en unidades requeridas para {monthName} (sin bultos)
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

        {/* Filter bar: By Product Type / Category and optionally Provider */}
        <div className="px-6 py-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Product Type / Category */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> Tipo de Producto:
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

            {/* Filter by Provider */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Proveedor:
              </span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden cursor-pointer"
              >
                <option value="all">Todos los Proveedores</option>
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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

        {/* Order Items Table (ONLY IN TOTAL UNITS) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm font-semibold">No hay materiales para pedir en esta categoría.</p>
              <p className="text-xs mt-1 text-slate-400">El stock actual cubre el mínimo fijado para {monthName}.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Tipo de Producto</th>
                    <th className="py-3 px-4">Material / Denominación</th>
                    <th className="py-3 px-4 text-right">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Stock Mínimo</th>
                    <th className="py-3 px-4 text-right bg-indigo-50 font-bold text-indigo-950 text-sm">
                      Cantidad Total a Pedir
                    </th>
                    <th className="py-3 px-4 text-left">Proveedor</th>
                    <th className="py-3 px-4 text-center">Urgencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
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
                      {/* ONLY TOTAL UNITS - NO BULTOS */}
                      <td className="py-3 px-4 text-right font-black text-indigo-700 font-mono text-base bg-indigo-50/50">
                        {item.unitsToOrder.toLocaleString('es-AR')} un.
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px] truncate max-w-[130px]">
                        {item.provider}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-center sm:text-left">
            <span>Reposición calculada exclusivamente en <strong>cantidades totales requeridas</strong> para fábrica.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Copiado para WhatsApp!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Pedido (Texto WhatsApp)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
