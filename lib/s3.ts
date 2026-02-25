
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

// 🔥 SEMPRE criar cliente fresco para TODAS as operações
// Isso evita o erro "ExpiredToken" quando o servidor fica ativo por muito tempo
function getS3Client() {
  return createS3Client();
}

// Obter configuração do bucket sob demanda
function getConfig() {
  return getBucketConfig();
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  contentType?: string
): Promise<string> {
  const { bucketName, folderPrefix } = getConfig();
  const key = `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const client = getS3Client();
  
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return key;
}

export async function uploadFileWithCustomPath(
  buffer: Buffer,
  customPath: string,
  contentType?: string
): Promise<string> {
  const { bucketName, folderPrefix } = getConfig();
  const key = `${folderPrefix}${customPath}`;

  const client = getS3Client();
  
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return key;
}

// ⚡ CACHE de URLs assinadas (válidas por 30 min para evitar problemas)
const urlCache = new Map<string, { url: string, expiresAt: number }>();

export async function downloadFile(key: string): Promise<string> {
  const { bucketName } = getConfig();
  
  // ⚡ Verificar cache primeiro (30 min)
  const cached = urlCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // 🔥 SEMPRE criar cliente fresco
  const client = getS3Client();
  const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hora
  
  // ⚡ Salvar no cache (expira em 30 min para ser conservador)
  urlCache.set(key, {
    url: signedUrl,
    expiresAt: Date.now() + (30 * 60 * 1000) // 30 min em ms
  });
  
  return signedUrl;
}

export async function downloadFileBuffer(key: string): Promise<Buffer> {
  const { bucketName } = getConfig();
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // 🔥 SEMPRE criar cliente fresco
  const client = getS3Client();
  const response = await client.send(command);
  const chunks: Uint8Array[] = [];
  
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

export async function deleteFile(key: string): Promise<void> {
  const { bucketName } = getConfig();
  
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
}

export async function renameFile(oldKey: string, newKey: string): Promise<void> {
  // S3 doesn't support rename, so we'd need to copy and delete
  // For simplicity, we'll just use new uploads
}

export function isS3Path(url: string): boolean {
  const { folderPrefix } = getBucketConfig();
  
  console.log(`🔍 isS3Path check:`)
  console.log(`   - URL: ${url}`)
  console.log(`   - folderPrefix: ${folderPrefix}`)
  
  // 🔧 CORREÇÃO: URLs locais (começando com /) NÃO são caminhos S3
  if (url.startsWith('/')) {
    console.log(`   ❌ Começa com /, retornando false`)
    return false;
  }
  
  const result = url.startsWith(folderPrefix) || 
         url.includes('uploads/') || 
         url.includes('payroll-sheets/');
  
  console.log(`   - Resultado: ${result}`)
  return result;
}

export async function getImageUrl(imageUrl: string): Promise<string> {
  if (!imageUrl || imageUrl.trim() === '') {
    return '/placeholder-product.jpg';
  }
  
  // If it's already a full URL (http/https), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Check if it's a data URI
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // URLs locais (começando com /) retornam placeholder
  if (imageUrl.startsWith('/')) {
    return '/placeholder-product.jpg';
  }
  
  // Check if S3 is configured
  const { bucketName } = getBucketConfig();
  
  if (!bucketName) {
    return '/placeholder-product.jpg';
  }
  
  // Try to generate signed URL for S3 paths
  try {
    const signedUrl = await downloadFile(imageUrl);
    return signedUrl;
  } catch (error) {
    console.error('Erro ao gerar URL S3:', error);
    return '/placeholder-product.jpg';
  }
}
