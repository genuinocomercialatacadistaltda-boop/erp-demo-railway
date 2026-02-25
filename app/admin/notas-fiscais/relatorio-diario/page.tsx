"use client";

import { useEffect, useState } from "react";
import { Calendar, Package, Receipt, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface DailyReportData {
  date: string;
  summary: {
    totalOrders: number;
    retailOrders: number;
    registeredOrders: number;
    retailTotal: number;
    registeredTotal: number;
    grandTotal: number;
  };
  retail: {
    orders: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      total: number;
      createdAt: string;
    }>;
    consolidatedProducts: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    total: number;
  };
  registered: {
    orders: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      customerCpfCnpj?: string;
      total: number;
      items: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
      createdAt: string;
    }>;
    total: number;
  };
}

export default function RelatorioDiarioPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [emittingInvoice, setEmittingInvoice] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [selectedDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/invoices/daily-report?date=${selectedDate}`
      );
      
      if (!response.ok) {
        throw new Error('Erro ao carregar relatório');
      }

      const data = await response.json();
      setReportData(data);
    } catch (error: any) {
      console.error('Erro ao carregar relatório:', error);
      toast.error(error.message || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleEmitConsolidatedInvoice = async () => {
    if (!reportData || reportData.retail.orders.length === 0) {
      toast.error('Não há vendas para consumidor final neste dia');
      return;
    }

    const confirmed = confirm(
      `Deseja emitir uma NF-e consolidada para ${reportData.retail.orders.length} vendas no valor total de R$ ${reportData.retail.total.toFixed(2)}?`
    );

    if (!confirmed) return;

    setEmittingInvoice(true);
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceType: 'NFE',
          customerName: 'CONSUMIDOR FINAL',
          customerCpfCnpj: null,
          customerEmail: null,
          customerPhone: null,
          items: reportData.retail.consolidatedProducts.map((product) => ({
            productName: product.productName,
            productCode: product.productId,
            quantity: product.quantity,
            unitValue: product.unitPrice,
            totalValue: product.total,
            ncm: '1602.50.00',
            cfop: '5.102',
          })),
          totalValue: reportData.retail.total,
          productsValue: reportData.retail.total,
          taxValue: 0,
          discount: 0,
          notes: `Nota consolidada - ${reportData.retail.orders.length} pedidos do dia ${format(
            new Date(selectedDate),
            'dd/MM/yyyy',
            { locale: ptBR }
          )}`,
          paymentMethod: 'DIVERSOS',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao emitir nota fiscal');
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success('Nota fiscal emitida com sucesso!');
        fetchReport(); // Recarregar relatório
        router.push('/admin/notas-fiscais/listagem');
      } else {
        throw new Error(data.error || 'Erro ao emitir nota fiscal');
      }
    } catch (error: any) {
      console.error('Erro ao emitir nota fiscal:', error);
      toast.error(error.message || 'Erro ao emitir nota fiscal');
    } finally {
      setEmittingInvoice(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Relatório Diário de Vendas
              </h1>
              <p className="text-gray-600 mt-1">
                Visualize e emita notas fiscais consolidadas
              </p>
            </div>
          </div>

          {/* Seletor de Data */}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Carregando relatório...</p>
          </div>
        ) : !reportData ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Erro ao carregar relatório</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total de Pedidos</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {reportData.summary.totalOrders}
                    </p>
                  </div>
                  <Receipt className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Consumidor Final</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {reportData.summary.retailOrders}
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Clientes Cadastrados</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {reportData.summary.registeredOrders}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-sm">
                <p className="text-sm text-blue-100">Valor Total</p>
                <p className="text-3xl font-bold text-white mt-1">
                  R$ {reportData.summary.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Vendas para Consumidor Final */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Vendas para Consumidor Final
                  </h2>
                  <p className="text-green-100 text-sm mt-1">
                    {reportData.retail.orders.length} pedidos • Total: R${' '}
                    {reportData.retail.total.toFixed(2)}
                  </p>
                </div>
                {reportData.retail.orders.length > 0 && (
                  <button
                    onClick={handleEmitConsolidatedInvoice}
                    disabled={emittingInvoice}
                    className="px-6 py-3 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emittingInvoice ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        Emitindo...
                      </span>
                    ) : (
                      'Emitir NF-e Consolidada'
                    )}
                  </button>
                )}
              </div>

              {reportData.retail.orders.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Nenhuma venda para consumidor final neste dia
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Produtos Consolidados */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Produtos Consolidados (para NF-e)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                              Produto
                            </th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                              Quantidade
                            </th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                              Valor Unit.
                            </th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.retail.consolidatedProducts.map((product) => (
                            <tr
                              key={product.productId}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {product.productName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                {product.quantity}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                R$ {product.unitPrice.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                R$ {product.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td
                              colSpan={3}
                              className="px-4 py-3 text-sm font-semibold text-gray-900 text-right"
                            >
                              Total
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                              R$ {reportData.retail.total.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Lista de Pedidos */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Pedidos Individuais
                    </h3>
                    <div className="space-y-3">
                      {reportData.retail.orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {order.orderNumber}
                            </p>
                            <p className="text-sm text-gray-600">
                              {order.customerName} •{' '}
                              {format(new Date(order.createdAt), 'HH:mm', {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                          <p className="text-lg font-semibold text-gray-900">
                            R$ {order.total.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Vendas para Clientes Cadastrados */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white">
                  Vendas para Clientes Cadastrados
                </h2>
                <p className="text-purple-100 text-sm mt-1">
                  {reportData.registered.orders.length} pedidos • Total: R${' '}
                  {reportData.registered.total.toFixed(2)}
                </p>
              </div>

              {reportData.registered.orders.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Nenhuma venda para clientes cadastrados neste dia
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {reportData.registered.orders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900 text-lg">
                            {order.orderNumber}
                          </p>
                          <p className="text-sm text-gray-600">
                            {order.customerName}
                          </p>
                          {order.customerCpfCnpj && (
                            <p className="text-sm text-gray-500">
                              CPF/CNPJ: {order.customerCpfCnpj}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-600">
                            R$ {order.total.toFixed(2)}
                          </p>
                          <button
                            onClick={() => {
                              // TODO: Implementar emissão individual
                              toast('Em breve: Emissão individual de NF-e', {
                                icon: 'ℹ️',
                              });
                            }}
                            className="mt-2 px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                          >
                            Emitir NF-e
                          </button>
                        </div>
                      </div>

                      {/* Itens do pedido */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Itens:
                        </p>
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div
                              key={index}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-gray-600">
                                {item.quantity}x {item.productName}
                              </span>
                              <span className="text-gray-900 font-medium">
                                R$ {item.total.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
