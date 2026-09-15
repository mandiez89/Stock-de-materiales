import { MaterialItem, MonthlyFactor, InventoryRecord } from '../types';

export const MONTHLY_FACTORS: MonthlyFactor[] = [
  { month: 1, name: 'Enero', shortName: 'Ene', factor: 0.85, seasonName: 'Temporada Baja (Receso estival)', description: 'Consumo reducido de medias y pantys por verano' },
  { month: 2, name: 'Febrero', shortName: 'Feb', factor: 0.90, seasonName: 'Inicio de Producción', description: 'Comienzo de preparación de temporada escolar y otoño' },
  { month: 3, name: 'Marzo', shortName: 'Mar', factor: 1.15, seasonName: 'Temporada Media-Alta', description: 'Lanzamiento de colecciones otoño e inicio de clases' },
  { month: 4, name: 'Abril', shortName: 'Abr', factor: 1.25, seasonName: 'Temporada Alta (Otoño)', description: 'Pico de consumo de pantys, medias lycra y cajas' },
  { month: 5, name: 'Mayo', shortName: 'May', factor: 1.30, seasonName: 'Temporada Alta (Invierno)', description: 'Máximo histórico anual de empaque y demanda' },
  { month: 6, name: 'Junio', shortName: 'Jun', factor: 1.30, seasonName: 'Temporada Alta (Invierno)', description: 'Demanda invernal sostenida, reposición constante' },
  { month: 7, name: 'Julio', shortName: 'Jul', factor: 1.20, seasonName: 'Temporada Alta (Vacaciones)', description: 'Fin de invierno, stock de seguridad preventivo' },
  { month: 8, name: 'Agosto', shortName: 'Ago', factor: 1.10, seasonName: 'Temporada Media-Alta (Actual)', description: 'Transición hacia primavera y Día de las Infancias' },
  { month: 9, name: 'Septiembre', shortName: 'Sep', factor: 1.15, seasonName: 'Temporada Media-Alta (Primavera)', description: 'Campaña Primavera/Verano y preparativos Día de la Madre' },
  { month: 10, name: 'Octubre', shortName: 'Oct', factor: 1.25, seasonName: 'Temporada Alta (Día de la Madre)', description: 'Pico de ventas de bombachas, fantasía y regalos' },
  { month: 11, name: 'Noviembre', shortName: 'Nov', factor: 1.20, seasonName: 'Temporada Alta (Fin de Año)', description: 'Preparativos para fiestas y cierre de año' },
  { month: 12, name: 'Diciembre', shortName: 'Dic', factor: 1.10, seasonName: 'Temporada Alta (Navidad)', description: 'Despacho masivo festivo y stock para enero' },
];

const BASE_RAW_MATERIALS: Omit<MaterialItem, 'minStockAdjusted' | 'maxStockAdjusted' | 'unitsToOrder' | 'bultosToOrder' | 'status'>[] = [
  // --- CAJAS ---
  {
    id: 'caja-5cm',
    category: 'Cajas',
    name: 'Cajas 5 cm',
    bultos: 32,
    unitsPerBulto: 65,
    totalUnits: 2080,
    minStockBase: 1500,
    maxStockBase: 3500,
    provider: 'Cartonera Central',
    notes: 'Caja estándar para medias 3/4'
  },


  {
    id: 'caja-9cm',
    category: 'Cajas',
    name: 'Cajas 9 cm',
    bultos: 122,
    unitsPerBulto: 65,
    totalUnits: 7930,
    minStockBase: 3000,
    maxStockBase: 7000,
    provider: 'Cartonera Central',
    notes: 'Buen stock acumulado'
  },
  {
    id: 'caja-13cm',
    category: 'Cajas',
    name: 'Cajas 13 cm',
    bultos: 46,
    unitsPerBulto: 70,
    totalUnits: 3220,
    minStockBase: 2500,
    maxStockBase: 5000,
    provider: 'Cartonera Central',
    notes: 'Caja profunda'
  },
  {
    id: 'cajitas-bombachas',
    category: 'Cajas',
    name: 'Cajitas Bombachas',
    bultos: 1,
    unitsPerBulto: 525,
    totalUnits: 525,
    minStockBase: 2500,
    maxStockBase: 6000,
    provider: 'Cartonera Central',
    notes: 'URGENTE: Solo 1 bulto en depósito. Peligro de quiebre para línea lencería'
  },

  {
    id: 'tapas-dussio',
    category: 'Cajas',
    name: 'Tapas DUSSIO',
    bultos: 18,
    unitsPerBulto: 250,
    totalUnits: 4500,
    minStockBase: 3000,
    maxStockBase: 6000,
    provider: 'Cartonera Central',
    notes: 'Juego con bases Dussio'
  },
  {
    id: 'bases-dussio',
    category: 'Cajas',
    name: 'Bases DUSSIO',
    bultos: 18,
    unitsPerBulto: 250,
    totalUnits: 4500,
    minStockBase: 3000,
    maxStockBase: 6000,
    provider: 'Cartonera Central',
    notes: 'Equilibrado con tapas'
  },
  {
    id: 'cajitas-dussio',
    category: 'Cajas',
    name: 'Cajitas DUSSIO',
    bultos: 16,
    unitsPerBulto: 500,
    totalUnits: 8000,
    minStockBase: 4000,
    maxStockBase: 9000,
    provider: 'Cartonera Central',
    notes: 'Presentación chica Dussio'
  },

  // --- CELOFANES (SIN IMPRESIÓN) ---
  {
    id: 'celofan-grandes',
    category: 'Celofanes',
    name: 'Grandes (Celofán)',
    bultos: 2,
    unitsPerBulto: 3000,
    totalUnits: 6000,
    minStockBase: 9000,
    maxStockBase: 20000,
    provider: 'Plásticos & Celofanes Andina',
    notes: 'ALERTA: Solo 2 bultos. Reposición urgente para packaging'
  },

  {
    id: 'celofan-med-solapa',
    category: 'Celofanes',
    name: 'Medianos con solapa',
    bultos: 2,
    unitsPerBulto: 7500,
    totalUnits: 15000,
    minStockBase: 12000,
    maxStockBase: 30000,
    provider: 'Plásticos & Celofanes Andina',
    notes: 'Alto rendimiento por bulto'
  },
  {
    id: 'celofan-chicos-sin-solapa',
    category: 'Celofanes',
    name: 'Chicos sin solapa',
    bultos: 2,
    unitsPerBulto: 5000,
    totalUnits: 10000,
    minStockBase: 10000,
    maxStockBase: 25000,
    provider: 'Plásticos & Celofanes Andina',
    notes: 'Límite de reposición'
  },
  {
    id: 'celofan-chicos-con-solapa',
    category: 'Celofanes',
    name: 'Chicos con solapa',
    bultos: 3,
    unitsPerBulto: 5000,
    totalUnits: 15000,
    minStockBase: 10000,
    maxStockBase: 25000,
    provider: 'Plásticos & Celofanes Andina',
    notes: 'Stock regular'
  },
  {
    id: 'celofan-extra-grandes',
    category: 'Celofanes',
    name: 'Extra grandes (trusas)',
    bultos: 1,
    unitsPerBulto: 4000,
    totalUnits: 4000,
    minStockBase: 5000,
    maxStockBase: 15000,
    provider: 'Plásticos & Celofanes Andina',
    notes: 'Consumo para trusas y fajas'
  },
  {
    id: 'celofan-5030',
    category: 'Celofanes',
    name: 'Celofán 5030 / 5035',
    bultos: 1,
    unitsPerBulto: 1000,
    totalUnits: 1000,
    minStockBase: 2000,
    maxStockBase: 6000,
    provider: 'Plásticos & Celofanes Andina',
    notes: 'Solo 1 bulto disponible'
  },

  // --- BOLSITAS (CON IMPRESIÓN) ---
  {
    id: 'bolsita-generico-azul',
    category: 'Bolsitas',
    name: 'Genérico Azul',
    bultos: 5,
    unitsPerBulto: 3000,
    totalUnits: 15000,
    minStockBase: 10000,
    maxStockBase: 25000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Línea Clásica'
  },
  {
    id: 'bolsita-generico-magenta',
    category: 'Bolsitas',
    name: 'Genérico Magenta',
    bultos: 2,
    unitsPerBulto: 6000,
    totalUnits: 12000,
    minStockBase: 10000,
    maxStockBase: 25000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Línea Juvenil'
  },
  {
    id: 'bolsita-generico-verde',
    category: 'Bolsitas',
    name: 'Genérico Verde',
    bultos: 4,
    unitsPerBulto: 5000,
    totalUnits: 20000,
    minStockBase: 12000,
    maxStockBase: 28000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Stock saludable'
  },
  {
    id: 'bolsita-generico-celeste',
    category: 'Bolsitas',
    name: 'Genérico Celeste',
    bultos: 5,
    unitsPerBulto: 4000,
    totalUnits: 20000,
    minStockBase: 12000,
    maxStockBase: 28000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Línea Algodón'
  },
  {
    id: 'bolsita-plantines',
    category: 'Bolsitas',
    name: 'Plantines (Bolsitas)',
    bultos: 4,
    unitsPerBulto: 3000,
    totalUnits: 12000,
    minStockBase: 8000,
    maxStockBase: 20000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Packaging especial plantines'
  },
  {
    id: 'bolsita-lycra',
    category: 'Bolsitas',
    name: '3/4 Lycra (123-1123)',
    bultos: 5,
    unitsPerBulto: 2000,
    totalUnits: 10000,
    minStockBase: 10000,
    maxStockBase: 24000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Producto de alta rotación'
  },
  {
    id: 'bolsita-sugesteen-panty',
    category: 'Bolsitas',
    name: 'Sugesteen - Panty',
    bultos: 5,
    unitsPerBulto: 2000,
    totalUnits: 10000,
    minStockBase: 10000,
    maxStockBase: 25000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Bolsa institucional Sugesteen'
  },
  {
    id: 'bolsita-sugesteen-panty-opaca',
    category: 'Bolsitas',
    name: 'Sugesteen - Panty Opaca',
    bultos: 8, // Anotado: 2 bultos de 4000 + 6 bultos de 2000
    unitsPerBulto: 2500,
    totalUnits: 20000,
    minStockBase: 10000,
    maxStockBase: 25000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Contiene 2 bultos x 4000 + 6 bultos x 2000'
  },
  {
    id: 'bolsita-sugesteen-fantasia',
    category: 'Bolsitas',
    name: 'Sugesteen - Fantasía',
    bultos: 1,
    unitsPerBulto: 7500,
    totalUnits: 7500,
    minStockBase: 7000,
    maxStockBase: 18000,
    provider: 'Imprenta Gráfica MP',
    notes: 'Línea de moda temporada'
  },

  // --- CABALLETES (COLUMNA 1) ---
  { id: 'cab-15', category: 'Caballetes', name: 'Caballete 15', bultos: 5, unitsPerBulto: 500, totalUnits: 2500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-36-37', category: 'Caballetes', name: 'Caballete 36/37', bultos: 11, unitsPerBulto: 250, totalUnits: 2750, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-103', category: 'Caballetes', name: 'Caballete 103', bultos: 12, unitsPerBulto: 500, totalUnits: 6000, minStockBase: 3000, maxStockBase: 7000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-106', category: 'Caballetes', name: 'Caballete 106', bultos: 8, unitsPerBulto: 500, totalUnits: 4000, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-110', category: 'Caballetes', name: 'Caballete 110', bultos: 5, unitsPerBulto: 500, totalUnits: 2500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-114', category: 'Caballetes', name: 'Caballete 114', bultos: 5, unitsPerBulto: 500, totalUnits: 2500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-126', category: 'Caballetes', name: 'Caballete 126', bultos: 5, unitsPerBulto: 500, totalUnits: 2500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-127', category: 'Caballetes', name: 'Caballete 127', bultos: 12, unitsPerBulto: 500, totalUnits: 6000, minStockBase: 3000, maxStockBase: 7000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-155', category: 'Caballetes', name: 'Caballete 155', bultos: 2, unitsPerBulto: 500, totalUnits: 1000, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP', notes: 'Bajo stock' },
  { id: 'cab-160', category: 'Caballetes', name: 'Caballete 160', bultos: 7, unitsPerBulto: 500, totalUnits: 3500, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-161', category: 'Caballetes', name: 'Caballete 161', bultos: 5, unitsPerBulto: 500, totalUnits: 2500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-187', category: 'Caballetes', name: 'Caballete 187', bultos: 10, unitsPerBulto: 500, totalUnits: 5000, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-350', category: 'Caballetes', name: 'Caballete 350', bultos: 9, unitsPerBulto: 500, totalUnits: 4500, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-505', category: 'Caballetes', name: 'Caballete 505', bultos: 8, unitsPerBulto: 500, totalUnits: 4000, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-510', category: 'Caballetes', name: 'Caballete 510', bultos: 10, unitsPerBulto: 500, totalUnits: 5000, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-525', category: 'Caballetes', name: 'Caballete 525', bultos: 10, unitsPerBulto: 500, totalUnits: 5000, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-606', category: 'Caballetes', name: 'Caballete 606', bultos: 6, unitsPerBulto: 500, totalUnits: 3000, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-607', category: 'Caballetes', name: 'Caballete 607', bultos: 6, unitsPerBulto: 1600, totalUnits: 9600, minStockBase: 5000, maxStockBase: 12000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-616-656', category: 'Caballetes', name: 'Caballete 616 / 656', bultos: 5, unitsPerBulto: 500, totalUnits: 2500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-707', category: 'Caballetes', name: 'Caballete 707', bultos: 7, unitsPerBulto: 500, totalUnits: 3500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-806', category: 'Caballetes', name: 'Caballete 806', bultos: 4, unitsPerBulto: 500, totalUnits: 2000, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-808', category: 'Caballetes', name: 'Caballete 808', bultos: 7, unitsPerBulto: 500, totalUnits: 3500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  {
    id: 'cab-909',
    category: 'Caballetes',
    name: 'Caballete 909',
    bultos: 1,
    unitsPerBulto: 500,
    totalUnits: 500,
    minStockBase: 2500,
    maxStockBase: 6000,
    provider: 'Imprenta Gráfica MP',
    notes: 'CRÍTICO: Solo 1 bulto en stock (500 un)'
  },

  { id: 'cab-2011', category: 'Caballetes', name: 'Caballete 2011', bultos: 2, unitsPerBulto: 500, totalUnits: 1000, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP', notes: 'Stock bajo' },
  { id: 'cab-2161', category: 'Caballetes', name: 'Caballete 2161', bultos: 12, unitsPerBulto: 500, totalUnits: 6000, minStockBase: 3000, maxStockBase: 7000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-2300', category: 'Caballetes', name: 'Caballete 2300', bultos: 4, unitsPerBulto: 500, totalUnits: 2000, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-2550', category: 'Caballetes', name: 'Caballete 2550', bultos: 8, unitsPerBulto: 500, totalUnits: 4000, minStockBase: 2500, maxStockBase: 6000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-2012-2013', category: 'Caballetes', name: 'Caballete 2012 - 2013', bultos: 0, unitsPerBulto: 500, totalUnits: 0, minStockBase: 1500, maxStockBase: 4000, provider: 'Imprenta Gráfica MP', notes: 'Sin existencia física (-) en planilla' },

  // --- CABALLETES (COLUMNA 2) ---
  { id: 'cab-1300', category: 'Caballetes', name: 'Caballete 1300', bultos: 18, unitsPerBulto: 525, totalUnits: 9450, minStockBase: 3500, maxStockBase: 8000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-2561', category: 'Caballetes', name: 'Caballete 2561', bultos: 6, unitsPerBulto: 500, totalUnits: 3000, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-4500', category: 'Caballetes', name: 'Caballete 4500', bultos: 11, unitsPerBulto: 500, totalUnits: 5500, minStockBase: 3000, maxStockBase: 7000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-6000', category: 'Caballetes', name: 'Caballete 6000', bultos: 23, unitsPerBulto: 250, totalUnits: 5750, minStockBase: 3000, maxStockBase: 7000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-7000', category: 'Caballetes', name: 'Caballete 7000', bultos: 14, unitsPerBulto: 500, totalUnits: 7000, minStockBase: 3000, maxStockBase: 8000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-7200', category: 'Caballetes', name: 'Caballete 7200', bultos: 4, unitsPerBulto: 500, totalUnits: 2000, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  {
    id: 'cab-7201',
    category: 'Caballetes',
    name: 'Caballete 7201',
    bultos: 1,
    unitsPerBulto: 500,
    totalUnits: 500,
    minStockBase: 2500,
    maxStockBase: 6000,
    provider: 'Imprenta Gráfica MP',
    notes: 'CRÍTICO: Stock al límite (1 bulto)'
  },

  { id: 'cab-7500', category: 'Caballetes', name: 'Caballete 7500', bultos: 4, unitsPerBulto: 350, totalUnits: 1400, minStockBase: 1500, maxStockBase: 4000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-7520', category: 'Caballetes', name: 'Caballete 7520', bultos: 3, unitsPerBulto: 350, totalUnits: 1050, minStockBase: 1500, maxStockBase: 4000, provider: 'Imprenta Gráfica MP', notes: 'Stock bajo' },
  {
    id: 'cab-8100',
    category: 'Caballetes',
    name: 'Caballete 8100',
    bultos: 0, // Anotado 0 en la planilla
    unitsPerBulto: 500,
    totalUnits: 0,
    minStockBase: 2000,
    maxStockBase: 5000,
    provider: 'Imprenta Gráfica MP',
    notes: 'QUIEBRE TOTAL: 0 bultos en depósito'
  },
  { id: 'cab-8300', category: 'Caballetes', name: 'Caballete 8300', bultos: 2, unitsPerBulto: 500, totalUnits: 1000, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP', notes: 'Stock bajo' },
  { id: 'cab-8400', category: 'Caballetes', name: 'Caballete 8400', bultos: 5, unitsPerBulto: 500, totalUnits: 2500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP' },
  { id: 'cab-8500', category: 'Caballetes', name: 'Caballete 8500', bultos: 3, unitsPerBulto: 500, totalUnits: 1500, minStockBase: 2000, maxStockBase: 5000, provider: 'Imprenta Gráfica MP', notes: 'Por debajo del mínimo' },

  // --- CARTONES ---
  {
    id: 'carton-grandes',
    category: 'Cartones',
    name: 'Cartones Grandes',
    bultos: 6,
    unitsPerBulto: 2000,
    totalUnits: 12000,
    minStockBase: 8000,
    maxStockBase: 20000,
    provider: 'Cartonera Central',
    notes: 'Cartón soporte grande'
  },
  {
    id: 'carton-medianos',
    category: 'Cartones',
    name: 'Cartones Medianos',
    bultos: 6,
    unitsPerBulto: 2200,
    totalUnits: 13200,
    minStockBase: 8000,
    maxStockBase: 20000,
    provider: 'Cartonera Central',
    notes: 'Cartón mediano'
  },
  {
    id: 'carton-chicos',
    category: 'Cartones',
    name: 'Cartones Chicos',
    bultos: 1,
    unitsPerBulto: 4000,
    totalUnits: 4000,
    minStockBase: 6000,
    maxStockBase: 16000,
    provider: 'Cartonera Central',
    notes: 'ALERTA: Solo 1 bulto'
  },
  {
    id: 'carton-plantines',
    category: 'Cartones',
    name: 'Cartones Plantines',
    bultos: 0, // Marcado con '-'
    unitsPerBulto: 2500,
    totalUnits: 0,
    minStockBase: 5000,
    maxStockBase: 12000,
    provider: 'Cartonera Central',
    notes: 'Sin stock físico (-)'
  }
];

// Helper to build initial 12-month min/max matrix for an item
export function buildDefaultMonthlyMinMax(minBase: number, maxBase: number): Record<number, { min: number; max: number }> {
  const result: Record<number, { min: number; max: number }> = {};
  MONTHLY_FACTORS.forEach((mf) => {
    result[mf.month] = {
      min: Math.round(minBase * mf.factor),
      max: Math.round(maxBase * mf.factor),
    };
  });
  return result;
}

export const RAW_MATERIALS_FROM_SHEET: (Omit<MaterialItem, 'minStockAdjusted' | 'maxStockAdjusted' | 'unitsToOrder' | 'bultosToOrder' | 'status'> & { monthlyMinMax: Record<number, { min: number; max: number }> })[] = BASE_RAW_MATERIALS.map((item) => ({
  ...item,
  monthlyMinMax: buildDefaultMonthlyMinMax(item.minStockBase, item.maxStockBase)
}));


// Calculation helper taking into account month number and explicit per-product monthly thresholds
export function computeMaterialCalculations(
  rawItem: Omit<MaterialItem, 'minStockAdjusted' | 'maxStockAdjusted' | 'unitsToOrder' | 'bultosToOrder' | 'status'>,
  monthFactor: number,
  monthNumber: number = 8
): MaterialItem {
  // Allow direct total units entry if there are no bultos or item was set by direct units
  const totalUnits = rawItem.isDirectUnits || (rawItem.bultos === 0 && rawItem.totalUnits > 0)
    ? rawItem.totalUnits
    : rawItem.bultos * rawItem.unitsPerBulto;


  // Use explicit monthly min/max set for this specific product and month (e.g. loaded from Google Sheets)
  let minStockAdjusted: number;
  let maxStockAdjusted: number;

  if (rawItem.monthlyMinMax && rawItem.monthlyMinMax[monthNumber]) {
    minStockAdjusted = rawItem.monthlyMinMax[monthNumber].min;
    maxStockAdjusted = rawItem.monthlyMinMax[monthNumber].max;
  } else {
    minStockAdjusted = rawItem.minStockBase;
    maxStockAdjusted = rawItem.maxStockBase;
  }

  let status: MaterialItem['status'] = 'OPTIMO';
  let unitsToOrder = 0;

  if (totalUnits <= minStockAdjusted * 0.5) {
    status = 'CRITICO';
    unitsToOrder = Math.max(0, maxStockAdjusted - totalUnits);
  } else if (totalUnits < minStockAdjusted) {
    status = 'PEDIR';
    unitsToOrder = Math.max(0, maxStockAdjusted - totalUnits);
  } else if (totalUnits > maxStockAdjusted * 1.25) {
    status = 'SOBRESTOCK';
    unitsToOrder = 0;
  } else {
    status = 'OPTIMO';
    unitsToOrder = 0;
  }

  // Calculate bultos rounded up (providers supply closed bundles)
  const bultosToOrder = unitsToOrder > 0 && rawItem.unitsPerBulto > 0
    ? Math.ceil(unitsToOrder / rawItem.unitsPerBulto)
    : 0;

  return {
    ...rawItem,
    totalUnits,
    minStockAdjusted,
    maxStockAdjusted,
    unitsToOrder,
    bultosToOrder,
    status
  };
}

export const INITIAL_INVENTORY_HISTORY: InventoryRecord[] = [
  {
    id: 'rec-2026-08',
    date: '2026-08-15',
    responsible: 'Operador Depósito',
    periodName: 'Agosto 2026',
    totalItems: 52,
    criticalCount: 7,
    reorderCount: 11,
    totalBultosToOrder: 68,
    notes: 'Relevamiento mensual registrado digitalmente en el sistema.',
    items: [] // Populated dynamically
  }
];

