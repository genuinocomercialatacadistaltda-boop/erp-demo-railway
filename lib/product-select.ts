/**
 * Select padrão para queries de Product
 */
export const productSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  weight: true,
  priceWholesale: true,
  priceRetail: true,
  category: true,
  availableIn: true,
  quantityIncrement: true,
  soldByWeight: true,
  bulkDiscountMinQty: true,
  bulkDiscountPrice: true,
  currentStock: true,
  minStock: true,
  isActive: true,
  // 🏷️ Promoções
  isOnPromotion: true,
  promotionalPrice: true,
  isWeeklyPromotion: true,
  createdAt: true,
  updatedAt: true
} as any

/**
 * ⚡ Select OTIMIZADO para catálogo de pedidos
 * Apenas campos essenciais para reduzir tamanho do JSON
 */
export const catalogSelect = {
  id: true,
  name: true,
  imageUrl: true,
  weight: true,
  priceWholesale: true,
  priceRetail: true,
  category: true,
  availableIn: true,
  quantityIncrement: true,
  soldByWeight: true,
  bulkDiscountMinQty: true,
  bulkDiscountPrice: true,
  currentStock: true,
  minStock: true,
  isActive: true,
  // 🏷️ Promoções
  isOnPromotion: true,
  promotionalPrice: true,
  isWeeklyPromotion: true,
  // ❌ REMOVIDOS: description, createdAt, updatedAt (reduz ~40% do payload)
} as any
