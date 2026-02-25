import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { getFileUrl } from '@/lib/s3';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const sheet = await prisma.payrollSheet.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (!sheet) {
    console.log('Nenhum PayrollSheet encontrado');
    return;
  }
  
  console.log('URL armazenada:', sheet.fileUrl);
  
  try {
    const signedUrl = await getFileUrl(sheet.fileUrl, false);
    console.log('URL assinada gerada com sucesso!');
    console.log('Tamanho URL:', signedUrl.length);
    console.log('PDF acessível: SIM');
  } catch (error: any) {
    console.log('Erro ao gerar URL:', error.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
