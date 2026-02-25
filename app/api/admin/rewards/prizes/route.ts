
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getImageUrl } from '@/lib/s3';

// GET - Listar todos os brindes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const prizes = await prisma.prize.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [
        { displayOrder: 'asc' },
        { pointsCost: 'asc' }
      ],
      include: {
        _count: {
          select: { Redemption: true }
        }
      }
    });

    // Gerar URLs assinadas para as imagens
    const prizesWithSignedUrls = await Promise.all(
      prizes.map(async (prize: any) => {
        let imageUrl = prize.imageUrl;
        
        // Gerar URL assinada do S3 se a imagem estiver no cloud storage
        if (imageUrl) {
          try {
            imageUrl = await getImageUrl(imageUrl);
          } catch (error) {
            console.error(`Erro ao gerar URL assinada para brinde ${prize.id}:`, error);
          }
        }

        return {
          ...prize,
          imageUrl
        };
      })
    );

    return NextResponse.json(prizesWithSignedUrls);
  } catch (error) {
    console.error('Erro ao buscar brindes:', error);
    return NextResponse.json({ error: 'Erro ao buscar brindes' }, { status: 500 });
  }
}

// POST - Criar novo brinde
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, 
      description, 
      imageUrl, 
      cloudStoragePath,
      pointsCost, 
      stockQuantity, 
      isActive, 
      category,
      displayOrder 
    } = body;

    if (!name || !pointsCost || pointsCost < 1) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const prize = await prisma.prize.create({
      data: {
        name,
        description: description || null,
        imageUrl: cloudStoragePath || imageUrl || null, // Prioriza cloudStoragePath, fallback para imageUrl
        pointsCost: parseInt(pointsCost),
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : null,
        isActive: isActive !== false,
        category: category || null,
        displayOrder: displayOrder ? parseInt(displayOrder) : 0
      }
    });

    return NextResponse.json(prize, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar brinde:', error);
    return NextResponse.json({ error: 'Erro ao criar brinde' }, { status: 500 });
  }
}
