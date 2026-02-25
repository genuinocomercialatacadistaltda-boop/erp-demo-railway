import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET - Buscar clientes que têm este produto em seu catálogo personalizado
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const productId = params.id

    // Buscar o produto para obter o preço atual
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        priceWholesale: true,
        priceRetail: true
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    // Buscar todos os CustomerProduct que têm este produto
    const customerProducts = await prisma.customerProduct.findMany({
      where: {
        productId: productId
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        Customer: {
          name: 'asc'
        }
      }
    })

    // Formatar resposta com informações relevantes
    const affectedCustomers = customerProducts.map(cp => ({
      customerProductId: cp.id,
      customerId: cp.customerId,
      customerName: cp.Customer.name,
      customerEmail: cp.Customer.email,
      customerPhone: cp.Customer.phone,
      currentCustomPrice: cp.customPrice, // Preço personalizado atual (pode ser null)
      productPriceWholesale: product.priceWholesale, // Preço padrão do produto
      // Se tem customPrice, está usando preço personalizado; senão, usa o preço do produto
      effectivePrice: cp.customPrice ?? product.priceWholesale,
      hasCustomPrice: cp.customPrice !== null
    }))

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        priceWholesale: product.priceWholesale,
        priceRetail: product.priceRetail
      },
      affectedCustomers,
      totalAffected: affectedCustomers.length
    })

  } catch (error) {
    console.error('[AFFECTED_CUSTOMERS] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar clientes afetados' }, { status: 500 })
  }
}

// PUT - Atualizar preços dos clientes selecionados
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const productId = params.id
    const body = await request.json()
    
    // customerUpdates: array de { customerProductId, action: 'UPDATE' | 'KEEP', newPrice? }
    const { newProductPrice, customerUpdates } = body

    if (!customerUpdates || !Array.isArray(customerUpdates)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const results = {
      updated: 0,
      kept: 0,
      errors: [] as string[]
    }

    // Processar cada cliente
    for (const update of customerUpdates) {
      try {
        if (update.action === 'UPDATE') {
          // Atualizar para o novo preço do produto (remover preço personalizado)
          // Ou definir um novo preço personalizado
          await prisma.customerProduct.update({
            where: { id: update.customerProductId },
            data: {
              customPrice: update.newPrice ?? newProductPrice ?? null,
              updatedAt: new Date()
            }
          })
          results.updated++
        } else if (update.action === 'KEEP') {
          // Manter o preço atual - se não tinha customPrice, definir o preço antigo como customPrice
          if (update.keepOldPrice && update.oldPrice) {
            await prisma.customerProduct.update({
              where: { id: update.customerProductId },
              data: {
                customPrice: update.oldPrice,
                updatedAt: new Date()
              }
            })
          }
          results.kept++
        }
      } catch (err: any) {
        results.errors.push(`Erro ao processar cliente ${update.customerProductId}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `${results.updated} clientes atualizados, ${results.kept} mantidos`
    })

  } catch (error) {
    console.error('[AFFECTED_CUSTOMERS_UPDATE] Erro:', error)
    return NextResponse.json({ error: 'Erro ao atualizar preços dos clientes' }, { status: 500 })
  }
}
