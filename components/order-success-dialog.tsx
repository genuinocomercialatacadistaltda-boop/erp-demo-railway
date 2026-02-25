
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, Receipt, FileText, X } from 'lucide-react'

interface OrderSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  orderId: string
  hasBoleto: boolean
  onClose: () => void
}

export function OrderSuccessDialog({
  open,
  onOpenChange,
  orderNumber,
  orderId,
  hasBoleto,
  onClose
}: OrderSuccessDialogProps) {
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false)
  const [isPrintingBoleto, setIsPrintingBoleto] = useState(false)

  const handlePrintReceipt = () => {
    setIsPrintingReceipt(true)
    window.open(`/api/orders/${orderId}/receipt`, '_blank')
    setTimeout(() => setIsPrintingReceipt(false), 1000)
  }

  const handlePrintBoleto = () => {
    setIsPrintingBoleto(true)
    window.open(`/api/orders/${orderId}/boleto`, '_blank')
    setTimeout(() => setIsPrintingBoleto(false), 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Pedido Confirmado!
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Seu pedido <span className="font-bold text-gray-900">#{orderNumber}</span> foi realizado com sucesso!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <p className="text-sm text-gray-600 text-center">
            O que você gostaria de fazer agora?
          </p>

          {/* Print Receipt Button */}
          <Button
            onClick={handlePrintReceipt}
            disabled={isPrintingReceipt}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
          >
            <Receipt className="w-5 h-5 mr-2" />
            {isPrintingReceipt ? 'Abrindo...' : 'Imprimir Cupom'}
          </Button>

          {/* Print Boleto Button */}
          {hasBoleto && (
            <Button
              onClick={handlePrintBoleto}
              disabled={isPrintingBoleto}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="w-5 h-5 mr-2" />
              {isPrintingBoleto ? 'Abrindo...' : 'Imprimir Boleto do Cora'}
            </Button>
          )}

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full h-12"
          >
            <X className="w-5 h-5 mr-2" />
            Fechar
          </Button>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            💡 Você pode reimprimir o cupom e o boleto a qualquer momento através da gestão de pedidos.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
