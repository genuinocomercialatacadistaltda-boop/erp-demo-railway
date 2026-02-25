'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X, Truck, Ban, Award } from 'lucide-react';
import { toast } from 'sonner';

interface Redemption {
  id: string;
  pointsUsed: number;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  notes: string | null;
  rejectionReason: string | null;
  Customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    city: string;
  };
  Prize: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    pointsCost: number;
    stockQuantity: number | null;
  };
}

export default function RedemptionsPage() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'deliver' | 'cancel'>('approve');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  useEffect(() => {
    fetchRedemptions();
  }, [statusFilter]);

  const fetchRedemptions = async () => {
    try {
      const url = statusFilter 
        ? `/api/admin/rewards/redemptions?status=${statusFilter}`
        : '/api/admin/rewards/redemptions';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRedemptions(data);
      }
    } catch (error) {
      console.error('Erro ao buscar resgates:', error);
    }
  };

  const handleAction = async () => {
    if (!selectedRedemption) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/rewards/redemptions/${selectedRedemption.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes: notes || undefined,
          rejectionReason: action === 'reject' ? rejectionReason : undefined
        })
      });

      if (response.ok) {
        const actionLabels = {
          approve: 'aprovado',
          reject: 'rejeitado',
          deliver: 'marcado como entregue',
          cancel: 'cancelado'
        };
        toast.success(`Resgate ${actionLabels[action]}!`);
        setIsDialogOpen(false);
        setSelectedRedemption(null);
        setNotes('');
        setRejectionReason('');
        fetchRedemptions();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao processar resgate');
      }
    } catch (error) {
      console.error('Erro ao processar resgate:', error);
      toast.error('Erro ao processar resgate');
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (redemption: Redemption, actionType: typeof action) => {
    setSelectedRedemption(redemption);
    setAction(actionType);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: { variant: any; label: string } } = {
      PENDING: { variant: 'secondary', label: 'Pendente' },
      APPROVED: { variant: 'default', label: 'Aprovado' },
      REJECTED: { variant: 'destructive', label: 'Rejeitado' },
      DELIVERED: { variant: 'outline', label: 'Entregue' },
      CANCELLED: { variant: 'secondary', label: 'Cancelado' }
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getActionButton = (redemption: Redemption) => {
    switch (redemption.status) {
      case 'PENDING':
        return (
          <>
            <Button size="sm" variant="default" onClick={() => openDialog(redemption, 'approve')}>
              <Check className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openDialog(redemption, 'reject')}>
              <X className="h-4 w-4 mr-1" />
              Rejeitar
            </Button>
          </>
        );
      case 'APPROVED':
        return (
          <>
            <Button size="sm" variant="default" onClick={() => openDialog(redemption, 'deliver')}>
              <Truck className="h-4 w-4 mr-1" />
              Entregar
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog(redemption, 'reject')}>
              <X className="h-4 w-4 mr-1" />
              Rejeitar
            </Button>
          </>
        );
      case 'DELIVERED':
        return <span className="text-sm text-muted-foreground">Concluído</span>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🎁 Gerenciar Resgates</h1>
        <p className="text-muted-foreground mt-1">
          Aprove, rejeite e gerencie as solicitações de resgate
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('PENDING')}
        >
          Pendentes
        </Button>
        <Button
          variant={statusFilter === 'APPROVED' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('APPROVED')}
        >
          Aprovados
        </Button>
        <Button
          variant={statusFilter === 'DELIVERED' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('DELIVERED')}
        >
          Entregues
        </Button>
        <Button
          variant={statusFilter === '' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('')}
        >
          Todos
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resgates ({redemptions.length})</CardTitle>
          <CardDescription>
            Gerencie as solicitações de resgate dos clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Brinde</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redemptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum resgate encontrado
                  </TableCell>
                </TableRow>
              ) : (
                redemptions.map((redemption) => (
                  <TableRow key={redemption.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{redemption.Customer.name}</p>
                        <p className="text-sm text-muted-foreground">{redemption.Customer.city}</p>
                        <p className="text-xs text-muted-foreground">{redemption.Customer.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {redemption.Prize.imageUrl && (
                          <img 
                            src={redemption.Prize.imageUrl} 
                            alt={redemption.Prize.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium">{redemption.Prize.name}</p>
                          {redemption.Prize.description && (
                            <p className="text-xs text-muted-foreground">{redemption.Prize.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{redemption.pointsUsed} pts</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(redemption.requestedAt).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>{getStatusBadge(redemption.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {getActionButton(redemption)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' && 'Aprovar Resgate'}
              {action === 'reject' && 'Rejeitar Resgate'}
              {action === 'deliver' && 'Marcar como Entregue'}
              {action === 'cancel' && 'Cancelar Resgate'}
            </DialogTitle>
            <DialogDescription>
              {selectedRedemption && (
                <span>
                  {selectedRedemption.Customer.name} - {selectedRedemption.Prize.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {action === 'reject' && (
              <div className="space-y-2">
                <Label>Motivo da Rejeição *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Informe o motivo da rejeição..."
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações se necessário..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAction} 
                disabled={isLoading || (action === 'reject' && !rejectionReason)}
              >
                {isLoading ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
