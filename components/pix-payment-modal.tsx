'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { QrCode, Copy, CheckCircle2, Loader2, RefreshCw, X, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'

// Dados do carrinho para criação automática de pedido
interface CartData {
  items: Array<{
    productId: string
    quantity: number
    price: number
  }>
  customerData: {
    name: string
    phone?: string
    email?: string
    address?: string
    city?: string
  }
  orderType: string
  deliveryType?: string
  deliveryRegion?: string
  deliveryFee?: number
  deliveryDate?: string | null
  deliveryTime?: string | null
  paymentMethod: string
  notes?: string
  couponId?: string
  couponCode?: string
  couponDiscount?: number
  customerId?: string
}

interface PixPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentConfirmed: (pixChargeId: string, netAmount: number) => void
  amount: number // Valor em reais
  description?: string
  orderId?: string
  customerId?: string
  customerName?: string
  customerDocument?: string
  createdBy?: string
  cartData?: CartData // Dados do carrinho para criar pedido automaticamente
}

type CoraAccount = 'ESPETOS' | 'GENUINO'

export function PixPaymentModal({
  isOpen,
  onClose,
  onPaymentConfirmed,
  amount,
  description,
  orderId,
  customerId,
  customerName,
  customerDocument,
  createdBy,
  cartData,
}: PixPaymentModalProps) {
  const [step, setStep] = useState<'select' | 'loading' | 'qrcode' | 'paid' | 'error'>('select')
  const [selectedAccount, setSelectedAccount] = useState<CoraAccount | null>(null)
  const [pixCharge, setPixCharge] = useState<any>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  // Calcular taxa
  const fee = amount < 50 ? amount * 0.01 : 0.50
  const netAmount = amount - fee

  // Limpar ao fechar
  useEffect(() => {
    if (!isOpen) {
      if (pollInterval) clearInterval(pollInterval)
      setStep('select')
      setSelectedAccount(null)
      setPixCharge(null)
      setQrCodeDataUrl('')
      setErrorMessage('')
    }
  }, [isOpen, pollInterval])

  // 🆕 AUTO-SELECT: Quando o modal abre, automaticamente gerar PIX na conta GENUINO
  useEffect(() => {
    if (isOpen && step === 'select' && amount > 0) {
      // Pequeno delay para garantir que o modal está visível
      const timer = setTimeout(() => {
        generateQRCode('GENUINO')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, step, amount])

  // Gerar QR Code
  const generateQRCode = useCallback(async (account: CoraAccount) => {
    setStep('loading')
    setSelectedAccount(account)

    try {
      const response = await fetch('/api/pix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: description || 'Pagamento PIX - Espetos Genuíno',
          orderId,
          customerId,
          customerName,
          customerDocument,
          coraAccount: account,
          createdBy,
          cartData, // Dados do carrinho para criar pedido automaticamente
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar QR Code')
      }

      setPixCharge(data.pixCharge)

      // Gerar imagem do QR Code
      if (data.pixCharge.qrCode) {
        const qrDataUrl = await QRCode.toDataURL(data.pixCharge.qrCode, {
          width: 280,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        })
        setQrCodeDataUrl(qrDataUrl)
      }

      setStep('qrcode')

      // Iniciar polling para verificar pagamento
      startPolling(data.pixCharge.id)
    } catch (error: any) {
      console.error('Erro ao gerar PIX:', error)
      setErrorMessage(error.message)
      setStep('error')
    }
  }, [amount, description, orderId, customerId, customerName, customerDocument, createdBy, cartData])

  // Polling para verificar pagamento
  const startPolling = useCallback((pixChargeId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pix/${pixChargeId}/status`)
        const data = await response.json()

        if (data.status === 'PAID') {
          clearInterval(interval)
          setPollInterval(null)
          setStep('paid')
          
          // Aguardar um pouco para mostrar a confirmação
          setTimeout(() => {
            onPaymentConfirmed(pixChargeId, data.netAmount)
          }, 2000)
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error)
      }
    }, 3000) // Verificar a cada 3 segundos

    setPollInterval(interval)
  }, [onPaymentConfirmed])

  // Copiar código PIX
  const copyPixCode = useCallback(() => {
    if (pixCharge?.qrCode) {
      navigator.clipboard.writeText(pixCharge.qrCode)
      toast.success('Código PIX copiado!')
    }
  }, [pixCharge])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-purple-600" />
            Pagamento via PIX
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Selecionar conta */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-green-600">
                R$ {amount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Taxa: R$ {fee.toFixed(2)} | Líquido: R$ {netAmount.toFixed(2)}
              </p>
            </div>

            <p className="text-center text-sm text-gray-600">
              Selecione a conta para gerar o PIX:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2 hover:border-orange-500 hover:bg-orange-50"
                onClick={() => generateQRCode('ESPETOS')}
              >
                <Building2 className="h-8 w-8 text-orange-600" />
                <span className="font-medium">Cora Espetos</span>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2 hover:border-purple-500 hover:bg-purple-50"
                onClick={() => generateQRCode('GENUINO')}
              >
                <Building2 className="h-8 w-8 text-purple-600" />
                <span className="font-medium">Cora Genuíno</span>
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Carregando */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 text-purple-600 animate-spin" />
            <p className="mt-4 text-gray-600">Gerando QR Code...</p>
          </div>
        )}

        {/* STEP 3: QR Code */}
        {step === 'qrcode' && pixCharge && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-purple-600 border-purple-300">
                {selectedAccount === 'ESPETOS' ? '🔶 Cora Espetos' : '💜 Cora Genuíno'}
              </Badge>
              <Badge variant="secondary">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Aguardando...
              </Badge>
            </div>

            <Card className="p-4 flex flex-col items-center bg-white">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code PIX" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 bg-gray-100 flex items-center justify-center">
                  <QrCode className="h-16 w-16 text-gray-300" />
                </div>
              )}
            </Card>

            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                R$ {amount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Líquido: R$ {Number(pixCharge.netAmount).toFixed(2)} (taxa: R$ {Number(pixCharge.feeAmount).toFixed(2)})
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={copyPixCode}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar código PIX
            </Button>

            <p className="text-xs text-center text-gray-500">
              Escaneie o QR Code ou copie o código acima.
              <br />O pagamento será confirmado automaticamente.
            </p>
          </div>
        )}

        {/* STEP 4: Pago */}
        {step === 'paid' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-600">Pagamento Confirmado!</h3>
            <p className="text-gray-600 mt-2">R$ {amount.toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Valor líquido: R$ {Number(pixCharge?.netAmount || netAmount).toFixed(2)}
            </p>
          </div>
        )}

        {/* STEP 5: Erro */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <X className="h-12 w-12 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-red-600">Erro ao gerar PIX</h3>
            <p className="text-gray-600 mt-2 text-center">{errorMessage}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setStep('select')}
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
