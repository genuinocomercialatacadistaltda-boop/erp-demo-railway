'use client'

import { useState, useEffect } from 'react'

// Cache global de URLs S3 (válido por 1 hora)
const urlCache = new Map<string, { url: string, expiresAt: number }>()

/**
 * Hook para gerar URLs S3 assinadas de forma lazy (só quando necessário)
 * 
 * @param s3Key - Caminho do arquivo no S3 (ex: "public/uploads/123-image.jpg")
 * @returns URL assinada do S3 ou placeholder
 */
export function useS3Image(s3Key: string | null | undefined): string {
  const [url, setUrl] = useState<string>('/placeholder-product.jpg')

  useEffect(() => {
    if (!s3Key || s3Key === '/placeholder-product.jpg' || s3Key.startsWith('http')) {
      setUrl(s3Key || '/placeholder-product.jpg')
      return
    }

    // ⚡ Verificar cache primeiro
    const cached = urlCache.get(s3Key)
    if (cached && Date.now() < cached.expiresAt) {
      setUrl(cached.url)
      return
    }

    // Gerar nova URL assinada
    const generateUrl = async () => {
      try {
        const response = await fetch('/api/s3/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: s3Key })
        })

        if (response.ok) {
          const data = await response.json()
          const signedUrl = data.url

          // ⚡ Salvar no cache (1 hora)
          urlCache.set(s3Key, {
            url: signedUrl,
            expiresAt: Date.now() + (60 * 60 * 1000)
          })

          setUrl(signedUrl)
        } else {
          setUrl('/placeholder-product.jpg')
        }
      } catch (error) {
        console.error('Erro ao gerar URL S3:', error)
        setUrl('/placeholder-product.jpg')
      }
    }

    generateUrl()
  }, [s3Key])

  return url
}
