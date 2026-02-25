
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar matéria-prima por ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id: params.id },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        Category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (!rawMaterial) {
      return NextResponse.json(
        { error: 'Matéria-prima não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(rawMaterial);
  } catch (error) {
    console.error('Erro ao buscar matéria-prima:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar matéria-prima' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar matéria-prima
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[RAW_MATERIALS_PUT] Iniciando atualização da matéria-prima', params.id);
    
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem atualizar matérias-primas.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    console.log('[RAW_MATERIALS_PUT] Dados recebidos:', JSON.stringify(body, null, 2));
    
    const {
      name,
      description,
      sku,
      measurementUnit,
      currentStock,
      minStock,
      maxStock,
      costPerUnit,
      showInCatalog,
      priceWholesale,
      soldByWeight,
      icmsRate, // Taxa de ICMS em porcentagem
      imageUrl,
      supplierId,
      categoryId,
      isActive,
      notes,
    } = body;

    // Verificar se matéria-prima existe
    const existing = await prisma.rawMaterial.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      console.log('[RAW_MATERIALS_PUT] Matéria-prima não encontrada:', params.id);
      return NextResponse.json(
        { error: 'Matéria-prima não encontrada' },
        { status: 404 }
      );
    }

    console.log('[RAW_MATERIALS_PUT] Matéria-prima existente:', existing.name);

    // Verificar se SKU já existe (se mudou)
    if (sku && sku !== existing.sku) {
      const skuExists = await prisma.rawMaterial.findUnique({
        where: { sku },
      });

      if (skuExists) {
        console.log('[RAW_MATERIALS_PUT] SKU já existe:', sku);
        return NextResponse.json(
          { error: 'SKU já está em uso' },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização, convertendo tipos corretamente
    let validCategoryId = categoryId;
    if (!categoryId || categoryId === '' || categoryId === 'Sem categoria' || categoryId === 'no-category') {
      validCategoryId = null;
      console.log('[RAW_MATERIALS_PUT] CategoryId convertido para null');
    } else {
      console.log('[RAW_MATERIALS_PUT] CategoryId válido:', validCategoryId);
    }
    
    const updateData: any = {
      name,
      description: description || null,
      sku: sku || null,
      measurementUnit,
      currentStock: parseFloat(String(currentStock || 0)),
      minStock: minStock ? parseFloat(String(minStock)) : null,
      maxStock: maxStock ? parseFloat(String(maxStock)) : null,
      costPerUnit: costPerUnit ? parseFloat(String(costPerUnit)) : null,
      showInCatalog: Boolean(showInCatalog),
      priceWholesale: priceWholesale ? parseFloat(String(priceWholesale)) : null,
      soldByWeight: Boolean(soldByWeight),
      icmsRate: icmsRate !== undefined ? parseFloat(String(icmsRate)) : 0, // Taxa de ICMS em porcentagem
      imageUrl: imageUrl || null,
      supplierId: supplierId || null,
      categoryId: validCategoryId,
      isActive: Boolean(isActive),
      notes: notes || null,
    };

    console.log('[RAW_MATERIALS_PUT] Dados preparados para atualização:', JSON.stringify(updateData, null, 2));

    const rawMaterial = await prisma.rawMaterial.update({
      where: { id: params.id },
      data: updateData,
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        Category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    console.log('[RAW_MATERIALS_PUT] Atualização realizada com sucesso');
    return NextResponse.json(rawMaterial);
  } catch (error) {
    console.error('[RAW_MATERIALS_PUT] Erro ao atualizar matéria-prima:', error);
    console.error('[RAW_MATERIALS_PUT] Stack:', (error as Error).stack);
    return NextResponse.json(
      { error: 'Erro ao atualizar matéria-prima', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE - Excluir matéria-prima
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem excluir matérias-primas.' },
        { status: 403 }
      );
    }

    // Verificar se matéria-prima existe
    const existing = await prisma.rawMaterial.findUnique({
      where: { id: params.id },
      include: {
        PurchaseItem: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Matéria-prima não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se tem compras associadas
    if (existing.PurchaseItem && existing.PurchaseItem.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir. Esta matéria-prima possui compras associadas.' },
        { status: 400 }
      );
    }

    await prisma.rawMaterial.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Matéria-prima excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir matéria-prima:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir matéria-prima' },
      { status: 500 }
    );
  }
}
