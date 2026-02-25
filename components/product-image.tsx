'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  fill?: boolean
  className?: string
  sizes?: string
  priority?: boolean
}

// Cache global de URLs S3 (válido por 1 hora)
const urlCache = new Map<string, { url: string, expiresAt: number }>()

// Fila de requisições pendentes para evitar sobrecarga
const requestQueue: Array<() => Promise<void>> = []
let isProcessingQueue = false
const MAX_CONCURRENT_REQUESTS = 5

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return
  
  isProcessingQueue = true
  
  while (requestQueue.length > 0) {
    const batch = requestQueue.splice(0, MAX_CONCURRENT_REQUESTS)
    await Promise.all(batch.map(fn => fn()))
  }
  
  isProcessingQueue = false
}

/**
 * Componente otimizado que carrega imagens S3 de forma lazy
 * Usa Intersection Observer para gerar URLs apenas quando a imagem está visível
 */
export function ProductImage({ src, alt, fill, className, sizes, priority }: ProductImageProps) {
  const [imageUrl, setImageUrl] = useState<string>('/placeholder-product.jpg')
  const [isLoading, setIsLoading] = useState(true)
  const [shouldLoad, setShouldLoad] = useState(priority || false) // Se priority=true, carrega imediatamente
  const containerRef = useRef<HTMLDivElement>(null)

  // ⚡ OTIMIZAÇÃO CRÍTICA: Intersection Observer para detectar visibilidade
  useEffect(() => {
    if (priority || shouldLoad) return // Já está carregando ou deve carregar

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '100px', // Começa a carregar 100px antes da imagem aparecer
        threshold: 0.01
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [priority, shouldLoad])

  useEffect(() => {
    if (!shouldLoad) return // Esperar até estar visível

    // Se já é uma URL completa ou placeholder, usar diretamente
    if (!src || src.startsWith('http') || src.startsWith('/') || src.startsWith('data:')) {
      setImageUrl(src || '/placeholder-product.jpg')
      setIsLoading(false)
      return
    }

    // ⚡ Verificar cache primeiro
    const cached = urlCache.get(src)
    if (cached && Date.now() < cached.expiresAt) {
      setImageUrl(cached.url)
      setIsLoading(false)
      return
    }

    // Adicionar à fila de requisições
    const generateUrl = async () => {
      try {
        const response = await fetch('/api/s3/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: src })
        })

        if (response.ok) {
          const data = await response.json()
          const signedUrl = data.url

          // ⚡ Salvar no cache (1 hora)
          urlCache.set(src, {
            url: signedUrl,
            expiresAt: Date.now() + (60 * 60 * 1000)
          })

          setImageUrl(signedUrl)
        } else {
          setImageUrl('/placeholder-product.jpg')
        }
      } catch (error) {
        console.error('Erro ao gerar URL S3:', error)
        setImageUrl('/placeholder-product.jpg')
      } finally {
        setIsLoading(false)
      }
    }

    // Adicionar à fila e processar
    requestQueue.push(generateUrl)
    processQueue()
  }, [src, shouldLoad])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <Image
        src={imageUrl}
        alt={alt}
        fill={fill}
        className={className}
        sizes={sizes}
        priority={priority}
        onLoadingComplete={() => setIsLoading(false)}
      />
    </div>
  )
}
