"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, XCircle, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface FiscalInvoice {
  id: string;
  invoiceNumber: string | null;
  series: string | null;
  invoiceType: string;
  status: string;
  customerName: string;
  customerCpfCnpj: string | null;
  totalValue: number;
  accessKey: string | null;
  protocol: string | null;
  authorizationDate: string | null;
  createdAt: string;
  Order: {
    orderNumber: string;
  } | null;
  errorMessage: string | null;
}

const statusConfig = {
  PENDING: {
    label: 'Pendente',
    icon: Clock,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
  },
  PROCESSING: {
    label: 'Processando',
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-100',
  },
  AUTHORIZED: {
    label: 'Autorizada',
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-100',
  },
  CANCELLED: {
    label: 'Cancelada',
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-100',
  },
  DENIED: {
    label: 'Denegada',
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-100',
  },
  ERROR: {
    label: 'Erro',
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-100',
  },
};

export default function ListagemNotasPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<FiscalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    status: '',
    type: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);

      const response = await fetch(`/api/invoices?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar notas fiscais');
      }

      const data = await response.json();
      setInvoices(data.invoices);
    } catch (error: any) {
      console.error('Erro ao carregar notas fiscais:', error);
      toast.error(error.message || 'Erro ao carregar notas fiscais');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoiceId: string, type: 'xml' | 'pdf') => {
    try {
      const response = await fetch(
        `/api/invoices/download?invoiceId=${invoiceId}&type=${type}`
      );

      if (!response.ok) {
        throw new Error(`Erro ao baixar ${type.toUpperCase()}`);
      }

      if (type === 'xml') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nota_fiscal_${invoiceId}.xml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        window.open(data.pdfUrl, '_blank');
      }

      toast.success(`${type.toUpperCase()} baixado com sucesso`);
    } catch (error: any) {
      console.error(`Erro ao baixar ${type}:`, error);
      toast.error(error.message || `Erro ao baixar ${type.toUpperCase()}`);
    }
  };

  const handleCancel = async (invoiceId: string) => {
    const motivo = prompt(
      'Informe o motivo do cancelamento (mínimo 15 caracteres):'
    );

    if (!motivo || motivo.length < 15) {
      toast.error('Motivo do cancelamento deve ter no mínimo 15 caracteres');
      return;
    }

    try {
      const response = await fetch(
        `/api/invoices/${invoiceId}?motivo=${encodeURIComponent(motivo)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao cancelar nota fiscal');
      }

      toast.success('Nota fiscal cancelada com sucesso');
      fetchInvoices();
    } catch (error: any) {
      console.error('Erro ao cancelar nota fiscal:', error);
      toast.error(error.message || 'Erro ao cancelar nota fiscal');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Notas Fiscais Emitidas
            </h1>
            <p className="text-gray-600 mt-1">
              Consulte, baixe e cancele notas fiscais
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Final
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendente</option>
                <option value="PROCESSING">Processando</option>
                <option value="AUTHORIZED">Autorizada</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="DENIED">Denegada</option>
                <option value="ERROR">Erro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo
              </label>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters({ ...filters, type: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="NFE">NF-e</option>
                <option value="NFCE">NFC-e</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Notas */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Carregando notas fiscais...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Nenhuma nota fiscal encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => {
              const StatusIcon = statusConfig[invoice.status as keyof typeof statusConfig]?.icon || Clock;
              const statusInfo = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.PENDING;

              return (
                <div
                  key={invoice.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {invoice.invoiceNumber
                            ? `${invoice.invoiceType} ${invoice.series}-${invoice.invoiceNumber}`
                            : `ID: ${invoice.id.slice(0, 8)}`}
                        </h3>
                        <div
                          className={`flex items-center gap-1 px-3 py-1 rounded-full ${statusInfo.bg}`}
                        >
                          <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                          <span className={`text-sm font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p>
                            <strong>Cliente:</strong> {invoice.customerName}
                          </p>
                          {invoice.customerCpfCnpj && (
                            <p>
                              <strong>CPF/CNPJ:</strong> {invoice.customerCpfCnpj}
                            </p>
                          )}
                          {invoice.Order && (
                            <p>
                              <strong>Pedido:</strong> {invoice.Order.orderNumber}
                            </p>
                          )}
                        </div>
                        <div>
                          <p>
                            <strong>Valor:</strong> R$ {invoice.totalValue.toFixed(2)}
                          </p>
                          <p>
                            <strong>Emissão:</strong>{' '}
                            {format(new Date(invoice.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                          {invoice.authorizationDate && (
                            <p>
                              <strong>Autorização:</strong>{' '}
                              {format(
                                new Date(invoice.authorizationDate),
                                "dd/MM/yyyy 'às' HH:mm",
                                { locale: ptBR }
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {invoice.accessKey && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            <strong>Chave de Acesso:</strong> {invoice.accessKey}
                          </p>
                        </div>
                      )}

                      {invoice.errorMessage && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800">
                            <strong>Erro:</strong> {invoice.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 ml-6">
                      {invoice.status === 'AUTHORIZED' && (
                        <>
                          <button
                            onClick={() => handleDownload(invoice.id, 'pdf')}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </button>
                          <button
                            onClick={() => handleDownload(invoice.id, 'xml')}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            XML
                          </button>
                          <button
                            onClick={() => handleCancel(invoice.id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <XCircle className="h-4 w-4" />
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
