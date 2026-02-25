
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Download, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function CoraIntegrationPage() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Busca contas bancárias
      const accountsRes = await fetch('/api/financial/bank-accounts');
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setBankAccounts(data);
        if (data.length > 0) {
          setSelectedAccount(data[0].id);
        }
      }

      // Busca logs recentes
      const logsRes = await fetch('/api/financial/cora-integration/import-statements?limit=20');
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportStatements = async () => {
    if (!selectedAccount || !startDate || !endDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch('/api/financial/cora-integration/import-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: selectedAccount,
          startDate,
          endDate,
          autoReconcile: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Importação concluída! ${data.summary.imported} extratos importados, ${data.summary.reconciled} reconciliados`);
        loadData();
      } else {
        toast.error(data.error || 'Erro ao importar extratos');
      }
    } catch (error: any) {
      toast.error('Erro ao importar extratos: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncBalance = async () => {
    if (!selectedAccount) {
      toast.error('Selecione uma conta bancária');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/financial/cora-integration/sync-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: selectedAccount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Saldo sincronizado! Novo saldo: R$ ${data.newBalance.toFixed(2)}`);
        loadData();
      } else {
        toast.error(data.error || 'Erro ao sincronizar saldo');
      }
    } catch (error: any) {
      toast.error('Erro ao sincronizar saldo: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Sucesso</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração Cora</h1>
        <p className="text-muted-foreground">Importação automática de extratos e sincronização bancária</p>
      </div>

      {/* Sincronização de Saldo */}
      <Card>
        <CardHeader>
          <CardTitle>Sincronizar Saldo</CardTitle>
          <CardDescription>Atualiza o saldo da conta bancária com o saldo atual do Cora</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Conta Bancária</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="">Selecione uma conta</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - R$ {account.balance.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleSyncBalance} disabled={isSyncing || !selectedAccount}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Saldo'}
          </Button>
        </CardContent>
      </Card>

      {/* Importação de Extratos */}
      <Card>
        <CardHeader>
          <CardTitle>Importar Extratos Bancários</CardTitle>
          <CardDescription>Importa transações do Cora automaticamente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                <option value="">Selecione uma conta</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
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

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A importação buscará automaticamente todas as transações no período e tentará reconciliá-las com as movimentações do sistema.
            </AlertDescription>
          </Alert>

          <Button onClick={handleImportStatements} disabled={isImporting}>
            <Download className={`h-4 w-4 mr-2 ${isImporting ? 'animate-pulse' : ''}`} />
            {isImporting ? 'Importando...' : 'Importar Extratos'}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de Importações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Importações</CardTitle>
          <CardDescription>Últimas 20 importações realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processados</TableHead>
                <TableHead>Falhas</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma importação realizada ainda
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.executedAt).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>{log.operationType}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell>{log.recordsProcessed}</TableCell>
                    <TableCell>{log.recordsFailed}</TableCell>
                    <TableCell>
                      {log.errorMessage && (
                        <span className="text-sm text-red-600 truncate max-w-xs block">
                          {log.errorMessage}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
