/**
 * Ordenação de produtos por categoria
 * Ordem obrigatória: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
 */

// Ordem das categorias (índice menor = prioridade maior)
const CATEGORY_ORDER: Record<string, number> = {
  // Variações para "Espeto"
  'espeto': 1,
  'espetos': 1,
  'Espeto': 1,
  'Espetos': 1,
  'ESPETO': 1,
  'ESPETOS': 1,
  
  // Variações para "Hamburguers"
  'hamburguer': 2,
  'hamburguers': 2,
  'hamburger': 2,
  'hamburgers': 2,
  'Hamburguer': 2,
  'Hamburguers': 2,
  'Hamburger': 2,
  'Hamburgers': 2,
  'HAMBURGUER': 2,
  'HAMBURGUERS': 2,
  'HAMBURGER': 2,
  'HAMBURGERS': 2,
  'Lanche': 2,
  'Lanches': 2,
  'lanche': 2,
  'lanches': 2,
  
  // Variações para "Carvao"
  'carvao': 3,
  'carvão': 3,
  'Carvao': 3,
  'Carvão': 3,
  'CARVAO': 3,
  'CARVÃO': 3,
  
  // Variações para "Outros"
  'outro': 4,
  'outros': 4,
  'Outro': 4,
  'Outros': 4,
  'OUTRO': 4,
  'OUTROS': 4,
}

// Obtém a ordem de uma categoria (categorias desconhecidas vão para "Outros" = 4)
export function getCategoryOrder(category: string | null | undefined): number {
  if (!category) return 4 // Sem categoria vai para "Outros"
  
  // Verificar correspondência exata
  if (category in CATEGORY_ORDER) {
    return CATEGORY_ORDER[category]
  }
  
  // Verificar correspondência parcial (case-insensitive)
  const lowerCategory = category.toLowerCase()
  
  if (lowerCategory.includes('espeto')) return 1
  if (lowerCategory.includes('hamburguer') || lowerCategory.includes('hamburger') || lowerCategory.includes('lanche')) return 2
  if (lowerCategory.includes('carvao') || lowerCategory.includes('carvão')) return 3
  
  // Qualquer outra categoria vai para "Outros"
  return 4
}

// Função para ordenar array de produtos por categoria
// 🏷️ PROMOÇÕES PRIMEIRO: Produtos em promoção aparecem no topo
export function sortProductsByCategory<T extends { 
  category?: string | null
  isOnPromotion?: boolean
  isWeeklyPromotion?: boolean 
}>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    // 🌟 PRIORIDADE 1: Promoção da Semana (sempre primeiro)
    const aWeekly = (a as any).isWeeklyPromotion === true ? 1 : 0
    const bWeekly = (b as any).isWeeklyPromotion === true ? 1 : 0
    if (aWeekly !== bWeekly) {
      return bWeekly - aWeekly // Promoção da semana primeiro
    }
    
    // 🏷️ PRIORIDADE 2: Produtos em promoção
    const aPromo = (a as any).isOnPromotion === true ? 1 : 0
    const bPromo = (b as any).isOnPromotion === true ? 1 : 0
    if (aPromo !== bPromo) {
      return bPromo - aPromo // Promoção primeiro
    }
    
    // 📦 PRIORIDADE 3: Categoria (Espeto > Hamburguers > Carvao > Outros)
    const orderA = getCategoryOrder(a.category)
    const orderB = getCategoryOrder(b.category)
    
    if (orderA !== orderB) {
      return orderA - orderB
    }
    
    // Se mesma categoria, mantém ordem original (estável)
    return 0
  })
}

// Comparador para uso com sort() em SQL ou ordenação customizada
export function categoryComparator(categoryA: string | null | undefined, categoryB: string | null | undefined): number {
  return getCategoryOrder(categoryA) - getCategoryOrder(categoryB)
}

// Lista de categorias na ordem correta (para exibição em filtros/grupos)
export const CATEGORY_DISPLAY_ORDER = [
  { key: 'espetos', label: 'Espetos', order: 1 },
  { key: 'hamburguers', label: 'Hamburguers', order: 2 },
  { key: 'carvao', label: 'Carvão', order: 3 },
  { key: 'outros', label: 'Outros', order: 4 },
]
