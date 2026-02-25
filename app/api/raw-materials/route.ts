export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar todas as matérias-primas
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const showInCatalog = searchParams.get('showInCatalog') === 'true';

    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (showInCatalog) {
      where.showInCatalog = true;
    }

    const rawMaterials = await prisma.rawMaterial.findMany({
      where,
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
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(rawMaterials);
  } catch (error) {
    console.error('Erro ao buscar matérias-primas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar matérias-primas' },
      { status: 500 }
    );
  }
}

// POST - Criar nova matéria-prima
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem criar matérias-primas.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    console.log('[RAW_MATERIALS_POST] Dados recebidos:', JSON.stringify(body, null, 2));
    
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
      notes,
    } = body;

    // Validações removidas - campos opcionais conforme solicitado

    // Verificar se SKU já existe
    if (sku) {
      const existing = await prisma.rawMaterial.findUnique({
        where: { sku },
      });

      if (existing) {
        console.log('[RAW_MATERIALS_POST] SKU já existe:', sku);
        return NextResponse.json(
          { error: 'SKU já está em uso' },
          { status: 400 }
        );
      }
    }
    
    // Validar e corrigir categoryId - MUITO IMPORTANTE para MongoDB
    let validCategoryId: string | null | undefined = undefined;
    
    console.log('[RAW_MATERIALS_POST] CategoryId recebido (tipo):', typeof categoryId);
    console.log('[RAW_MATERIALS_POST] CategoryId recebido (valor):', categoryId);
    
    // Converter tudo que não é um ID válido para undefined (MongoDB aceita undefined como "sem relacionamento")
    if (
      categoryId === null || 
      categoryId === undefined || 
      categoryId === '' || 
      categoryId === 'null' ||
      categoryId === 'Sem categoria' || 
      categoryId === 'no-category' ||
      String(categoryId).trim() === ''
    ) {
      validCategoryId = undefined;
      console.log('[RAW_MATERIALS_POST] ✅ CategoryId convertido para undefined (sem categoria)');
    } else {
      validCategoryId = String(categoryId);
      console.log('[RAW_MATERIALS_POST] ✅ CategoryId válido será usado:', validCategoryId);
    }

    console.log('[RAW_MATERIALS_POST] Dados que serão enviados ao Prisma:');
    console.log(JSON.stringify({
      name,
      measurementUnit,
      currentStock: parseFloat(String(currentStock || 0)),
      categoryId: validCategoryId,
      showInCatalog: Boolean(showInCatalog),
      priceWholesale: priceWholesale ? parseFloat(String(priceWholesale)) : null,
    }, null, 2));

    const rawMaterial = await prisma.rawMaterial.create({
      data: {
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
        icmsRate: icmsRate ? parseFloat(String(icmsRate)) : 0, // Taxa de ICMS em porcentagem
        imageUrl: imageUrl || null,
        supplierId: supplierId || null,
        categoryId: validCategoryId,
        notes: notes || null,
      },
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

    console.log('[RAW_MATERIALS_POST] ✅ Matéria-prima criada com sucesso:', rawMaterial.id);
    return NextResponse.json(rawMaterial, { status: 201 });
  } catch (error: any) {
    console.error('[RAW_MATERIALS_POST] ❌ ERRO COMPLETO ao criar matéria-prima:');
    console.error('[RAW_MATERIALS_POST] Erro:', error);
    console.error('[RAW_MATERIALS_POST] Mensagem:', error?.message);
    console.error('[RAW_MATERIALS_POST] Stack:', error?.stack);
    
    // Mensagem de erro mais amigável
    let errorMessage = 'Erro ao criar matéria-prima';
    const details = error instanceof Error ? error.message : 'Erro desconhecido';
    
    if (details.includes('Malformed ObjectID') || details.includes('does not exist in the current database')) {
      errorMessage = 'Erro com categoria. Por favor, selecione "Sem categoria" e tente novamente.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: details,
        technicalInfo: String(error)
      },
      { status: 500 }
    );
  }
}
