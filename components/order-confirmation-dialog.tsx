
'use client'

import { AlertCircle, CheckCircle, Clock, Info } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { OrderRulesSummary } from '@/lib/business-rules'

interface OrderConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  rulesSummary: OrderRulesSummary
  totalValue: number
  isLoading?: boolean
}

export function OrderConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  rulesSummary,
  totalValue,
  isLoading = false
}: OrderConfirmationDialogProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const finalTotal = totalValue + rulesSummary.totalFee

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">Confirmar Pedido</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Revise as informações importantes antes de confirmar seu pedido.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-4">
          {/* Business Hours Warning */}
          {!rulesSummary.businessHours.isOpen && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 mb-1">Horário de Funcionamento</p>
                <p className="text-sm text-amber-800">
                  {rulesSummary.businessHours.message}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Próxima abertura: {rulesSummary.businessHours.nextOpeningTime}
                </p>
              </div>
            </div>
          )}

          {/* Delivery/Pickup Warnings */}
          {rulesSummary.warnings && rulesSummary.warnings.length > 0 && (
            <div className="space-y-3">
              {rulesSummary.warnings.map((warning, index) => (
                <div 
                  key={index} 
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3"
                >
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">{warning}</p>
                </div>
              ))}
            </div>
          )}

          {/* Delivery Info */}
          {rulesSummary.deliveryInfo && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Informações de Entrega</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <p><strong>Previsão:</strong> {rulesSummary.deliveryInfo.estimatedDelivery}</p>
                {rulesSummary.totalFee > 0 && (
                  <p><strong>Taxa de Entrega:</strong> {formatCurrency(rulesSummary.totalFee)}</p>
                )}
                {rulesSummary.deliveryInfo.message && (
                  <p className="text-gray-600 mt-2">{rulesSummary.deliveryInfo.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Total Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-700">
                <span>Subtotal do Pedido</span>
                <span>{formatCurrency(totalValue)}</span>
              </div>
              
              {rulesSummary.totalFee > 0 && (
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Taxa de Entrega</span>
                  <span>{formatCurrency(rulesSummary.totalFee)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-green-300 flex justify-between text-lg font-bold text-green-900">
                <span>Total Final</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>

          {/* Confirmation Message */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 mb-1">Horário de Funcionamento</p>
              <p className="text-sm text-gray-700">
                Segunda a sexta: 8h às 12h e 14h às 18h
                <br />
                Sábado: 8h às 12h
                <br />
                Domingo: Fechado
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Voltar
          </AlertDialogCancel>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onConfirm()
            }}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Processando...' : 'Entendi e quero continuar'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
