
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Eye, Trash2, FileText, ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

// Função para parsear data sem problema de timezone
const parseDate = (dateStr: string): Date => {
  // Se já é uma string no formato YYYY-MM-DD, parsear manualmente
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Se é ISO string, extrair apenas a parte da data
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Fallback
  return new Date(dateStr);
}

interface Purchase {
  id: string
  supplier: {
    id: string
    name: string
  }
  bankAccount: {
    id: string
    name: string
  }
  totalAmount: number
  status: string
  paymentMethod: string
  purchaseDate: string
  dueDate: string
  paidAt: string | null
  notes: string | null
  items: {
    id: string
    material: {
      id: string
      name: string
      sku: string
      unit: string
    }
    quantity: number
    unitPrice: number
  }[]
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado"
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  PAID: "bg-green-500",
  CANCELLED: "bg-red-500"
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  CARTAO_CREDITO: "Cartão de Crédito"
}

export default function HistoricoComprasPage() {
  const router = useRouter()
  const { data: session, status } = useSession() || {}
  
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null)
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    } else if (status === "authenticated") {
      loadPurchases()
    }
  }, [status, router, filterStatus, startDate, endDate])

  const loadPurchases = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== "all") params.append("status", filterStatus)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)

      const response = await fetch(`/api/purchases?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setPurchases(data)
      } else {
        toast.error("Erro ao carregar compras")
      }
    } catch (error) {
      console.error("Erro ao carregar compras:", error)
      toast.error("Erro ao carregar compras")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingPurchase) return

    try {
      const response = await fetch(`/api/purchases/${deletingPurchase.id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        toast.success("Compra excluída com sucesso!")
        setDeletingPurchase(null)
        loadPurchases()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao excluir compra")
      }
    } catch (error) {
      console.error("Erro ao excluir:", error)
      toast.error("Erro ao excluir compra")
    }
  }

  const filteredPurchases = purchases.filter((purchase) => {
    const matchesSearch = 
      purchase.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0)
  const pendingPurchases = filteredPurchases.filter(p => p.status === "PENDING")
  const totalPending = pendingPurchases.reduce((sum, p) => sum + p.totalAmount, 0)

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => window.location.href = "/admin/compras"}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Histórico de Compras</h1>
      </div>

      {/* Resumo */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de Compras</CardDescription>
            <CardTitle className="text-2xl">R$ {totalPurchases.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Compras Pendentes</CardDescription>
            <CardTitle className="text-2xl">{pendingPurchases.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Valor Pendente</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              R$ {totalPending.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <Input
                placeholder="Fornecedor ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Compras */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    {format(parseDate(purchase.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {purchase.supplier.name}
                  </TableCell>
                  <TableCell>
                    {purchase.items.length} {purchase.items.length === 1 ? "item" : "itens"}
                  </TableCell>
                  <TableCell className="font-medium">
                    R$ {purchase.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {format(parseDate(purchase.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {PAYMENT_METHOD_LABELS[purchase.paymentMethod] || purchase.paymentMethod}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[purchase.status]}>
                      {STATUS_LABELS[purchase.status] || purchase.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingPurchase(purchase)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {purchase.status === "PENDING" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingPurchase(purchase)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredPurchases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Nenhuma compra encontrada</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm || filterStatus !== "all" || startDate || endDate
                  ? "Tente ajustar os filtros"
                  : "Comece registrando sua primeira compra"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Visualização */}
      <Dialog open={!!viewingPurchase} onOpenChange={() => setViewingPurchase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Compra</DialogTitle>
            <DialogDescription>
              ID: {viewingPurchase?.id}
            </DialogDescription>
          </DialogHeader>

          {viewingPurchase && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Fornecedor</Label>
                  <p className="font-medium">{viewingPurchase.supplier.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Conta Bancária</Label>
                  <p className="font-medium">{viewingPurchase.bankAccount.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data da Compra</Label>
                  <p className="font-medium">
                    {format(parseDate(viewingPurchase.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data de Vencimento</Label>
                  <p className="font-medium">
                    {format(parseDate(viewingPurchase.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Forma de Pagamento</Label>
                  <p className="font-medium">
                    {PAYMENT_METHOD_LABELS[viewingPurchase.paymentMethod] || viewingPurchase.paymentMethod}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge className={STATUS_COLORS[viewingPurchase.status]}>
                      {STATUS_LABELS[viewingPurchase.status] || viewingPurchase.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {viewingPurchase.paidAt && (
                <div>
                  <Label className="text-muted-foreground">Data de Pagamento</Label>
                  <p className="font-medium">
                    {format(parseDate(viewingPurchase.paidAt), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}

              {/* Itens */}
              <div>
                <Label className="text-lg font-semibold mb-3 block">Itens da Compra</Label>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingPurchase.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.material.name}</TableCell>
                          <TableCell>{item.material.sku}</TableCell>
                          <TableCell className="text-right">
                            {item.quantity} {item.material.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {item.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {(item.quantity * item.unitPrice).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-semibold">
                          Total da Compra:
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          R$ {viewingPurchase.totalAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Observações */}
              {viewingPurchase.notes && (
                <div>
                  <Label className="text-muted-foreground">Observações</Label>
                  <p className="mt-1 p-3 bg-muted rounded-lg">{viewingPurchase.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingPurchase} onOpenChange={() => setDeletingPurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta compra de <strong>{deletingPurchase?.supplier.name}</strong> no valor de <strong>R$ {deletingPurchase?.totalAmount.toFixed(2)}</strong>?
              <br /><br />
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Reverter o estoque das matérias-primas</li>
                <li>Excluir a transação bancária associada</li>
                <li>Esta ação não pode ser desfeita</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir Compra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
