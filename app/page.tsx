'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Factory, 
  ShoppingBag, 
  Users, 
  LogIn, 
  ShoppingCart, 
  UserPlus, 
  User, 
  Phone, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  Clock,
  CreditCard,
  Truck,
  Award,
  Building2,
  Utensils,
  ArrowRight,
  MessageCircle,
  Tag,
  Percent
} from 'lucide-react'

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  priceWholesale: number
  priceRetail: number
}

interface Highlight {
  id: string
  title: string
  description: string
  imageUrl: string | null
  buttonText: string | null
  buttonUrl: string | null
}

interface Promotion {
  id: string
  name: string
  description: string
  imageUrl: string
  weight: string
  priceWholesale: number
  promotionalPrice: number
  discountPercent: number
  isWeeklyPromotion: boolean
}

export default function HomePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [showAtacadoDialog, setShowAtacadoDialog] = useState(false)
  const [showVarejoDialog, setShowVarejoDialog] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  // 🏷️ Promoções
  const [weeklyPromotion, setWeeklyPromotion] = useState<Promotion | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])

  const whatsappNumber = '55[SEU-DDD][SEU-NUMERO]'

  // Buscar produtos reais do banco de dados
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch('/api/public/products')
        const data = await response.json()
        if (data.products && data.products.length > 0) {
          setProducts(data.products)
        }
      } catch (error) {
        console.error('Erro ao carregar produtos:', error)
      } finally {
        setIsLoadingProducts(false)
      }
    }
    loadProducts()
  }, [])

  // Buscar destaques
  useEffect(() => {
    async function loadHighlights() {
      try {
        const response = await fetch('/api/public/highlights')
        const data = await response.json()
        setHighlights(data)
      } catch (error) {
        console.error('Erro ao carregar destaques:', error)
      }
    }
    loadHighlights()
  }, [])

  // 🏷️ Buscar promoções
  useEffect(() => {
    async function loadPromotions() {
      try {
        const response = await fetch('/api/public/promotions')
        const data = await response.json()
        if (data.weeklyPromotion) {
          setWeeklyPromotion(data.weeklyPromotion)
        }
        if (data.promotions) {
          setPromotions(data.promotions)
        }
      } catch (error) {
        console.error('Erro ao carregar promoções:', error)
      }
    }
    loadPromotions()
  }, [])

  // Imagens do carousel
  const carouselImages = products.length > 0 
    ? products.slice(0, 8).map(product => ({
        src: product.imageUrl,
        alt: product.name,
        title: product.name,
        description: product.description
      }))
    : [
        {
          src: "https://cdn.abacus.ai/images/4e39e744-c08f-4631-95c4-b768a20bfad6.png",
          alt: "Espetos de Carne na Grelha",
          title: "Espetos de Carne",
          description: "Qualidade Premium"
        },
        {
          src: "https://cdn.abacus.ai/images/c200451a-0e80-43a2-a720-c89ac4a32b6f.png",
          alt: "Espeto de Picanha",
          title: "Picanha",
          description: "Corte nobre e suculento"
        },
        {
          src: "https://cdn.abacus.ai/images/c9eef1a0-9b93-45ed-9668-62e7ff3fd272.png",
          alt: "Espetos Variados",
          title: "Variedade de Cortes",
          description: "Cupim, Picanha e Contrafilé"
        },
        {
          src: "https://cdn.abacus.ai/images/1f35c638-7f8f-47f2-8967-c2ecaf255074.png",
          alt: "Espetos Prontos",
          title: "Pronto para Servir",
          description: "Qualidade garantida"
        },
        {
          src: "https://cdn.abacus.ai/images/0602d9e7-73a3-41bc-b87e-647e225abb6c.png",
          alt: "Churrasco de Espetos",
          title: "Tradição no Churrasco",
          description: "A essência do espetinho perfeito"
        }
      ]

  // Rotação automática do carousel
  useEffect(() => {
    if (carouselImages.length === 0) return
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [carouselImages.length])

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header Institucional */}
      <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
        <div className="container mx-auto max-w-7xl flex h-20 items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <Image 
              src="/logo.jpg" 
              alt="[SUA EMPRESA]" 
              width={56} 
              height={56}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">[SUA EMPRESA]</h1>
              <p className="text-xs md:text-sm text-gray-600">[TIPO DE NEGÓCIO]</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <a 
              href={`tel:${whatsappNumber}`}
              className="hidden md:flex items-center gap-2 text-gray-700 hover:text-red-600 transition-colors"
            >
              <Phone className="w-5 h-5" />
              <span className="font-medium">[SEU TELEFONE]</span>
            </a>
            <Button 
              onClick={() => window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de saber mais sobre os produtos.')}`, '_blank')}
              className="bg-green-600 hover:bg-green-700 text-white px-3 md:px-4"
              size="sm"
            >
              <MessageCircle className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">WhatsApp</span>
            </Button>
            <Link href="/auth/login">
              <Button 
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-3 md:px-4"
                size="sm"
              >
                <LogIn className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Entrar</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section com Modalidades */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="https://images.pexels.com/photos/17138072/pexels-photo-17138072/free-photo-of-close-up-of-kebabs-on-the-grill.jpeg"
            alt="Background"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative container mx-auto max-w-7xl px-4 py-12 md:py-16">
          {/* Título e descrição */}
          <div className="text-center mb-10">
            <Badge className="bg-red-600 text-white mb-4 text-sm px-4 py-1">
              <Factory className="w-4 h-4 mr-2" />
              [TIPO DE NEGÓCIO]
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              Bem-vindo à [SUA EMPRESA]
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
              [DESCRIÇÃO DO SEU NEGÓCIO]. 
              Qualidade garantida e entrega pontual para o seu negócio.
            </p>
          </div>

          {/* Seção: Como você deseja comprar? */}
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Como você deseja comprar?
            </h2>
            <p className="text-gray-300">
              Escolha a modalidade que melhor atende às suas necessidades
            </p>
          </div>

          {/* Layout: Destaque | Atacado | Varejo | Destaque - lado a lado */}
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_1fr_180px] gap-4 items-stretch">
              
              {/* Destaque 1 - Lado Esquerdo */}
              <div className="hidden lg:flex flex-col justify-center">
                {highlights.length > 0 ? (
                  <Card className="border-0 shadow-lg overflow-hidden bg-white h-full">
                    <div className="p-3 flex flex-col h-full">
                      {highlights[0]?.imageUrl && (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden mb-2 flex-shrink-0">
                          <Image
                            src={highlights[0].imageUrl}
                            alt={highlights[0].title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <Badge className="bg-red-600 text-white text-xs mb-1 w-fit">Destaque</Badge>
                      <h3 className="font-bold text-gray-900 text-xs leading-tight">{highlights[0]?.title}</h3>
                      <p className="text-gray-600 text-xs line-clamp-3 mt-1 flex-1">{highlights[0]?.description}</p>
                      {highlights[0]?.buttonText && highlights[0]?.buttonUrl && (
                        <Button 
                          size="sm"
                          className="mt-2 w-full bg-red-600 hover:bg-red-700 text-xs h-7"
                          onClick={() => {
                            if (highlights[0]?.buttonUrl?.startsWith('http')) {
                              window.open(highlights[0].buttonUrl, '_blank')
                            } else {
                              router.push(highlights[0]?.buttonUrl || '/')
                            }
                          }}
                        >
                          {highlights[0].buttonText}
                        </Button>
                      )}
                    </div>
                  </Card>
                ) : (
                  <div className="hidden" />
                )}
              </div>
              
              {/* Card Atacado - Centro Esquerda */}
              <Card className="border-0 shadow-xl overflow-hidden bg-white">
                <div className="bg-red-600 p-5 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Atacado</h3>
                      <p className="text-red-100 text-sm">Para revendedores e assadores</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  <p className="text-gray-600 mb-4 text-sm">
                    Ideal para pequenos assadores que vendem espetinhos, 
                    lanchonetes, restaurantes e eventos.
                  </p>
                  <div className="space-y-2 mb-5">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Preços diferenciados para revenda</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Limite de crédito e prazo sob análise</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Catálogo personalizado</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Sistema de gestão "Meu Negócio"</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">PDV e comandas de mesa</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Programa de fidelidade com cashback</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      className="w-full bg-red-600 hover:bg-red-700 h-11"
                      onClick={() => setShowAtacadoDialog(true)}
                    >
                      Acessar Atacado
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <p className="text-center text-xs text-gray-500">
                      Já tem cadastro?{' '}
                      <button 
                        onClick={() => router.push('/auth/login')}
                        className="text-red-600 hover:text-red-700 font-medium underline"
                      >
                        Clique aqui para entrar
                      </button>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card Varejo - Centro Direita */}
              <Card className="border-0 shadow-xl overflow-hidden bg-white">
                <div className="bg-orange-600 p-5 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <Utensils className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Varejo</h3>
                      <p className="text-orange-100 text-sm">Para consumo próprio</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  <p className="text-gray-600 mb-4 text-sm">
                    Perfeito para quem quer comprar espetinhos frescos para 
                    o churrasco em casa, reuniões e confraternizações.
                  </p>
                  <div className="space-y-2 mb-5">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Compre com ou sem cadastro</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Pedidos rápidos e práticos</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Acumule pontos com cadastro</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Acompanhe seus pedidos</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">Entrega ou retirada na fábrica</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-0">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Espaço reservado</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      className="w-full bg-orange-600 hover:bg-orange-700 h-11"
                      onClick={() => setShowVarejoDialog(true)}
                    >
                      Acessar Varejo
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <p className="text-center text-xs text-gray-500">
                      Já tem cadastro?{' '}
                      <button 
                        onClick={() => router.push('/auth/login')}
                        className="text-orange-600 hover:text-orange-700 font-medium underline"
                      >
                        Clique aqui para entrar
                      </button>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Destaque 2 - Lado Direito */}
              <div className="hidden lg:flex flex-col justify-center">
                {highlights.length > 1 ? (
                  <Card className="border-0 shadow-lg overflow-hidden bg-white h-full">
                    <div className="p-3 flex flex-col h-full">
                      {highlights[1]?.imageUrl && (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden mb-2 flex-shrink-0">
                          <Image
                            src={highlights[1].imageUrl}
                            alt={highlights[1].title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <Badge className="bg-orange-600 text-white text-xs mb-1 w-fit">Destaque</Badge>
                      <h3 className="font-bold text-gray-900 text-xs leading-tight">{highlights[1]?.title}</h3>
                      <p className="text-gray-600 text-xs line-clamp-3 mt-1 flex-1">{highlights[1]?.description}</p>
                      {highlights[1]?.buttonText && highlights[1]?.buttonUrl && (
                        <Button 
                          size="sm"
                          className="mt-2 w-full bg-orange-600 hover:bg-orange-700 text-xs h-7"
                          onClick={() => {
                            if (highlights[1]?.buttonUrl?.startsWith('http')) {
                              window.open(highlights[1].buttonUrl, '_blank')
                            } else {
                              router.push(highlights[1]?.buttonUrl || '/')
                            }
                          }}
                        >
                          {highlights[1].buttonText}
                        </Button>
                      )}
                    </div>
                  </Card>
                ) : (
                  <div className="hidden" />
                )}
              </div>
            </div>

            {/* Destaques em mobile - aparecem abaixo dos cards principais */}
            {highlights.length > 0 && (
              <div className="lg:hidden grid grid-cols-2 gap-4 mt-4">
                {highlights.slice(0, 2).map((highlight, idx) => (
                  <Card key={highlight.id} className="border-0 shadow-lg overflow-hidden bg-white">
                    <div className="p-3">
                      {highlight.imageUrl && (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden mb-2">
                          <Image
                            src={highlight.imageUrl}
                            alt={highlight.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <Badge className={`${idx === 0 ? 'bg-red-600' : 'bg-orange-600'} text-white text-xs mb-1`}>Destaque</Badge>
                      <h3 className="font-bold text-gray-900 text-xs leading-tight">{highlight.title}</h3>
                      <p className="text-gray-600 text-xs line-clamp-2 mt-1">{highlight.description}</p>
                      {highlight.buttonText && highlight.buttonUrl && (
                        <Button 
                          size="sm"
                          className={`mt-2 w-full ${idx === 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'} text-xs h-7`}
                          onClick={() => {
                            if (highlight.buttonUrl?.startsWith('http')) {
                              window.open(highlight.buttonUrl, '_blank')
                            } else {
                              router.push(highlight.buttonUrl || '/')
                            }
                          }}
                        >
                          {highlight.buttonText}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Carousel de Produtos - Maior */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Nossos Produtos
            </h2>
            <p className="text-lg text-gray-600">
              Produtos de qualidade com o melhor preço
            </p>
          </div>
          
          {/* Carousel Container - Maior */}
          <div className="relative max-w-5xl mx-auto">
            <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl">
              {carouselImages.map((image, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                    <h3 className="text-white font-bold text-2xl md:text-4xl mb-2">{image.title}</h3>
                    <p className="text-gray-200 text-lg md:text-xl">{image.description}</p>
                  </div>
                </div>
              ))}
              
              {/* Controles do Carousel */}
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-3 md:p-4 shadow-lg transition-all hover:scale-110 z-10"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-3 md:p-4 shadow-lg transition-all hover:scale-110 z-10"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
              </button>
              
              {/* Indicadores */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentImageIndex 
                        ? 'bg-white w-8' 
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                    aria-label={`Ir para imagem ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🏷️ SEÇÃO DE PROMOÇÃO DA SEMANA */}
      {(weeklyPromotion || promotions.length > 0) && (
        <section className="py-16 md:py-24 bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Tag className="w-4 h-4" />
                Ofertas Especiais
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                🔥 Promoção da Semana
              </h2>
              <p className="text-lg text-gray-600">
                Aproveite os preços especiais para pagamentos em PIX ou Dinheiro
              </p>
            </div>
            
            {/* Promoção da Semana em Destaque */}
            {weeklyPromotion && (
              <div className="mb-12">
                <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white overflow-hidden shadow-2xl">
                  <div className="flex flex-col md:flex-row">
                    {/* 📸 Container da Imagem - Otimizado para Mobile */}
                    <div className="relative w-full md:w-1/2 h-[400px] md:h-auto md:min-h-[500px]">
                      <Image
                        src={weeklyPromotion.imageUrl}
                        alt={weeklyPromotion.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                      />
                      <div className="absolute top-4 left-4 z-10">
                        <Badge className="bg-yellow-400 text-yellow-900 text-lg px-4 py-2 font-bold shadow-lg">
                          ⭐ OFERTA DA SEMANA
                        </Badge>
                      </div>
                    </div>
                    <div className="p-8 md:p-12 flex flex-col justify-center w-full md:w-1/2">
                      <h3 className="text-3xl md:text-4xl font-bold mb-4">
                        {weeklyPromotion.name}
                      </h3>
                      <p className="text-white/90 text-lg mb-6">
                        {weeklyPromotion.description || weeklyPromotion.weight}
                      </p>
                      <div className="space-y-2">
                        <p className="text-white/70 text-lg line-through">
                          De R$ {weeklyPromotion.priceWholesale.toFixed(2)}
                        </p>
                        <p className="text-5xl md:text-6xl font-bold text-yellow-300">
                          R$ {weeklyPromotion.promotionalPrice.toFixed(2)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <Badge className="bg-green-500 text-white text-lg px-3 py-1">
                            <Percent className="w-4 h-4 mr-1" />
                            {weeklyPromotion.discountPercent}% OFF
                          </Badge>
                          <span className="text-sm text-white/80">
                            Preço válido para PIX ou Dinheiro
                          </span>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowAtacadoDialog(true)}
                        className="mt-8 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-lg px-8 py-6 w-full md:w-auto"
                      >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Quero Aproveitar!
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Outras Promoções */}
            {promotions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {promotions.slice(0, 6).map((promo) => (
                  <Card key={promo.id} className="overflow-hidden hover:shadow-xl transition-shadow border-2 border-orange-200">
                    <div className="relative aspect-square">
                      <Image
                        src={promo.imageUrl}
                        alt={promo.name}
                        fill
                        className="object-cover"
                      />
                      <Badge className="absolute top-3 left-3 bg-orange-500 text-white">
                        <Tag className="w-3 h-3 mr-1" />
                        {promo.discountPercent}% OFF
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h4 className="font-bold text-lg text-gray-900 mb-2">{promo.name}</h4>
                      <p className="text-sm text-gray-500 mb-3">{promo.weight}</p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-sm text-gray-400 line-through">
                            R$ {promo.priceWholesale.toFixed(2)}
                          </p>
                          <p className="text-2xl font-bold text-orange-600">
                            R$ {promo.promotionalPrice.toFixed(2)}
                          </p>
                        </div>
                        <span className="text-xs text-orange-600 font-medium">
                          PIX/Dinheiro
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Seção de Destaques Dinâmicos - Exibe do 3º destaque em diante */}
      {highlights.length > 2 && (
        <section className="py-16 md:py-24 bg-red-50">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Mais Destaques
              </h2>
              <p className="text-lg text-gray-600">
                Confira nossas ofertas e novidades
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {highlights.slice(2).map((highlight) => (
                <Card key={highlight.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  {highlight.imageUrl && (
                    <div className="relative aspect-video">
                      <Image
                        src={highlight.imageUrl}
                        alt={highlight.title}
                        fill
                        className="object-cover rounded-t-lg"
                      />
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{highlight.title}</h3>
                    <p className="text-gray-600 mb-4">{highlight.description}</p>
                    {highlight.buttonText && highlight.buttonUrl && (
                      <Button 
                        className="w-full bg-red-600 hover:bg-red-700"
                        onClick={() => {
                          if (highlight.buttonUrl?.startsWith('http')) {
                            window.open(highlight.buttonUrl, '_blank')
                          } else {
                            router.push(highlight.buttonUrl || '/')
                          }
                        }}
                      >
                        {highlight.buttonText}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Diferenciais */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Por que escolher a [SUA EMPRESA]?
            </h2>
            <p className="text-lg text-gray-600">
              Experiência, qualidade e compromisso com o seu negócio
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <Factory className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">Maior Fábrica da Região</h3>
              <p className="text-gray-600 text-sm">Capacidade para atender grandes volumes com qualidade</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <Award className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">Qualidade Garantida</h3>
              <p className="text-gray-600 text-sm">Produtos frescos e selecionados diariamente</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <Truck className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">Entrega Pontual</h3>
              <p className="text-gray-600 text-sm">Compromisso com prazos para não faltar no seu negócio</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">Condições Especiais</h3>
              <p className="text-gray-600 text-sm">Crédito e prazo para parceiros cadastrados</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 md:py-24 bg-gray-900 text-white">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para começar?
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Entre em contato conosco e descubra as melhores condições para o seu negócio
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6 h-auto"
              onClick={() => window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de saber mais sobre os produtos.')}`, '_blank')}
            >
              <Phone className="w-6 h-6 mr-3" />
              Falar pelo WhatsApp
            </Button>
            <Button 
              size="lg" 
              className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-6 h-auto"
              onClick={() => router.push('/auth/login')}
            >
              <LogIn className="w-6 h-6 mr-3" />
              Acessar Minha Conta
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo.jpg" alt="[SUA EMPRESA]" width={48} height={48} className="rounded-lg" />
                <div>
                  <h3 className="font-bold text-white">[SUA EMPRESA]</h3>
                  <p className="text-sm text-gray-400">[TIPO DE NEGÓCIO]</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                A essência do espetinho perfeito. Qualidade garantida desde 2020.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Contato</h3>
              <div className="text-gray-400 text-sm space-y-2">
                <p className="flex items-start gap-2">
                  <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>WhatsApp: [SEU TELEFONE]</span>
                </p>
                <p className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Av. Amapá esquina com Rua 11<br />Gurupi-TO</span>
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Horário de Atendimento</h3>
              <div className="text-gray-400 text-sm space-y-2">
                <p className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Segunda a Sexta: 8h às 18h</span>
                </p>
                <p className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Sábado: 8h às 12h</span>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            © 2020 [SUA EMPRESA]. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Dialog Atacado */}
      <Dialog open={showAtacadoDialog} onOpenChange={setShowAtacadoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Atacado</DialogTitle>
            <DialogDescription className="text-center">
              Escolha como deseja acessar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button 
              className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setShowAtacadoDialog(false)
                router.push('/auth/login')
              }}
            >
              <User className="w-6 h-6" />
              <div>
                <div className="font-semibold">Já sou cliente cadastrado</div>
                <div className="text-xs opacity-90">Faça login para acessar</div>
              </div>
            </Button>
            <Button 
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2 border-2 hover:bg-gray-50"
              onClick={() => {
                setShowAtacadoDialog(false)
                router.push('/varejo/catalogo')
              }}
            >
              <ShoppingCart className="w-6 h-6" />
              <div>
                <div className="font-semibold">Ver Catálogo sem Cadastro</div>
                <div className="text-xs text-gray-600">Visualize produtos e preços</div>
              </div>
            </Button>
            <Button 
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2 border-2 border-green-600 hover:bg-green-50"
              onClick={() => {
                setShowAtacadoDialog(false)
                window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Gostaria de fazer meu cadastro na [SUA EMPRESA] para comprar no atacado.')}`, '_blank')
              }}
            >
              <UserPlus className="w-6 h-6 text-green-600" />
              <div>
                <div className="font-semibold text-green-700">Quero me cadastrar</div>
                <div className="text-xs text-gray-600">Solicite seu cadastro pelo WhatsApp</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Varejo */}
      <Dialog open={showVarejoDialog} onOpenChange={setShowVarejoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Varejo</DialogTitle>
            <DialogDescription className="text-center">
              Escolha como deseja comprar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button 
              className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => {
                setShowVarejoDialog(false)
                router.push('/varejo/signup')
              }}
            >
              <UserPlus className="w-6 h-6" />
              <div>
                <div className="font-semibold">Comprar com Cadastro</div>
                <div className="text-xs opacity-90">Acumule pontos e acompanhe pedidos</div>
              </div>
            </Button>
            <Button 
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2 border-2 hover:bg-gray-50"
              onClick={() => {
                setShowVarejoDialog(false)
                router.push('/retail')
              }}
            >
              <ShoppingCart className="w-6 h-6" />
              <div>
                <div className="font-semibold">Comprar sem Cadastro</div>
                <div className="text-xs text-gray-600">Pedido rápido, sem login</div>
              </div>
            </Button>
            <Button 
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2 border-2 border-red-600 hover:bg-red-50"
              onClick={() => {
                setShowVarejoDialog(false)
                router.push('/auth/login')
              }}
            >
              <User className="w-6 h-6 text-red-600" />
              <div>
                <div className="font-semibold text-red-700">Já tenho cadastro</div>
                <div className="text-xs text-gray-600">Entrar na minha conta</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
