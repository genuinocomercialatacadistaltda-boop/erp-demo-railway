
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar todas as compras
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      customerId: null // 🏭 Apenas compras da fábrica/admin (não dos clientes)
    };
    
    if (status) {
      where.status = status;
    }
    
    if (supplierId) {
      where.supplierId = supplierId;
    }
    
    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) {
        where.purchaseDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.purchaseDate.lte = new Date(endDate);
      }
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            document: true,
            phone: true,
          },
        },
        BankAccount: {
          select: {
            id: true,
            name: true,
          },
        },
        PurchaseItem: {
          include: {
            RawMaterial: {
              select: {
                id: true,
                name: true,
                measurementUnit: true,
              },
            },
          },
        },
        PurchaseSupplyItems: {
          include: {
            Supply: {
              select: {
                id: true,
                name: true,
                unit: true,
                category: true,
              },
            },
          },
        },
      },
      orderBy: {
        purchaseDate: 'desc',
      },
    });

    // Função para formatar data sem timezone
    const formatDateOnly = (date: Date | null): string | null => {
      if (!date) return null;
      return date.toISOString().split('T')[0];
    };

    // Mapear os dados para o formato esperado pelo frontend
    const mappedPurchases = purchases.map((purchase: any) => ({
      id: purchase.id,
      supplier: purchase.Supplier || { id: '', name: 'Fornecedor não encontrado' },
      bankAccount: purchase.BankAccount || { id: '', name: 'Conta não encontrada' },
      totalAmount: purchase.totalAmount,
      status: purchase.status,
      paymentMethod: purchase.paymentMethod || '',
      purchaseDate: formatDateOnly(purchase.purchaseDate),
      dueDate: formatDateOnly(purchase.dueDate),
      paidAt: formatDateOnly(purchase.paymentDate), // Corrigido: era paymentDate no schema
      notes: purchase.notes,
      items: purchase.PurchaseItem.map((item: any) => ({
        id: item.id,
        material: {
          id: item.RawMaterial.id,
          name: item.RawMaterial.name,
          sku: '', // Adicionar se necessário
          unit: item.RawMaterial.measurementUnit,
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      supplyItems: purchase.PurchaseSupplyItems.map((item: any) => ({
        id: item.id,
        supply: {
          id: item.Supply.id,
          name: item.Supply.name,
          unit: item.Supply.unit,
          category: item.Supply.category,
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      createdAt: purchase.createdAt,
    }));

    return NextResponse.json(mappedPurchases);
  } catch (error) {
    console.error('Erro ao buscar compras:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar compras' },
      { status: 500 }
    );
  }
}

// POST - Criar nova compra
export async function POST(req: NextRequest) {
  try {
    console.log("🎯 POST /api/purchases CHAMADO");
    
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      console.log("❌ Acesso negado - usuário não é ADMIN");
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    console.log("✅ Usuário autenticado:", (session.user as any).email);

    const body = await req.json();
    console.log("📦 Body recebido:", JSON.stringify(body, null, 2));
    
    const {
      supplierId,
      items,
      supplyItems, // 🆕 Insumos
      productItems, // 🆕 Produtos acabados (revenda)
      supplyCategoryId, // 🏷️ Categoria selecionada para insumos (Temperos ou Embalagens)
      purchaseDate,
      dueDate,
      paymentMethod,
      bankAccountId,
      creditCardId, // 💳 Cartão de crédito
      installments = 1, // 💳 Número de parcelas
      installmentDueDates, // 📄 Datas de vencimento individuais para boleto parcelado
      invoiceNumber,
      invoiceUrl,
      notes,
      taxAmount = 0, // 🆕 Valor do imposto da nota
      expenseType = 'RAW_MATERIALS',
      status = 'PENDING',
    } = body;
    
    console.log("📋 Dados extraídos:", {
      supplierId,
      itemsCount: items?.length,
      supplyItemsCount: supplyItems?.length, // 🆕
      productItemsCount: productItems?.length, // 🆕 Produtos acabados
      purchaseDate,
      dueDate,
      paymentMethod,
      bankAccountId,
      taxAmount, // 🆕
      status,
      expenseType
    });

    // Validações
    if (!supplierId) {
      return NextResponse.json(
        { error: 'Fornecedor é obrigatório' },
        { status: 400 }
      );
    }

    // 💳 Validar cartão de crédito se for o método de pagamento
    if (paymentMethod === 'CARTAO_CREDITO' && !creditCardId) {
      return NextResponse.json(
        { error: 'Cartão de crédito é obrigatório para compras no cartão' },
        { status: 400 }
      );
    }

    // Validar que há pelo menos matérias-primas OU insumos OU produtos acabados
    if ((!items || items.length === 0) && (!supplyItems || supplyItems.length === 0) && (!productItems || productItems.length === 0)) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um item (matéria-prima, insumo ou produto acabado) à compra' },
        { status: 400 }
      );
    }

    if (!dueDate) {
      return NextResponse.json(
        { error: 'Data de vencimento é obrigatória' },
        { status: 400 }
      );
    }

    // Calcular total (matérias-primas + insumos + produtos acabados + impostos)
    const rawMaterialsTotal = (items || []).reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
    
    const suppliesTotal = (supplyItems || []).reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
    
    const productsTotal = (productItems || []).reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
    
    const totalAmount = rawMaterialsTotal + suppliesTotal + productsTotal + (taxAmount || 0);
    
    console.log("💰 Totais calculados:", {
      rawMaterialsTotal,
      suppliesTotal,
      productsTotal,
      taxAmount: taxAmount || 0,
      totalAmount
    });

    // Gerar número da compra de forma segura
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Buscar todas as compras do mês atual para garantir unicidade
    const currentMonthPurchases = await prisma.purchase.findMany({
      where: {
        purchaseNumber: {
          startsWith: `COMP-${yearMonth}-`
        }
      },
      orderBy: { purchaseNumber: 'desc' },
      take: 1
    });

    let purchaseCount = 1;
    if (currentMonthPurchases.length > 0) {
      const lastNumber = currentMonthPurchases[0].purchaseNumber;
      console.log('📋 [PURCHASE_NUMBER] Última compra encontrada:', lastNumber);
      try {
        const parts = lastNumber.split('-');
        console.log('📋 [PURCHASE_NUMBER] Parts do número:', parts);
        
        if (parts.length === 3 && parts[2]) {
          const lastCount = parseInt(parts[2], 10);
          console.log('📋 [PURCHASE_NUMBER] Último count parseado:', lastCount);
          
          if (!isNaN(lastCount) && lastCount > 0) {
            purchaseCount = lastCount + 1;
            console.log('📋 [PURCHASE_NUMBER] Próximo count será:', purchaseCount);
          } else {
            console.warn('⚠️ [PURCHASE_NUMBER] lastCount inválido (NaN ou <= 0), usando timestamp');
            purchaseCount = Date.now() % 10000;
          }
        } else {
          console.warn('⚠️ [PURCHASE_NUMBER] Formato de número inválido, usando timestamp');
          purchaseCount = Date.now() % 10000;
        }
      } catch (error) {
        console.error('❌ [PURCHASE_NUMBER] Erro ao parsear purchaseNumber:', error);
        // Se falhar o parsing, usar timestamp para garantir unicidade
        purchaseCount = Date.now() % 10000;
      }
    }
    
    // Garantir que purchaseCount é um número válido
    if (isNaN(purchaseCount) || purchaseCount <= 0) {
      console.error('❌ [PURCHASE_NUMBER] purchaseCount inválido após cálculo:', purchaseCount);
      purchaseCount = Date.now() % 10000;
    }
    
    console.log('📋 [PURCHASE_NUMBER] purchaseCount final antes do padStart:', purchaseCount, 'tipo:', typeof purchaseCount);
    
    // 🔄 RETRY LOOP: Tentar até 10 vezes para encontrar um número único
    let purchaseNumber = '';
    let attemptCount = 0;
    const maxAttempts = 10;
    
    while (attemptCount < maxAttempts) {
      purchaseNumber = `COMP-${yearMonth}-${String(purchaseCount + attemptCount).padStart(4, '0')}`;
      
      console.log(`📝 [PURCHASE_NUMBER] Tentativa ${attemptCount + 1}/${maxAttempts}:`, {
        yearMonth,
        purchaseCountBase: purchaseCount,
        attemptIncrement: attemptCount,
        finalCount: purchaseCount + attemptCount,
        generatedNumber: purchaseNumber,
        lastPurchaseFound: currentMonthPurchases.length > 0 ? currentMonthPurchases[0].purchaseNumber : 'nenhuma'
      });
      
      // 🔒 VERIFICAÇÃO: Garantir que o purchaseNumber não existe
      const existingPurchase = await prisma.purchase.findFirst({
        where: { purchaseNumber }
      });
      
      if (!existingPurchase) {
        console.log(`✅ [PURCHASE_NUMBER] Número único encontrado na tentativa ${attemptCount + 1}: ${purchaseNumber}`);
        break; // Número único encontrado!
      }
      
      console.warn(`⚠️ [PURCHASE_NUMBER] Tentativa ${attemptCount + 1} - Número ${purchaseNumber} já existe (ID: ${existingPurchase.id})`);
      attemptCount++;
    }
    
    // Se após 10 tentativas ainda não encontrou um número único, usar UUID
    if (attemptCount >= maxAttempts) {
      console.error('❌ [PURCHASE_NUMBER] Falha após 10 tentativas - usando UUID de fallback');
      const fallbackId = `${Date.now()}-${Math.random().toString(36).substring(7)}`.toUpperCase();
      purchaseNumber = `COMP-${yearMonth}-${fallbackId}`;
      console.log('🆘 [PURCHASE_NUMBER] Número de fallback gerado:', purchaseNumber);
    }

    // 💳 VALIDAÇÃO PRÉVIA: Verificar se cartão existe (sem bloquear por limite)
    if (paymentMethod === 'CARTAO_CREDITO' && creditCardId) {
      const cardValidation = await prisma.creditCard.findUnique({
        where: { id: creditCardId }
      });

      if (!cardValidation) {
        return NextResponse.json(
          { error: 'Cartão não encontrado' },
          { status: 404 }
        );
      }

      // ⚠️ AVISO: Não bloqueamos compra por limite insuficiente
      const currentAvailable = cardValidation.availableLimit || cardValidation.limit;
      if (cardValidation.limit && cardValidation.limit > 0 && currentAvailable < totalAmount) {
        console.warn(`⚠️ ALERTA: Compra de R$ ${totalAmount.toFixed(2)} excede limite disponível de R$ ${currentAvailable.toFixed(2)}`);
        console.warn(`⚠️ Cartão: ${cardValidation.name} - Permitindo compra mesmo assim`);
      }
    }

    // 💳 Se for cartão de crédito, processar despesas nas faturas
    if (paymentMethod === 'CARTAO_CREDITO' && creditCardId) {
      console.log("💳 Processando compra no cartão de crédito...");
      
      // Buscar cartão
      const card = await prisma.creditCard.findUnique({
        where: { id: creditCardId }
      });

      if (!card) {
        return NextResponse.json(
          { error: 'Cartão não encontrado' },
          { status: 404 }
        );
      }

      // Corrigir timezone da data de compra
      const [yearStr, monthStr, dayStr] = purchaseDate.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1;
      const purchaseDay = parseInt(dayStr);
      const purchaseDateObj = new Date(year, month, purchaseDay, 12, 0, 0);

      // Determinar mês de referência da fatura baseado no dia de fechamento
      let invoiceMonth = month;
      let invoiceYear = year;

      // Se a compra foi DEPOIS do dia de fechamento, vai para a fatura do mês seguinte
      if (purchaseDay > card.closingDay) {
        invoiceMonth = month + 1;
        if (invoiceMonth > 11) {
          invoiceMonth = 0;
          invoiceYear = year + 1;
        }
      }

      // 📦 Determinar tipo de compra baseado nos itens para cartão de crédito
      const hasRawMaterialsCC = items && items.length > 0 && items.some((item: any) => item.rawMaterialId);
      const hasSuppliesItemsCC = supplyItems && supplyItems.length > 0 && supplyItems.some((item: any) => item.supplyId);
      const hasProductsCC = productItems && productItems.length > 0 && productItems.some((item: any) => item.productId);
      
      console.log("🔍 [CARTÃO] Determinando categoria...");
      console.log(`   - Tem matéria-prima: ${hasRawMaterialsCC}`);
      console.log(`   - Tem insumos: ${hasSuppliesItemsCC}`);
      console.log(`   - Tem produtos acabados: ${hasProductsCC}`);
      console.log(`   - Categoria de insumo selecionada: ${supplyCategoryId || 'Nenhuma'}`);
      
      let category: any = null;
      let ccExpenseType: 'RAW_MATERIALS' | 'PRODUCTS' | 'OPERATIONAL' | 'INVESTMENT' | 'PROLABORE' | 'OTHER' = 'RAW_MATERIALS'; // Default
      let ccPurchaseLabel = 'Compra de Mercadoria'; // Default
      
      // 🏷️ Se for APENAS compra de insumos E tiver categoria selecionada, usar a categoria escolhida
      if (hasSuppliesItemsCC && !hasRawMaterialsCC && !hasProductsCC && supplyCategoryId) {
        category = await prisma.expenseCategory.findUnique({
          where: { id: supplyCategoryId },
        });
        if (category) {
          ccExpenseType = 'PRODUCTS'; // Insumos são PRODUCTS
          ccPurchaseLabel = category.name;
          console.log(`✅ [CARTÃO] Usando categoria de insumos: ${category.name} (${category.id}) - expenseType: PRODUCTS`);
        }
      }
      // Se for APENAS produtos acabados
      else if (hasProductsCC && !hasRawMaterialsCC && !hasSuppliesItemsCC) {
        category = await prisma.expenseCategory.findFirst({
          where: { name: 'Compra de Mercadoria' },
        });
        ccExpenseType = 'RAW_MATERIALS'; // Produtos para revenda são RAW_MATERIALS (Compras de Matéria-Prima)
        ccPurchaseLabel = 'Compra de Produtos (Revenda)';
        console.log(`✅ [CARTÃO] Compra de produtos acabados - expenseType: RAW_MATERIALS`);
      }
      
      // Se não encontrou categoria específica, usar a default "Compra de Mercadoria"
      if (!category) {
        category = await prisma.expenseCategory.findFirst({
          where: { name: 'Compra de Mercadoria' },
        });

        if (!category) {
          category = await prisma.expenseCategory.create({
            data: {
              name: 'Compra de Mercadoria',
              description: 'Compras de matérias-primas e produtos',
              color: '#10b981',
              isActive: true,
              expenseType: 'RAW_MATERIALS'
            }
          });
        }
        console.log(`✅ [CARTÃO] Usando categoria padrão: ${category.name} - expenseType: ${ccExpenseType}`);
      }

      // Descontar do limite do cartão
      if (card.limit && card.limit > 0) {
        const currentAvailable = card.availableLimit || card.limit;
        const newAvailable = currentAvailable - totalAmount;

        await prisma.creditCard.update({
          where: { id: creditCardId },
          data: { availableLimit: newAvailable }
        });
        console.log(`💰 Limite descontado: R$ ${currentAvailable.toFixed(2)} → R$ ${newAvailable.toFixed(2)}`);
      }

      // 🔒 PROTEÇÃO CONTRA DUPLICATAS: Verificar se já existem despesas para este purchaseNumber
      const existingExpenses = await prisma.creditCardExpense.findMany({
        where: { referenceNumber: purchaseNumber }
      });
      
      if (existingExpenses.length > 0) {
        console.warn(`⚠️ ALERTA: Já existem ${existingExpenses.length} despesas para ${purchaseNumber}`);
        console.warn(`⚠️ PULANDO criação de despesas duplicadas!`);
        // Retornar erro para evitar duplicatas
        return NextResponse.json(
          { error: `Despesas já existem para a compra ${purchaseNumber}. Evitando duplicatas.` },
          { status: 409 }
        );
      }

      // Criar despesas parceladas nas faturas
      const expenseAmount = totalAmount / installments;

      for (let i = 1; i <= installments; i++) {
        // Calcular mês da fatura para esta parcela
        let parcelaInvoiceMonth = invoiceMonth + (i - 1);
        let parcelaInvoiceYear = invoiceYear;

        while (parcelaInvoiceMonth > 11) {
          parcelaInvoiceMonth -= 12;
          parcelaInvoiceYear += 1;
        }

        const parcelaReferenceMonth = new Date(parcelaInvoiceYear, parcelaInvoiceMonth, 1);

        // Buscar ou criar fatura
        let invoice = await prisma.creditCardInvoice.findFirst({
          where: {
            creditCardId,
            referenceMonth: parcelaReferenceMonth,
            status: "OPEN"
          }
        });

        if (!invoice) {
          const closingDate = new Date(parcelaInvoiceYear, parcelaInvoiceMonth, card.closingDay);
          
          let dueYear = parcelaInvoiceYear;
          let dueMonth = parcelaInvoiceMonth + 1;
          if (dueMonth > 11) {
            dueMonth = 0;
            dueYear = parcelaInvoiceYear + 1;
          }
          
          const invoiceDueDate = new Date(dueYear, dueMonth, card.dueDay);

          invoice = await prisma.creditCardInvoice.create({
            data: {
              creditCardId,
              referenceMonth: parcelaReferenceMonth,
              closingDate,
              dueDate: invoiceDueDate,
              totalAmount: 0,
              status: "OPEN"
            }
          });
        }

        // Criar despesa
        const supplierData = await prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { name: true }
        });

        await prisma.creditCardExpense.create({
          data: {
            creditCardId,
            invoiceId: invoice.id,
            description: installments > 1 
              ? `Compra ${supplierData?.name || 'Fornecedor'} ${purchaseNumber} (${i}/${installments})`
              : `Compra ${supplierData?.name || 'Fornecedor'} ${purchaseNumber}`,
            amount: expenseAmount,
            purchaseDate: purchaseDateObj,
            categoryId: category.id,
            supplierName: supplierData?.name || null,
            referenceNumber: purchaseNumber,
            installments,
            installmentNumber: i,
            notes: notes || null,
            expenseType: ccExpenseType, // 🏷️ Usar tipo correto baseado nos itens
            createdBy: session.user?.email
          }
        });

        // Atualizar total da fatura
        await prisma.creditCardInvoice.update({
          where: { id: invoice.id },
          data: {
            totalAmount: {
              increment: expenseAmount
            }
          }
        });

        console.log(`💳 Parcela ${i}/${installments} criada: R$ ${expenseAmount.toFixed(2)} na fatura de ${parcelaReferenceMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
      }
    }

    // Criar compra em transação
    console.log("🔄 Iniciando transação...");
    
    const purchase = await prisma.$transaction(async (tx: any) => {
      // 📦 Determinar tipo de compra baseado nos itens ANTES de buscar categoria
      const hasRawMaterials = items && items.length > 0 && items.some((item: any) => item.rawMaterialId);
      const hasSuppliesItems = supplyItems && supplyItems.length > 0 && supplyItems.some((item: any) => item.supplyId);
      const hasProducts = productItems && productItems.length > 0 && productItems.some((item: any) => item.productId);
      
      console.log("🔍 Buscando categoria para a despesa...");
      console.log(`   - Tem matéria-prima: ${hasRawMaterials}`);
      console.log(`   - Tem insumos: ${hasSuppliesItems}`);
      console.log(`   - Tem produtos acabados: ${hasProducts}`);
      console.log(`   - Categoria de insumo selecionada: ${supplyCategoryId || 'Nenhuma'}`);
      
      let category: any = null;
      
      // 🏷️ Se for APENAS compra de insumos E tiver categoria selecionada, usar a categoria escolhida
      if (hasSuppliesItems && !hasRawMaterials && !hasProducts && supplyCategoryId) {
        category = await tx.expenseCategory.findUnique({
          where: { id: supplyCategoryId },
        });
        if (category) {
          console.log(`✅ Usando categoria selecionada para insumos: ${category.name} (${category.id})`);
        }
      }
      
      // Se não encontrou categoria específica, usar a default "Compra de Mercadoria"
      if (!category) {
        category = await tx.expenseCategory.findFirst({
          where: { name: 'Compra de Mercadoria' },
        });

        if (!category) {
          console.log("📝 Categoria 'Compra de Mercadoria' não encontrada, criando...");
          category = await tx.expenseCategory.create({
            data: {
              name: 'Compra de Mercadoria',
              description: 'Compras de matérias-primas e produtos',
              color: '#10b981',
              isActive: true,
            },
          });
          console.log("✅ Categoria criada:", category.id);
        } else {
          console.log("✅ Usando categoria 'Compra de Mercadoria':", category.id);
        }
      }

      // Buscar nome do fornecedor
      console.log("🔍 Buscando fornecedor:", supplierId);
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
      });
      
      if (!supplier) {
        console.log("❌ Fornecedor não encontrado:", supplierId);
        throw new Error(`Fornecedor com ID ${supplierId} não encontrado`);
      }
      console.log("✅ Fornecedor encontrado:", supplier.name);

      // Função para criar data sem problema de timezone
      const createSafeDate = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number);
        // Criar data em UTC às 12h (meio-dia) para evitar problemas de timezone
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      };

      // 📦 Determinar tipo e descrição da compra (reutilizando variáveis já calculadas acima)
      let purchaseTypeLabel = 'Compra de Mercadoria'; // Default
      let purchaseExpenseType = expenseType;
      
      if (hasSuppliesItems && !hasRawMaterials && !hasProducts) {
        // Apenas insumos - usar nome da categoria selecionada
        purchaseTypeLabel = category.name ? `Compra de ${category.name}` : 'Compra de Insumos';
        purchaseExpenseType = 'PRODUCTS'; // Insumos usam PRODUCTS (como temperos e embalagens)
      } else if (hasRawMaterials && !hasSuppliesItems && !hasProducts) {
        // Apenas matérias-primas
        purchaseTypeLabel = 'Compra de Matéria-Prima';
        purchaseExpenseType = 'RAW_MATERIALS';
      } else if (hasProducts && !hasRawMaterials && !hasSuppliesItems) {
        // Apenas produtos acabados (revenda)
        purchaseTypeLabel = 'Compra de Produtos (Revenda)';
        purchaseExpenseType = 'RAW_MATERIALS'; // Produtos para revenda usam RAW_MATERIALS (Compras de Matéria-Prima)
      } else if ((hasRawMaterials || hasSuppliesItems || hasProducts) && 
                 ((hasRawMaterials ? 1 : 0) + (hasSuppliesItems ? 1 : 0) + (hasProducts ? 1 : 0)) > 1) {
        // Compra mista
        purchaseTypeLabel = 'Compra Mista (Insumos/Mercadorias)';
      }
      
      console.log(`📦 Tipo de compra identificado: ${purchaseTypeLabel}`);

      // 💳 NÃO criar despesa para cartão de crédito (já está na fatura do cartão como CreditCardExpense)
      // Para outros métodos de pagamento, criar despesa normalmente
      let expense = null;
      const createdExpenses: any[] = [];
      
      // 📅 Calcular data de competência (mês da compra) - mesma para todas as parcelas
      const competenceDate = purchaseDate ? createSafeDate(purchaseDate) : new Date();
      console.log(`📅 Competência de todas as parcelas: ${competenceDate.toISOString().split('T')[0]}`);
      
      if (paymentMethod !== 'CARTAO_CREDITO') {
        // 📄 Verificar se é parcelamento para boleto ou outros métodos
        const numInstallments = installments || 1;
        const installmentAmount = totalAmount / numInstallments;
        
        // 📄 Verificar se temos datas individuais de vencimento (boleto parcelado)
        const hasCustomDueDates = installmentDueDates && Array.isArray(installmentDueDates) && installmentDueDates.length >= numInstallments;
        
        console.log(`💰 Criando ${numInstallments} despesa(s) no financeiro...`);
        console.log(`📅 Usando datas de vencimento ${hasCustomDueDates ? 'INDIVIDUAIS' : 'CALCULADAS (mensais)'}`);
        
        for (let i = 1; i <= numInstallments; i++) {
          // Calcular data de vencimento para cada parcela
          let installmentDueDate: Date;
          
          if (hasCustomDueDates && installmentDueDates[i - 1]) {
            // 📅 Usar data individual informada pelo usuário
            installmentDueDate = createSafeDate(installmentDueDates[i - 1]);
            console.log(`📅 Parcela ${i}: vencimento individual: ${installmentDueDates[i - 1]}`);
          } else {
            // 📅 Fallback: calcular data mensal a partir da data de vencimento base
            installmentDueDate = createSafeDate(dueDate);
            if (i > 1) {
              installmentDueDate = new Date(installmentDueDate);
              installmentDueDate.setMonth(installmentDueDate.getMonth() + (i - 1));
            }
            console.log(`📅 Parcela ${i}: vencimento calculado (mensal)`);
          }
          
          const installmentDescription = numInstallments > 1 
            ? `${purchaseTypeLabel} - ${supplier.name} (${i}/${numInstallments})`
            : `${purchaseTypeLabel} - ${supplier.name}`;
          
          console.log(`📄 Parcela ${i}/${numInstallments}:`, {
            description: installmentDescription,
            amount: installmentAmount,
            dueDate: installmentDueDate.toISOString().split('T')[0],
            competenceDate: competenceDate.toISOString().split('T')[0],
          });
          
          const createdExpense = await tx.expense.create({
            data: {
              description: installmentDescription,
              amount: installmentAmount,
              categoryId: category.id,
              bankAccountId: bankAccountId || null,
              supplierId: supplierId,
              dueDate: installmentDueDate,
              competenceDate: competenceDate, // 📅 Mesma competência para todas as parcelas
              paymentDate: status === 'PAID' ? new Date() : null,
              status: status,
              expenseType: purchaseExpenseType,
              paymentMethod: paymentMethod,
              notes: numInstallments > 1 ? `${notes || ''} [Parcela ${i}/${numInstallments}]`.trim() : notes,
              referenceNumber: invoiceNumber,
              attachmentUrl: invoiceUrl,
              createdBy: (session.user as any).email,
            },
          });
          
          createdExpenses.push(createdExpense);
          console.log(`✅ Despesa ${i}/${numInstallments} criada: ${createdExpense.id}`);
        }
        
        // Usar a primeira despesa como referência para a compra
        expense = createdExpenses[0];
        console.log(`✅ Total de ${createdExpenses.length} despesa(s) criada(s) automaticamente`);
      } else {
        console.log('💳 Cartão de crédito - NÃO criando despesa (valor já está na fatura do cartão)');
      }

      // Criar a compra vinculada à despesa (se existir)
      console.log("📦 Criando compra...");
      console.log("Dados da compra:", {
        purchaseNumber,
        supplierId,
        totalAmount,
        status,
        expenseType,
        purchaseDate: purchaseDate ? createSafeDate(purchaseDate) : new Date(),
        dueDate: createSafeDate(dueDate),
        paymentMethod,
        bankAccountId,
        expenseId: expense?.id || null, // 💳 null para cartão de crédito
        itemsCount: items.length
      });
      
      const newPurchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId,
          customerId: null, // 🏭 Compra da fábrica/admin (não do cliente)
          totalAmount,
          taxAmount: taxAmount || 0, // 🆕 Valor do imposto da nota
          status,
          expenseType,
          purchaseDate: purchaseDate ? createSafeDate(purchaseDate) : new Date(),
          dueDate: createSafeDate(dueDate),
          paymentDate: status === 'PAID' ? new Date() : null,
          paymentMethod,
          bankAccountId,
          expenseId: expense?.id || null, // 💳 null para cartão de crédito (despesas nas faturas)
          invoiceNumber,
          invoiceUrl,
          notes,
          createdBy: (session.user as any).email,
          paidBy: status === 'PAID' ? (session.user as any).email : null,
          PurchaseItem: items && items.length > 0 ? {
            create: items.map((item: any) => ({
              rawMaterialId: item.rawMaterialId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              notes: item.notes,
            })),
          } : undefined,
          PurchaseSupplyItems: supplyItems && supplyItems.length > 0 ? {
            create: supplyItems.map((item: any) => ({
              supplyId: item.supplyId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              notes: item.notes,
            })),
          } : undefined,
        },
        include: {
          Supplier: true,
          BankAccount: true,
          Expense: {
            include: {
              Category: true,
            },
          },
          PurchaseItem: {
            include: {
              RawMaterial: true,
            },
          },
          PurchaseSupplyItems: {
            include: {
              Supply: true,
            },
          },
        },
      });

      if (expense) {
        console.log('✅ Compra criada e vinculada à despesa:', newPurchase.id, '→', expense.id);
      } else {
        console.log('✅ Compra criada (sem despesa normal - cartão de crédito):', newPurchase.id);
      }

      // Atualizar estoque das matérias-primas e registrar mudanças de custo
      console.log("📊 Atualizando estoque das matérias-primas...");
      for (const item of (items || [])) {
        console.log(`Atualizando matéria-prima ${item.rawMaterialId}: +${item.quantity}`);
        
        // Buscar custo atual antes da atualização
        const currentMaterial = await tx.rawMaterial.findUnique({
          where: { id: item.rawMaterialId },
          select: { costPerUnit: true, name: true },
        });
        
        const oldCost = Number(currentMaterial?.costPerUnit || 0);
        const newCost = Number(item.unitPrice);
        
        // 🔧 REGRA DE NEGÓCIO: Só atualiza o preço de custo se o novo preço for MAIOR que o atual
        // Se comprou mais barato, mantém o preço de custo atual (não reduz)
        const shouldUpdateCost = newCost > oldCost;
        const finalCost = shouldUpdateCost ? newCost : oldCost;
        
        if (shouldUpdateCost) {
          console.log(`💰 Preço de compra MAIOR - Atualizando custo: ${currentMaterial?.name} R$ ${oldCost.toFixed(2)} → R$ ${newCost.toFixed(2)}`);
        } else {
          console.log(`✅ Preço de compra MENOR/IGUAL - Mantendo custo atual: ${currentMaterial?.name} R$ ${oldCost.toFixed(2)} (compra: R$ ${newCost.toFixed(2)})`);
        }
        
        // Atualizar matéria-prima (estoque sempre atualiza, custo só se maior)
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: {
            currentStock: {
              increment: item.quantity,
            },
            ...(shouldUpdateCost && { costPerUnit: newCost }),
          },
        });
        
        // Registrar mudança de custo SOMENTE se houve alteração (preço maior)
        if (shouldUpdateCost && Math.abs(oldCost - newCost) > 0.01) {
          console.log(`📝 Registrando histórico de custo: ${currentMaterial?.name} ${oldCost} → ${newCost}`);
          
          await tx.costHistory.create({
            data: {
              rawMaterialId: item.rawMaterialId,
              oldCost,
              newCost,
              reason: 'PURCHASE',
              purchaseId: newPurchase.id,
              notes: `Compra ${purchaseNumber} - ${supplier.name}`,
            },
          });
          
          // Buscar receitas que usam esta matéria-prima
          const affectedRecipes = await tx.recipe.findMany({
            where: {
              Ingredients: {
                some: {
                  rawMaterialId: item.rawMaterialId,
                },
              },
            },
            select: { id: true },
          });
          
          // Atualizar lastCostUpdate das receitas afetadas
          if (affectedRecipes.length > 0) {
            console.log(`📋 Atualizando ${affectedRecipes.length} receita(s) que usam ${currentMaterial?.name}`);
            
            await tx.recipe.updateMany({
              where: {
                id: {
                  in: affectedRecipes.map((r: any) => r.id),
                },
              },
              data: {
                lastCostUpdate: new Date(),
              },
            });
          }
        }
      }
      console.log("✅ Estoque de matérias-primas atualizado");

      // 🆕 Atualizar estoque dos insumos
      console.log("📦 Atualizando estoque dos insumos...");
      for (const item of (supplyItems || [])) {
        console.log(`Atualizando insumo ${item.supplyId}: +${item.quantity}`);
        
        // Buscar custo atual do insumo antes da atualização
        const currentSupply = await tx.productionSupplyGlobal.findUnique({
          where: { id: item.supplyId },
          select: { costPerUnit: true, name: true, currentStock: true },
        });
        
        const oldCost = currentSupply?.costPerUnit || 0;
        const newCost = item.unitPrice;
        
        // Atualizar insumo (estoque e custo)
        const updatedSupply = await tx.productionSupplyGlobal.update({
          where: { id: item.supplyId },
          data: {
            currentStock: {
              increment: item.quantity,
            },
            costPerUnit: newCost,
          },
        });
        
        // Registrar movimentação de estoque do insumo
        await tx.supplyMovement.create({
          data: {
            supplyId: item.supplyId,
            type: 'IN',
            quantity: item.quantity,
            reason: 'PURCHASE',
            reference: newPurchase.id,
            notes: `Compra ${purchaseNumber} - ${supplier.name}`,
            createdBy: (session.user as any).email,
          },
        });
        
        console.log(`✅ Insumo atualizado: ${currentSupply?.name} - Estoque: ${currentSupply?.currentStock} → ${updatedSupply.currentStock}, Custo: R$ ${oldCost.toFixed(2)} → R$ ${newCost.toFixed(2)}`);
      }
      console.log("✅ Estoque de insumos atualizado");

      // 🆕 Atualizar estoque dos produtos acabados (revenda)
      console.log("📦 Atualizando estoque dos produtos acabados...");
      for (const item of (productItems || [])) {
        console.log(`Atualizando produto ${item.productId}: +${item.quantity}`);
        
        // Buscar produto atual
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true, currentStock: true },
        });
        
        if (currentProduct) {
          const previousStock = currentProduct.currentStock || 0;
          const newStock = previousStock + item.quantity;
          
          // Atualizar estoque do produto
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: newStock,
            },
          });
          
          // Registrar movimentação de estoque
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: 'ENTRY',
              quantity: item.quantity,
              previousStock: previousStock,
              newStock: newStock,
              reason: `Compra ${purchaseNumber} - ${supplier.name}`,
              notes: `Entrada de estoque via compra de produto acabado`,
              referenceId: newPurchase.id,
              performedBy: (session.user as any).email,
            },
          });
          
          console.log(`✅ Produto atualizado: ${currentProduct.name} - Estoque: ${previousStock} → ${newStock}`);
        }
      }
      console.log("✅ Estoque de produtos acabados atualizado");

      // Se já foi pago, registrar transação bancária (exceto cartão de crédito)
      if (status === 'PAID' && bankAccountId && paymentMethod !== 'CARTAO_CREDITO') {
        // Deduzir do saldo da conta bancária
        const updatedAccount = await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            balance: {
              decrement: totalAmount,
            },
          },
        });

        // Registrar transação
        await tx.transaction.create({
          data: {
            bankAccountId,
            type: 'EXPENSE',
            amount: totalAmount,
            description: `Compra ${purchaseNumber} - ${supplier?.name || 'Fornecedor'}`,
            referenceId: newPurchase.id,
            referenceType: 'PURCHASE',
            category: expenseType,
            date: new Date(),
            balanceAfter: updatedAccount.balance,
            createdBy: (session.user as any).email,
          },
        });

        console.log('💳 Transação bancária registrada para compra paga');
      } else if (paymentMethod === 'CARTAO_CREDITO') {
        console.log('💳 Compra no cartão - transação bancária não registrada (será paga na fatura)');
      }

      return newPurchase;
    });

    console.log("🎉 Compra criada com sucesso!");
    return NextResponse.json(purchase, { status: 201 });
  } catch (error: any) {
    console.error('💥 ERRO AO CRIAR COMPRA:', error);
    console.error('Stack trace:', error?.stack);
    console.error('Mensagem:', error?.message);
    console.error('Código:', error?.code);
    console.error('Meta:', error?.meta);
    
    // Retornar erro mais detalhado
    return NextResponse.json(
      { 
        error: 'Erro ao criar compra',
        details: error?.message || 'Erro desconhecido',
        code: error?.code
      },
      { status: 500 }
    );
  }
}
