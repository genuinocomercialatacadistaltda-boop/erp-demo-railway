import { prisma } from '../lib/db'
import * as fs from 'fs'

async function exportData() {
  console.log('Exportando dados...')
  
  // 1. Produtos
  const products = await prisma.product.findMany()
  console.log(`Produtos: ${products.length}`)
  
  // 2. Receitas com ingredientes
  const recipes = await prisma.recipe.findMany({
    include: {
      Ingredients: {
        include: {
          RawMaterial: true
        }
      }
    }
  })
  console.log(`Receitas: ${recipes.length}`)
  
  // 3. Matérias-primas
  const rawMaterials = await prisma.rawMaterial.findMany()
  console.log(`Matérias-primas: ${rawMaterials.length}`)
  
  // 4. Categorias de despesas
  const expenseCategories = await prisma.expenseCategory.findMany()
  console.log(`Categorias de despesas: ${expenseCategories.length}`)
  
  // 5. Contas bancárias (sem saldos)
  const bankAccounts = await prisma.bankAccount.findMany()
  console.log(`Contas bancárias: ${bankAccounts.length}`)
  
  // 6. Insumos (Supply)
  const supplies = await prisma.productionSupply.findMany()
  console.log(`Insumos de produção: ${supplies.length}`)
  
  // 7. Receitas de insumos
  const supplyRecipes = await prisma.supplyRecipe.findMany({
    include: {
      Items: true
    }
  })
  console.log(`Receitas de insumos: ${supplyRecipes.length}`)
  
  // 8. Ingredientes de receitas
  const recipeIngredients = await prisma.recipeIngredient.findMany()
  console.log(`Ingredientes de receitas: ${recipeIngredients.length}`)
  
  // 9. Fornecedores
  const suppliers = await prisma.supplier.findMany()
  console.log(`Fornecedores: ${suppliers.length}`)
  
  // 10. Destaques da home
  const homeHighlights = await prisma.homeHighlight.findMany()
  console.log(`Destaques: ${homeHighlights.length}`)
  
  // 11. Departamentos
  const departments = await prisma.department.findMany()
  console.log(`Departamentos: ${departments.length}`)
  
  // 12. Cartões de crédito
  const creditCards = await prisma.creditCard.findMany()
  console.log(`Cartões de crédito: ${creditCards.length}`)
  
  // 13. Configurações de taxa de cartão
  const cardFeeConfigs = await prisma.cardFeeConfig.findMany()
  console.log(`Configurações de taxa: ${cardFeeConfigs.length}`)
  
  // 14. Cupons
  const coupons = await prisma.coupon.findMany()
  console.log(`Cupons: ${coupons.length}`)
  
  // 15. Configurações de recompensa
  const rewardConfigs = await prisma.rewardConfig.findMany()
  console.log(`Config. recompensas: ${rewardConfigs.length}`)
  
  // 16. Prêmios
  const prizes = await prisma.prize.findMany()
  console.log(`Prêmios: ${prizes.length}`)
  
  // 17. Feriados
  const holidays = await prisma.holiday.findMany()
  console.log(`Feriados: ${holidays.length}`)
  
  // 18. ProductionSupplyGlobal (insumos globais)
  const supplyGlobals = await prisma.productionSupplyGlobal.findMany()
  console.log(`Insumos globais: ${supplyGlobals.length}`)
  
  // 19. SupplyRecipeItem
  const supplyRecipeItems = await prisma.supplyRecipeItem.findMany()
  console.log(`Itens receitas de insumos: ${supplyRecipeItems.length}`)
  
  // Criar objeto com todos os dados
  const exportedData = {
    exportDate: new Date().toISOString(),
    appVersion: 'Espetos Genuino v1.0',
    data: {
      products,
      recipes,
      rawMaterials,
      expenseCategories,
      bankAccounts,
      supplies,
      supplyRecipes,
      recipeIngredients,
      suppliers,
      homeHighlights,
      departments,
      creditCards,
      cardFeeConfigs,
      coupons,
      rewardConfigs,
      prizes,
      holidays,
      supplyGlobals,
      supplyRecipeItems
    }
  }
  
  // Salvar em arquivo JSON
  fs.writeFileSync('/home/ubuntu/app_data_export.json', JSON.stringify(exportedData, null, 2))
  console.log('\n✅ Dados exportados para /home/ubuntu/app_data_export.json')
  
  await prisma.$disconnect()
}

exportData().catch(console.error)
