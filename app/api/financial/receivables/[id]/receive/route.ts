export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// POST - Receber/Baixar conta a receber
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();

    console.log('[RECEIVE] 🔍 Verificando se ID é receivable ou boleto...');
    console.log('[RECEIVE] ID recebido:', params.id);

    // 🎯 TENTAR BUSCAR COMO RECEIVABLE PRIMEIRO
    let receivable = await prisma.receivable.findUnique({
      where: { id: params.id },
    });

    // 🎯 SE NÃO ENCONTROU, PODE SER UM BOLETO!
    if (!receivable) {
      console.log('[RECEIVE] ❌ Receivable não encontrado, verificando se é BOLETO...');
      
      const boleto = await prisma.boleto.findUnique({
        where: { id: params.id },
        include: {
          Customer: true,
          Order: true
        }
      });

      if (boleto) {
        console.log('[RECEIVE] ✅ É um BOLETO! Processando pagamento de boleto...');
        console.log('[RECEIVE] Boleto:', boleto.boletoNumber, 'Cliente:', boleto.Customer?.name);
        
        // 🎯 PROCESSAR PAGAMENTO DE BOLETO
        const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
        const paymentAmount = body.paymentAmount ? parseFloat(body.paymentAmount) : Number(boleto.amount);
        const interestAmount = body.interestAmount ? parseFloat(body.interestAmount) : 0;
        const fineAmount = body.fineAmount ? parseFloat(body.fineAmount) : 0;
        const feeAmount = body.feeAmount ? parseFloat(body.feeAmount) : 0;
        const netAmount = paymentAmount - feeAmount;
        
        // ✅ CORREÇÃO: Arredondar valores para evitar problemas de precisão decimal
        const roundedBoletoAmount = Math.round(Number(boleto.amount) * 100) / 100;
        const roundedPaymentAmount = Math.round(paymentAmount * 100) / 100;
        const roundedInterestAmount = Math.round(interestAmount * 100) / 100;
        const roundedFineAmount = Math.round(fineAmount * 100) / 100;
        
        // 🔧 CORREÇÃO: Calcular saldo restante considerando juros e multa
        const totalWithCharges = Math.round((roundedBoletoAmount + roundedInterestAmount + roundedFineAmount) * 100) / 100;
        const remainingBalance = Math.round((totalWithCharges - roundedPaymentAmount) * 100) / 100;
        
        // ✅ Tolerância de 1 centavo para considerar pagamento integral
        const tolerance = 0.01;
        const isPartialPayment = remainingBalance > tolerance;
        
        console.log('[RECEIVE] Valor do boleto:', roundedBoletoAmount);
        console.log('[RECEIVE] Valor pago:', roundedPaymentAmount);
        console.log('[RECEIVE] Juros:', roundedInterestAmount);
        console.log('[RECEIVE] Multa:', roundedFineAmount);
        console.log('[RECEIVE] Total com encargos:', totalWithCharges);
        console.log('[RECEIVE] Saldo restante:', remainingBalance);
        console.log('[RECEIVE] É pagamento parcial?', isPartialPayment);
        console.log('[RECEIVE] Taxa:', feeAmount);
        console.log('[RECEIVE] Valor líquido:', netAmount);
        
        // Atualizar boleto e gerenciar crédito do cliente
        const updatedBoleto = await prisma.$transaction(async (tx) => {
          let newReceivableId: string | null = null;
          
          // 🔧 PAGAMENTO PARCIAL: Criar receivable para saldo restante
          if (isPartialPayment) {
            console.log('[RECEIVE] 💰 PAGAMENTO PARCIAL - Criando receivable para saldo restante...');
            
            // Criar receivable para o saldo restante
            const newReceivable = await tx.receivable.create({
              data: {
                description: `Saldo Boleto ${boleto.boletoNumber} - ${boleto.Customer?.name || 'Cliente'}`,
                amount: remainingBalance,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
                status: 'PENDING',
                customerId: boleto.customerId || null,
                orderId: boleto.orderId || null,
                notes: `Saldo restante do boleto ${boleto.boletoNumber} (Total: R$ ${roundedBoletoAmount.toFixed(2)}, Pago: R$ ${roundedPaymentAmount.toFixed(2)})`
              }
            });
            newReceivableId = newReceivable.id;
            console.log('[RECEIVE] ✅ Receivable criado para saldo restante:', newReceivableId);
            console.log('[RECEIVE]    Valor: R$', remainingBalance.toFixed(2));
          }
          
          // Marcar boleto como pago (sempre marca como PAID, mas guarda o valor realmente pago)
          const paidBoleto = await tx.boleto.update({
            where: { id: params.id },
            data: {
              status: 'PAID',
              paidDate: paymentDate,
              paidAmount: roundedPaymentAmount, // 🔧 GUARDAR VALOR REALMENTE PAGO
              paidBy: (session.user as any)?.name || (session.user as any)?.email,
              notes: isPartialPayment 
                ? `Pagamento parcial de R$ ${roundedPaymentAmount.toFixed(2)} (saldo restante: R$ ${remainingBalance.toFixed(2)}). ${body.notes || ''}`
                : body.notes || boleto.notes
            },
            include: {
              Customer: true,
              Order: true
            }
          });
          
          // 🔧 CORREÇÃO CRÍTICA: Restaurar crédito apenas do valor REALMENTE PAGO
          // Se for pagamento parcial, restaura apenas o valor pago (o saldo vai ficar em aberto no receivable)
          const creditToRestore = roundedPaymentAmount;
          
          if (boleto.customerId) {
            const customer = await tx.customer.findUnique({
              where: { id: boleto.customerId },
              select: { availableCredit: true, creditLimit: true }
            });
            
            if (customer) {
              const newAvailableCredit = Number(customer.availableCredit) + creditToRestore;
              const finalAvailableCredit = Math.min(newAvailableCredit, Number(customer.creditLimit));
              
              await tx.customer.update({
                where: { id: boleto.customerId },
                data: { availableCredit: finalAvailableCredit }
              });
              
              console.log('[RECEIVE] ✅ Crédito restaurado para o cliente:', boleto.Customer?.name);
              console.log('[RECEIVE]    Valor restaurado: R$', creditToRestore.toFixed(2), isPartialPayment ? '(PARCIAL)' : '(INTEGRAL)');
              console.log('[RECEIVE]    Crédito anterior:', customer.availableCredit);
              console.log('[RECEIVE]    Crédito novo:', finalAvailableCredit);
              
              if (newAvailableCredit > Number(customer.creditLimit)) {
                console.log('[RECEIVE] ⚠️ Crédito limitado ao máximo permitido:', customer.creditLimit);
              }
            }
          }
          
          // Se tiver conta bancária, registrar entrada
          if (body.bankAccountId) {
            const bankAccount = await tx.bankAccount.update({
              where: { id: body.bankAccountId },
              data: {
                balance: {
                  increment: netAmount
                }
              }
            });
            
            // Criar transação bancária
            const transactionDescription = isPartialPayment
              ? `Recebimento parcial Boleto ${boleto.boletoNumber} (R$ ${roundedPaymentAmount.toFixed(2)} de R$ ${roundedBoletoAmount.toFixed(2)})`
              : `Recebimento Boleto ${boleto.boletoNumber}`;
            
            await tx.transaction.create({
              data: {
                bankAccountId: body.bankAccountId,
                type: 'INCOME',
                amount: netAmount,
                date: paymentDate,
                description: transactionDescription,
                notes: isPartialPayment 
                  ? `Saldo restante: R$ ${remainingBalance.toFixed(2)}. ${body.notes || ''}` 
                  : body.notes || null,
                referenceType: 'BOLETO',
                referenceId: boleto.id,
                balanceAfter: bankAccount.balance
              }
            });
            console.log('[RECEIVE] ✅ Transação bancária criada');
          }
          
          return { boleto: paidBoleto, newReceivableId };
        });
        
        console.log('[RECEIVE] ✅ Boleto recebido com sucesso!');
        if (isPartialPayment) {
          console.log('[RECEIVE] ⚠️ ATENÇÃO: Pagamento parcial - receivable criado para saldo restante');
        }
        
        // Retornar no mesmo formato que receivables
        return NextResponse.json({
          id: updatedBoleto.boleto.id,
          status: updatedBoleto.boleto.status,
          paymentDate: updatedBoleto.boleto.paidDate,
          amount: roundedBoletoAmount,
          paidAmount: roundedPaymentAmount,
          netAmount: netAmount,
          feeAmount: feeAmount,
          interestAmount: roundedInterestAmount,
          fineAmount: roundedFineAmount,
          isPartialPayment: isPartialPayment,
          remainingBalance: isPartialPayment ? remainingBalance : 0,
          newReceivableId: updatedBoleto.newReceivableId
        });
      }
      
      // Se não é receivable NEM boleto, retornar 404
      console.log('[RECEIVE] ❌ Não é receivable nem boleto!');
      return NextResponse.json(
        { error: "Conta a receber não encontrada" },
        { status: 404 }
      );
    }
    
    console.log('[RECEIVE] ✅ É um RECEIVABLE! Processando normalmente...');

    if (receivable.status === "PAID") {
      return NextResponse.json(
        { error: "Esta conta já foi recebida" },
        { status: 400 }
      );
    }

    // Valor do pagamento (pode ser parcial)
    const paymentAmount = body.paymentAmount ? parseFloat(body.paymentAmount) : receivable.amount;
    
    // 🆕 Juros e multa por atraso
    const interestAmount = body.interestAmount ? parseFloat(body.interestAmount) : 0;
    const fineAmount = body.fineAmount ? parseFloat(body.fineAmount) : 0;
    
    // Calcular valor líquido (descontar taxa se informada)
    const feeAmount = body.feeAmount ? parseFloat(body.feeAmount) : 0;
    const netAmount = paymentAmount - feeAmount;

    // ✅ CORREÇÃO: Arredondar valores para evitar problemas de precisão decimal
    const roundedReceivableAmount = Math.round(Number(receivable.amount) * 100) / 100;
    const roundedPaymentAmount = Math.round(paymentAmount * 100) / 100;
    const roundedInterestAmount = Math.round(interestAmount * 100) / 100;
    const roundedFineAmount = Math.round(fineAmount * 100) / 100;
    
    // 🔧 CORREÇÃO: Calcular saldo restante considerando juros e multa
    // O total a receber agora é: valor original + juros + multa
    const totalWithCharges = Math.round((roundedReceivableAmount + roundedInterestAmount + roundedFineAmount) * 100) / 100;
    const remainingBalance = Math.round((totalWithCharges - roundedPaymentAmount) * 100) / 100;
    
    // ✅ Tolerância de 1 centavo para considerar pagamento integral
    const tolerance = 0.01;
    const isPartialPayment = remainingBalance > tolerance;

    console.log('💰 [RECEIVE] Processando recebimento com encargos:');
    console.log('   Valor original (bruto):', receivable.amount);
    console.log('   Valor original (arredondado):', roundedReceivableAmount);
    console.log('   Juros:', roundedInterestAmount);
    console.log('   Multa:', roundedFineAmount);
    console.log('   Total com encargos:', totalWithCharges);
    console.log('   Valor pago:', roundedPaymentAmount);
    console.log('   Saldo restante:', remainingBalance);
    console.log('   É pagamento parcial?', isPartialPayment, '(tolerância:', tolerance, ')');

    // Atualizar conta a receber
    let updated;
    let paidReceivableId: string | null = null; // 🔗 Guardar ID para vincular à transação bancária
    
    if (isPartialPayment) {
      // Pagamento parcial - criar registro do valor recebido e atualizar saldo restante
      
      // 1. Criar uma nova entrada para o valor RECEBIDO (para histórico)
      const paidReceivable = await prisma.receivable.create({
        data: {
          description: `${receivable.description} - Pagamento Parcial`,
          amount: roundedPaymentAmount, // ✅ Usar valor arredondado
          dueDate: receivable.dueDate,
          paymentDate: new Date(body.paymentDate || new Date()),
          status: "PAID",
          paymentMethod: body.paymentMethod,
          bankAccountId: body.bankAccountId,
          feeAmount: feeAmount,
          netAmount: netAmount,
          interestAmount: roundedInterestAmount, // ✅ Usar valor arredondado
          fineAmount: roundedFineAmount, // ✅ Usar valor arredondado
          customerId: receivable.customerId || null,
          orderId: receivable.orderId,
          isInstallment: receivable.isInstallment,
          installmentNumber: receivable.installmentNumber,
          totalInstallments: receivable.totalInstallments,
          notes: body.notes 
            ? `Pagamento parcial de R$ ${roundedPaymentAmount.toFixed(2)}${roundedInterestAmount > 0 || roundedFineAmount > 0 ? ` (Juros: R$ ${roundedInterestAmount.toFixed(2)} | Multa: R$ ${roundedFineAmount.toFixed(2)})` : ''}. ${body.notes}`
            : `Pagamento parcial de R$ ${roundedPaymentAmount.toFixed(2)}${roundedInterestAmount > 0 || roundedFineAmount > 0 ? ` (Juros: R$ ${roundedInterestAmount.toFixed(2)} | Multa: R$ ${roundedFineAmount.toFixed(2)})` : ''}`,
          paidBy: (session.user as any)?.id,
        },
      });
      
      // 🔗 Guardar o ID da entrada parcial para vincular à transação bancária
      paidReceivableId = paidReceivable.id;
      console.log('✅ Pagamento parcial criado com ID:', paidReceivableId);

      // 2. Atualizar a conta original com o saldo restante
      updated = await prisma.receivable.update({
        where: { id: params.id },
        data: {
          amount: remainingBalance, // Atualiza para o saldo restante
          status: "PENDING", // Mantém como pendente
          notes: receivable.notes 
            ? `${receivable.notes}\n[${new Date().toLocaleDateString("pt-BR")}] Saldo após pagamento parcial`
            : `[${new Date().toLocaleDateString("pt-BR")}] Saldo após pagamento parcial`,
        },
      });
    } else {
      // Pagamento integral
      updated = await prisma.receivable.update({
        where: { id: params.id },
        data: {
          status: "PAID",
          paymentDate: new Date(body.paymentDate || new Date()),
          paymentMethod: body.paymentMethod,
          bankAccountId: body.bankAccountId,
          feeAmount: feeAmount,
          netAmount: netAmount,
          interestAmount: roundedInterestAmount, // ✅ Usar valor arredondado
          fineAmount: roundedFineAmount, // ✅ Usar valor arredondado
          notes: body.notes 
            ? `${body.notes}${roundedInterestAmount > 0 || roundedFineAmount > 0 ? ` (Juros: R$ ${roundedInterestAmount.toFixed(2)} | Multa: R$ ${roundedFineAmount.toFixed(2)})` : ''}`
            : receivable.notes,
          paidBy: (session.user as any)?.id,
        },
      });

      console.log('[RECEIVABLE_RECEIVE] ✅ Receivable marcado como PAID:', receivable.id)
      console.log('[RECEIVABLE_RECEIVE] Cliente:', receivable.customerId)
      console.log('[RECEIVABLE_RECEIVE] Valor:', receivable.amount)

      // 🔧 CORREÇÃO CRÍTICA: Verificar se boleto vinculado estava pago ANTES de restaurar crédito
      let boletoJaEstavaPago = false
      
      if (receivable.boletoId) {
        console.log('[RECEIVABLE_RECEIVE] 📋 Boleto vinculado encontrado:', receivable.boletoId)
        
        const boleto = await prisma.boleto.findUnique({
          where: { id: receivable.boletoId }
        })
        
        if (boleto) {
          boletoJaEstavaPago = boleto.status === 'PAID'
          console.log('[RECEIVABLE_RECEIVE] Status do boleto ANTES:', boleto.status)
          
          if (boleto.status !== 'PAID') {
            await prisma.boleto.update({
              where: { id: receivable.boletoId },
              data: {
                status: 'PAID',
                paidDate: new Date(body.paymentDate || new Date()),
                updatedAt: new Date()
              }
            })
            console.log('[RECEIVABLE_RECEIVE] ✅ Boleto atualizado para PAID:', boleto.boletoNumber)
            console.log('[RECEIVABLE_RECEIVE] Status anterior:', boleto.status, '→ PAID')
          } else {
            console.log('[RECEIVABLE_RECEIVE] ℹ️ Boleto já estava PAID:', boleto.boletoNumber)
          }
        }
      }

      // ✅ CORREÇÃO CRÍTICA: SEMPRE restaurar limite do cliente, a menos que o boleto JÁ ESTAVA pago
      // (Se boleto já estava pago, o webhook Cora já devolveu o crédito antes)
      const deveRestaurarCredito = !boletoJaEstavaPago
      
      console.log('[RECEIVABLE_RECEIVE] 💰 Deve restaurar crédito?', deveRestaurarCredito)
      console.log('[RECEIVABLE_RECEIVE] Motivo:', boletoJaEstavaPago ? 'Boleto já estava PAID (crédito já foi devolvido)' : 'Primeira vez marcando como pago')
      
      if (deveRestaurarCredito && receivable.customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: receivable.customerId },
          select: {
            availableCredit: true,
            creditLimit: true,
          },
        })

        if (customer) {
          // ✅ Calcular novo crédito usando valor arredondado, garantindo que não exceda o limite
          const newAvailableCredit = Number(customer.availableCredit) + roundedReceivableAmount;
          const finalAvailableCredit = Math.min(newAvailableCredit, Number(customer.creditLimit));

          await prisma.customer.update({
            where: { id: receivable.customerId },
            data: {
              availableCredit: finalAvailableCredit,
            },
          })

          console.log('[RECEIVABLE_RECEIVE] ✅ LIMITE RESTAURADO')
          console.log('[RECEIVABLE_RECEIVE] Crédito anterior:', customer.availableCredit)
          console.log('[RECEIVABLE_RECEIVE] Valor do receivable:', receivable.amount)
          console.log('[RECEIVABLE_RECEIVE] Crédito calculado:', newAvailableCredit)
          console.log('[RECEIVABLE_RECEIVE] Limite do cliente:', customer.creditLimit)
          console.log('[RECEIVABLE_RECEIVE] Crédito final:', finalAvailableCredit)
          
          if (newAvailableCredit > customer.creditLimit) {
            console.log('[RECEIVABLE_RECEIVE] ⚠️ LIMITE EXCEDIDO! Crédito ajustado para respeitar o limite')
          }
        }
      } else if (!deveRestaurarCredito) {
        console.log('[RECEIVABLE_RECEIVE] ℹ️ Crédito NÃO restaurado - Boleto já estava pago (webhook Cora já devolveu o crédito antes)')
      }

      // ✅ CORREÇÃO: Atualizar status de pagamento do pedido quando receivable for totalmente pago
      if (receivable.orderId) {
        console.log('💰 [CORREÇÃO] Receivable totalmente pago - Atualizando order.paymentStatus para PAID')
        
        // Verificar se todos os receivables deste pedido estão pagos
        const allReceivables = await prisma.receivable.findMany({
          where: { orderId: receivable.orderId }
        });
        
        const allPaid = allReceivables.every(r => 
          r.id === params.id || r.status === 'PAID'
        );
        
        if (allPaid) {
          await prisma.order.update({
            where: { id: receivable.orderId },
            data: { 
              paymentStatus: 'PAID',
              updatedAt: new Date()
            }
          });
          console.log('   ✅ Order.paymentStatus atualizado para PAID')
        } else {
          console.log('   ⚠️ Ainda existem receivables pendentes para este pedido')
        }
      }
    }

    // Criar transação na conta bancária
    // ⚠️ NÃO criar transação se for pagamento com CARTÃO (deve ir pro gestor de cartões primeiro)
    const paymentMethod = body.paymentMethod || receivable.paymentMethod
    const isCardPayment = paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT' || paymentMethod === 'CARD'
    
    if (body.bankAccountId && !isCardPayment) {
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id: body.bankAccountId },
      });

      if (bankAccount) {
        const newBalance = bankAccount.balance + netAmount;

        const transactionDescription = isPartialPayment
          ? `Recebimento parcial: ${receivable.description} (R$ ${paymentAmount.toFixed(2)} de R$ ${(paymentAmount + remainingBalance).toFixed(2)})`
          : `Recebimento: ${receivable.description}`;

        const transactionNotes = [];
        if (feeAmount > 0) transactionNotes.push(`Taxa: R$ ${feeAmount.toFixed(2)}`);
        if (isPartialPayment) transactionNotes.push(`Saldo restante: R$ ${remainingBalance.toFixed(2)}`);

        // 🔗 CORREÇÃO CRÍTICA: Usar ID da entrada parcial se for pagamento parcial
        // Isso permite que a reversão encontre a transação correta
        const transactionReferenceId = paidReceivableId || receivable.id;
        console.log('🔗 Transação será vinculada ao receivable ID:', transactionReferenceId, isPartialPayment ? '(PARCIAL)' : '(INTEGRAL)');
        
        await prisma.transaction.create({
          data: {
            bankAccountId: body.bankAccountId,
            type: "INCOME",
            amount: netAmount,
            description: transactionDescription,
            referenceId: transactionReferenceId,
            referenceType: "RECEIVABLE",
            category: "VENDA",
            date: new Date(body.paymentDate || new Date()),
            balanceAfter: newBalance,
            notes: transactionNotes.length > 0 ? transactionNotes.join(" | ") : undefined,
            createdBy: (session.user as any)?.id,
          },
        });

        // Atualizar saldo da conta bancária
        await prisma.bankAccount.update({
          where: { id: body.bankAccountId },
          data: { balance: newBalance },
        });
        
        console.log('✅ Transação bancária criada para recebimento não-cartão')
      }
    } else if (isCardPayment) {
      console.log('💳 Pagamento com CARTÃO - Criando CardTransaction para gestão de cartões...')
      
      // Verificar se já existe um CardTransaction para este pedido/receivable
      const existingCardTx = await prisma.cardTransaction.findFirst({
        where: {
          OR: [
            { orderId: receivable.orderId || undefined },
            { grossAmount: roundedPaymentAmount }
          ]
        }
      })
      
      if (!existingCardTx) {
        // Determinar tipo de cartão (DEBIT por padrão, CREDIT se for explicitamente cartão de crédito)
        const cardType = paymentMethod === 'CREDIT_CARD' ? 'CREDIT' : 'DEBIT'
        
        // Buscar configuração de taxa do cartão
        const feeConfig = await prisma.cardFeeConfig.findFirst({
          where: { cardType, isActive: true }
        })
        
        const cardFeePercentage = feeConfig?.feePercentage || (cardType === 'DEBIT' ? 0.9 : 3.24)
        const cardFeeAmount = roundedPaymentAmount * (cardFeePercentage / 100)
        const cardNetAmount = roundedPaymentAmount - cardFeeAmount
        
        // Calcular data esperada de recebimento (D+1 para débito, D+30 para crédito)
        const saleDate = new Date(body.paymentDate || new Date())
        const expectedDate = new Date(saleDate)
        expectedDate.setDate(expectedDate.getDate() + (cardType === 'DEBIT' ? 1 : 30))
        
        // Criar CardTransaction
        await prisma.cardTransaction.create({
          data: {
            orderId: receivable.orderId || undefined,
            customerId: receivable.customerId || undefined,
            cardType,
            grossAmount: roundedPaymentAmount,
            feePercentage: cardFeePercentage,
            feeAmount: cardFeeAmount,
            netAmount: cardNetAmount,
            status: 'PENDING',
            saleDate,
            expectedDate,
          }
        })
        
        console.log('  ✅ CardTransaction criado com sucesso!')
        console.log('    - Tipo:', cardType)
        console.log('    - Valor Bruto: R$', roundedPaymentAmount.toFixed(2))
        console.log('    - Taxa:', cardFeePercentage, '%')
        console.log('    - Valor Líquido: R$', cardNetAmount.toFixed(2))
        console.log('    - Data Esperada:', expectedDate.toISOString().slice(0, 10))
      } else {
        console.log('  ℹ️ CardTransaction já existe para este pedido/valor, pulando criação')
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao receber conta:", error);
    return NextResponse.json(
      { error: "Erro ao receber conta" },
      { status: 500 }
    );
  }
}
