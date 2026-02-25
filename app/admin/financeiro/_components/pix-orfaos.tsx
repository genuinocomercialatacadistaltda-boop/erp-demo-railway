'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertTriangle, Zap, CheckCircle, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface PixCharge {
  id: string
  customerName: string | null
  amount: number
  netAmount: number
  paidAt: string | null
  coraAccount: string
  description: string | null
}

export function PixOrfaos() {
  const [orphanedPix, setOrphanedPix] = useState<PixCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [selectedPix, setSelectedPix] = useState<PixCharge | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const fetchOrphanedPix = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pix/orphaned')
      const data = await response.json()
      if (data.success) {
        setOrphanedPix(data.significantPix || [])
      }
    } catch (error) {
      console.error('Erro ao buscar PIX órfãos:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrphanedPix()
  }, [fetchOrphanedPix])

  const handleCreateOrder = async (pixId: string) => {
    try {
      setProcessing(pixId)
      const response = await fetch('/api/pix/orphaned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixChargeId: pixId, action: 'create' })
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`Pedido ${data.order.orderNumber} criado com sucesso!`)
        await fetchOrphanedPix()
      } else {
        toast.error(data.error || 'Erro ao criar pedido')
      }
    } catch (error) {
      toast.error('Erro ao processar PIX')
    } finally {
      setProcessing(null)
      setShowDialog(false)
    }
  }

  const handleDismiss = async (pixId: string) => {
    try {
      setProcessing(pixId)
      const response = await fetch('/api/pix/orphaned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixChargeId: pixId, action: 'dismiss' })
      })
      const data = await response.json()
      if (data.success) {
        toast.success('PIX descartado')
        await fetchOrphanedPix()
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Erro ao descartar PIX')
    } finally {
      setProcessing(null)
      setShowDialog(false)
    }
  }

  if (loading) return null
  if (orphanedPix.length === 0) return null

  return (
    <>
      <Alert className="bg-amber-50 border-amber-300 mb-4">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div>
            <span className="font-semibold text-amber-900">Atenção:</span>
            <span className="text-amber-800 ml-1">
              {orphanedPix.length} pagamento(s) PIX foram confirmados mas não têm pedidos vinculados.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrphanedPix}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Atualizar
          </Button>
        </AlertDescription>
      </Alert>

      <Card className="border-amber-200 bg-amber-50/50 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <Zap className="h-5 w-5 text-amber-600" />
            PIX Pagos sem Pedido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orphanedPix.map(pix => (
              <div key={pix.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {pix.customerName || 'Cliente não identificado'}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="font-semibold text-green-700">
                      R$ {Number(pix.amount).toFixed(2)}
                    </span>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs">
                      {pix.coraAccount}
                    </Badge>
                    {pix.paidAt && (
                      <>
                        <span>•</span>
                        <span>
                          {new Date(pix.paidAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setSelectedPix(pix)
                      setShowDialog(true)
                    }}
                    disabled={processing === pix.id}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Descartar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleCreateOrder(pix.id)}
                    disabled={processing === pix.id}
                  >
                    {processing === pix.id ? (
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    Criar Pedido
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar PIX?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Tem certeza que deseja descartar este pagamento PIX de{' '}
              <span className="font-semibold text-green-700">
                R$ {selectedPix ? Number(selectedPix.amount).toFixed(2) : '0,00'}
              </span>
              {' '}de <span className="font-medium">{selectedPix?.customerName}</span>?
            </p>
            <p className="text-sm text-amber-600 mt-2">
              Esta ação não cria um pedido. Use apenas para testes ou pagamentos inválidos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedPix && handleDismiss(selectedPix.id)}
              disabled={processing !== null}
            >
              {processing ? 'Processando...' : 'Sim, Descartar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
