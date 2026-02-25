
// API para gerar cupom de pedido em HTML para impressão

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar pedido com todos os dados
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        OrderItem: {
          include: {
            Product: true,
            RawMaterial: true // 🔧 FIX: Incluir matérias-primas
          }
        },
        User: true,
        Coupon: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    // Gerar HTML do cupom
    const html = generateReceiptHTML(order)

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating receipt:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar cupom' },
      { status: 500 }
    )
  }
}

function generateReceiptHTML(order: any): string {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })
  }

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Dinheiro',
      PIX: 'PIX',
      DEBIT: 'Débito',
      CREDIT_CARD: 'Crédito',
      BOLETO: 'Boleto'
    }
    return methods[method] || method
  }

  const getStatusText = (status: string) => {
    const statuses: Record<string, string> = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Preparando',
      READY: 'Pronto',
      DELIVERING: 'Entregando',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado'
    }
    return statuses[status] || status
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cupom de Pedido - ${order.orderNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.4;
    }
    
    .receipt-container {
      max-width: 400px;
      margin: 0 auto;
      background: white;
      color: #000000;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      font-weight: bold;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    
    .logo {
      margin-bottom: 5px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .logo img {
      width: 60px;
      height: 60px;
      object-fit: contain;
    }
    
    .company-name {
      font-size: 18px;
      font-weight: bold;
      color: #000000;
    }
    
    .company-info {
      font-size: 12px;
      margin-top: 5px;
      color: #000000;
    }
    
    .receipt-title {
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      margin: 15px 0;
      text-transform: uppercase;
      color: #000000;
    }
    
    .section {
      margin: 15px 0;
      padding-bottom: 10px;
      border-bottom: 2px dashed #000;
    }
    
    .section-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
      text-transform: uppercase;
      color: #000000;
    }
    
    .info-line {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 13px;
      color: #000000;
    }
    
    .info-label {
      font-weight: bold;
      color: #000000;
    }
    
    .items-table {
      width: 100%;
      margin: 10px 0;
      font-size: 12px;
    }
    
    .items-table th {
      text-align: left;
      padding: 5px 0;
      border-bottom: 2px solid #000;
      font-weight: bold;
      color: #000000;
    }
    
    .items-table td {
      padding: 8px 0;
      border-bottom: 1px dashed #000;
      color: #000000;
    }
    
    .item-name {
      font-weight: bold;
      color: #000000;
    }
    
    .totals-section {
      margin: 15px 0;
      font-size: 14px;
      color: #000000;
    }
    
    .total-line {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      padding: 5px 0;
      color: #000000;
    }
    
    .total-line.highlight {
      font-size: 18px;
      font-weight: bold;
      border-top: 3px solid #000;
      border-bottom: 3px solid #000;
      padding: 10px 0;
      margin-top: 10px;
      color: #000000;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px dashed #000;
      text-align: center;
      font-size: 12px;
      color: #000000;
    }
    
    .footer-message {
      margin: 10px 0;
      font-style: italic;
    }
    
    .signature-section {
      margin: 20px 0;
      padding: 15px;
      border: 2px solid #000;
      background: #f9f9f9;
    }
    
    .signature-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 10px;
      text-transform: uppercase;
      color: #000000;
      text-align: center;
    }
    
    .signature-warning {
      font-size: 11px;
      color: #dc2626;
      margin-bottom: 15px;
      line-height: 1.6;
      font-weight: bold;
      text-align: center;
    }
    
    .signature-line {
      border-top: 2px solid #000;
      margin-top: 50px;
      padding-top: 5px;
      text-align: center;
      font-size: 11px;
      color: #000000;
    }
    
    .qr-code-placeholder {
      text-align: center;
      padding: 15px;
      background: #f9f9f9;
      border: 1px dashed #ccc;
      margin: 15px 0;
      font-size: 11px;
    }
    
    .no-print {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
    }
    
    .print-button {
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      text-transform: uppercase;
    }
    
    .print-button:hover {
      background: #2563eb;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .receipt-container {
        box-shadow: none;
        max-width: 100%;
        background: white !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .no-print {
        display: none !important;
      }
      
      .print-button {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">
    🖨️ IMPRIMIR CUPOM
  </button>

  <div class="receipt-container">
    <div class="header">
      <div class="logo">
        <img src="/logo.jpg" alt="[SUA EMPRESA]" />
      </div>
      <div class="company-name">ESPETOS GENUÍNO</div>
      <div class="company-info">[SUA EMPRESA]</div>
    </div>
    
    <div class="receipt-title">Cupom de Pedido</div>
    
    <!-- Informações do Pedido -->
    <div class="section">
      <div class="section-title">Dados do Pedido</div>
      <div class="info-line">
        <span class="info-label">Número:</span>
        <span>${order.orderNumber}</span>
      </div>
      <div class="info-line">
        <span class="info-label">Data:</span>
        <span>${formatDate(order.createdAt)}</span>
      </div>
      <div class="info-line">
        <span class="info-label">Status:</span>
        <span>${getStatusText(order.status)}</span>
      </div>
      <div class="info-line">
        <span class="info-label">Tipo:</span>
        <span>${order.orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}</span>
      </div>
    </div>
    
    <!-- Informações do Cliente -->
    <div class="section">
      <div class="section-title">Cliente</div>
      <div class="info-line">
        <span class="info-label">Nome:</span>
        <span>${order.casualCustomerName || order.customerName}</span>
      </div>
      ${order.customerPhone ? `
      <div class="info-line">
        <span class="info-label">Telefone:</span>
        <span>${order.customerPhone}</span>
      </div>
      ` : ''}
      ${order.customer?.city ? `
      <div class="info-line">
        <span class="info-label">Cidade:</span>
        <span>${order.customer.city}</span>
      </div>
      ` : ''}
    </div>
    
    <!-- Informações de Entrega -->
    <div class="section">
      <div class="section-title">Entrega</div>
      <div class="info-line">
        <span class="info-label">Tipo:</span>
        <span>${order.deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}</span>
      </div>
      ${order.deliveryDate ? `
      <div class="info-line">
        <span class="info-label">Data:</span>
        <span>${new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</span>
      </div>
      ` : ''}
      ${order.deliveryTime ? `
      <div class="info-line">
        <span class="info-label">Horário:</span>
        <span>${order.deliveryTime}</span>
      </div>
      ` : ''}
      ${order.deliveryType === 'DELIVERY' && order.address ? `
      <div class="info-line">
        <span class="info-label">Endereço:</span>
      </div>
      <div style="margin-top: 5px; font-size: 12px;">
        ${order.address}
      </div>
      ` : ''}
    </div>
    
    <!-- Itens do Pedido -->
    <div class="section">
      <div class="section-title">Itens</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th style="text-align: center;">Qtd</th>
            <th style="text-align: right;">Unit</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.OrderItem.map((item: any) => {
            // 🔧 FIX: Buscar nome do Product ou RawMaterial
            const itemName = item.Product?.name || item.RawMaterial?.name || 'Item Desconhecido';
            return `
            <tr>
              <td>
                <div class="item-name">${itemName}</div>
              </td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatCurrency(Number(item.unitPrice))}</td>
              <td style="text-align: right;">${formatCurrency(Number(item.total))}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <!-- Totais -->
    <div class="totals-section">
      <div class="total-line">
        <span>Subtotal:</span>
        <span>${formatCurrency(Number(order.subtotal))}</span>
      </div>
      ${Number(order.discount) > 0 ? `
      <div class="total-line" style="color: #16a34a;">
        <span>Desconto ${order.discountPercent ? `(${order.discountPercent}%)` : ''}:</span>
        <span>- ${formatCurrency(Number(order.discount))}</span>
      </div>
      ` : ''}
      ${Number(order.couponDiscount) > 0 ? `
      <div class="total-line" style="color: #f97316;">
        <span>Desconto Cupom:</span>
        <span>- ${formatCurrency(Number(order.couponDiscount))}</span>
      </div>
      ` : ''}
      ${order.Coupon ? `
      <div class="total-line" style="color: #2563eb; border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px;">
        <span style="font-weight: bold;">🎟️ Cupom: #${order.Coupon.code}</span>
        <span style="font-weight: bold;">${order.Coupon.discountType === 'FIXED' ? formatCurrency(Number(order.Coupon.discountValue)) : order.Coupon.discountValue + '%'}</span>
      </div>
      ${order.Coupon.description ? `
      <div style="color: #64748b; font-size: 11px; margin-top: 4px; padding-left: 8px;">
        ${order.Coupon.description}
      </div>
      ` : ''}
      ` : ''}
      ${Number(order.cardFee) > 0 ? `
      <div class="total-line" style="color: #ea580c;">
        <span>Taxa de Cartão:</span>
        <span>+ ${formatCurrency(Number(order.cardFee))}</span>
      </div>
      ` : ''}
      ${(() => {
        // Calcular taxa de entrega: total - subtotal + descontos - taxas
        const calculatedDeliveryFee = Number(order.total) - Number(order.subtotal) + Number(order.discount || 0) + Number(order.couponDiscount || 0) - Number(order.cardFee || 0) - Number(order.boletoFee || 0);
        return calculatedDeliveryFee > 0 ? `
      <div class="total-line" style="color: #0ea5e9;">
        <span>Taxa de Entrega:</span>
        <span>+ ${formatCurrency(calculatedDeliveryFee)}</span>
      </div>
      ` : '';
      })()}
      <div class="total-line highlight">
        <span>TOTAL:</span>
        <span>${formatCurrency(Number(order.total))}</span>
      </div>
    </div>
    
    <!-- Pagamento -->
    <div class="section">
      <div class="section-title">Pagamento</div>
      <div class="info-line">
        <span class="info-label">Método:</span>
        <span>${getPaymentMethodText(order.paymentMethod)}</span>
      </div>
      ${order.secondaryPaymentMethod ? `
      <div class="info-line">
        <span class="info-label">Método 2:</span>
        <span>${getPaymentMethodText(order.secondaryPaymentMethod)}</span>
      </div>
      ${order.primaryPaymentAmount ? `
      <div class="info-line">
        <span>Valor método 1:</span>
        <span>${formatCurrency(Number(order.primaryPaymentAmount))}</span>
      </div>
      ` : ''}
      ${order.secondaryPaymentAmount ? `
      <div class="info-line">
        <span>Valor método 2:</span>
        <span>${formatCurrency(Number(order.secondaryPaymentAmount))}</span>
      </div>
      ` : ''}
      ` : ''}
    </div>
    
    ${order.notes ? `
    <div class="section">
      <div class="section-title">Observações</div>
      <div style="font-size: 12px; margin-top: 5px;">
        ${order.notes}
      </div>
    </div>
    ` : ''}
    
    <!-- Seção de Assinatura -->
    <div class="signature-section">
      <div class="signature-title">Conferência de Recebimento</div>
      <div class="signature-warning">
        ⚠️ ATENÇÃO: Confira sua mercadoria no momento da entrega!<br/>
        Após assinar este cupom, não serão aceitas reclamações posteriores.
      </div>
      <div class="signature-line">
        Assinatura do Cliente - ${order.casualCustomerName || order.customerName}
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-message">
        *** Obrigado pela preferência! ***
      </div>
      <div class="footer-message">
        [SUA EMPRESA] - Qualidade Garantida
      </div>
      <div style="margin-top: 10px; font-size: 10px;">
        Emitido em: ${formatDate(order.createdAt)}
      </div>
    </div>
  </div>
</body>
</html>
  `
}
