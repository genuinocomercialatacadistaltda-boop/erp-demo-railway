import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { downloadFileBuffer } from '../lib/s3';

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
    console.log('Tentando baixar o PDF...');
    const buffer = await downloadFileBuffer(sheet.fileUrl);
    console.log('PDF baixado com sucesso!');
    console.log('Tamanho do buffer:', buffer.length, 'bytes');
  } catch (error: any) {
    console.log('Erro ao baixar:', error.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
