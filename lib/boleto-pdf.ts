
// Boleto PDF Generation Service
// This generates a professional-looking boleto PDF with PIX QR Code

export interface BoletoData {
  boletoNumber: string
  customerName: string
  customerCpfCnpj: string
  customerAddress: string
  customerEmail?: string
  amount: number
  dueDate: Date
  issueDate: Date
  description: string
  pixQrCode: string // Copia e cola
  pixQrCodeBase64: string // QR Code image
  barcodeNumber?: string // Código de barras do boleto
  digitableLine?: string // Linha digitável do boleto
  fineAmount?: number
  interestAmount?: number
  isOverdue?: boolean
  daysOverdue?: number
  installmentInfo?: {
    number: number
    total: number
  }
}

export async function generateBoletoPDF(data: BoletoData): Promise<string> {
  const {
    boletoNumber,
    customerName,
    customerCpfCnpj,
    customerAddress,
    customerEmail,
    amount,
    dueDate,
    issueDate,
    description,
    pixQrCode,
    pixQrCodeBase64,
    barcodeNumber,
    digitableLine,
    fineAmount = 0,
    interestAmount = 0,
    isOverdue = false,
    daysOverdue = 0,
    installmentInfo
  } = data

  const totalAmount = amount + fineAmount + interestAmount
  const formattedDueDate = new Date(dueDate).toLocaleDateString('pt-BR')
  const formattedIssueDate = new Date(issueDate).toLocaleDateString('pt-BR')
  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)
  const formattedOriginalAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boleto - ${boletoNumber}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: Arial, sans-serif;
      background: white;
      padding: 5px;
      font-size: 10px;
    }
    
    .boleto-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border: 2px solid #333;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      background: #f97316;
      color: white;
      border-bottom: 2px solid #333;
    }
    
    .logo { 
      font-size: 16px; 
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .logo img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }
    .bank-info { text-align: right; font-size: 11px; }
    
    .content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 6px 10px;
    }
    
    .info-box {
      border: 1px solid #ddd;
      padding: 3px;
      background: #fafafa;
    }
    
    .info-label {
      font-size: 8px;
      color: #666;
      margin-bottom: 1px;
    }
    
    .info-value {
      font-size: 10px;
      font-weight: bold;
      color: #000;
    }
    
    .full-width { grid-column: 1 / -1; }
    
    .amount-box {
      grid-column: 1 / -1;
      text-align: center;
      background: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 6px;
      margin: 3px 0;
    }
    
    .amount-value {
      font-size: 20px;
      font-weight: bold;
      color: #78350f;
    }
    
    ${isOverdue ? `
    .overdue-box {
      grid-column: 1 / -1;
      background: #fef2f2;
      border: 2px solid #ef4444;
      padding: 8px;
      text-align: center;
      color: #dc2626;
      font-weight: bold;
    }
    ` : ''}
    
    .barcode-section {
      grid-column: 1 / -1;
      border-top: 2px dashed #333;
      padding: 5px 0;
      text-align: center;
    }
    
    .barcode-title {
      font-size: 10px;
      font-weight: bold;
      margin-bottom: 3px;
    }
    
    #barcode-canvas {
      max-width: 100%;
      height: auto;
      margin: 5px 0;
    }
    
    .digitable-line-box {
      background: #f9fafb;
      border: 2px solid #d1d5db;
      padding: 5px;
      margin: 5px 0;
      position: relative;
    }
    
    .digitable-line-code {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 0.5px;
      word-break: break-all;
      padding-right: 60px;
    }
    
    .copy-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      padding: 6px 12px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
      font-weight: bold;
    }
    
    .copy-btn:hover { background: #059669; }
    .copy-btn:active { background: #047857; }
    
    .pix-section {
      grid-column: 1 / -1;
      border-top: 2px dashed #333;
      padding: 5px;
      text-align: center;
      background: #f8f9fa;
    }
    
    .pix-title {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 4px;
      color: #333;
    }
    
    .qr-code {
      width: 120px;
      height: 120px;
      margin: 3px auto;
      display: block;
      background: white;
      padding: 3px;
      border: 2px solid #ddd;
    }
    
    .pix-copy-box {
      background: white;
      border: 1px solid #ddd;
      padding: 4px;
      margin-top: 4px;
      position: relative;
      text-align: left;
    }
    
    .pix-copy-label {
      font-size: 8px;
      color: #666;
      margin-bottom: 2px;
    }
    
    .pix-copy-code {
      font-family: 'Courier New', monospace;
      font-size: 7px;
      word-break: break-all;
      max-height: 40px;
      overflow-y: auto;
      padding-right: 60px;
    }
    
    .footer {
      grid-column: 1 / -1;
      border-top: 1px solid #ddd;
      padding: 4px;
      text-align: center;
      font-size: 8px;
      color: #666;
      margin-top: 3px;
    }
    
    .no-print {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
    }
    
    .print-btn {
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .print-btn:hover { background: #2563eb; }
    
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .boleto-container { border: none; }
      button { display: none !important; }
    }
    
    @page {
      size: A4;
      margin: 10mm;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ IMPRIMIR</button>

  <div class="boleto-container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <img src="/logo.jpg" alt="Logo" />
        ESPETOS GENUÍNO
      </div>
      <div class="bank-info">BANCO CORA (403)</div>
    </div>

    <!-- Content -->
    <div class="content">
      ${isOverdue ? `
      <div class="overdue-box">
        ⚠️ BOLETO VENCIDO HÁ ${daysOverdue} DIA${daysOverdue > 1 ? 'S' : ''} - MULTA E JUROS APLICADOS
      </div>
      ` : ''}

      <div class="info-box">
        <div class="info-label">Número do Boleto</div>
        <div class="info-value">${boletoNumber}</div>
      </div>

      <div class="info-box">
        <div class="info-label">Vencimento</div>
        <div class="info-value">${formattedDueDate}</div>
      </div>

      <div class="info-box full-width">
        <div class="info-label">Pagador</div>
        <div class="info-value">${customerName} - CPF/CNPJ: ${customerCpfCnpj}</div>
      </div>

      <div class="info-box full-width">
        <div class="info-label">Descrição</div>
        <div class="info-value">${description}${installmentInfo ? ` - Parcela ${installmentInfo.number}/${installmentInfo.total}` : ''}</div>
      </div>

      <div class="amount-box">
        <div style="font-size: 10px; color: #92400e; margin-bottom: 5px;">
          ${isOverdue ? 'VALOR TOTAL COM MULTA E JUROS' : 'VALOR DO BOLETO'}
        </div>
        <div class="amount-value">${formattedAmount}</div>
        ${isOverdue ? `
        <div style="font-size: 9px; color: #92400e; margin-top: 5px;">
          Original: ${formattedOriginalAmount} | Multa: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fineAmount)} | Juros: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(interestAmount)}
        </div>
        ` : ''}
      </div>

      ${barcodeNumber && digitableLine ? `
      <!-- Barcode Section -->
      <div class="barcode-section">
        <div class="barcode-title">📊 CÓDIGO DE BARRAS</div>
        <canvas id="barcode-canvas"></canvas>
        
        <div class="barcode-title" style="margin-top: 10px;">📋 LINHA DIGITÁVEL</div>
        <div class="digitable-line-box">
          <div class="digitable-line-code" id="digitable-line">${digitableLine}</div>
          <button class="copy-btn" onclick="copyDigitableLine()">📋 COPIAR</button>
        </div>
        <p style="font-size: 9px; color: #666; margin-top: 5px;">
          Use esta linha para pagar em qualquer banco ou app bancário
        </p>
      </div>
      ` : ''}

      <!-- PIX Section -->
      ${pixQrCode && pixQrCodeBase64 ? `
      <div class="pix-section">
        <div class="pix-title">💳 PAGUE COM PIX</div>
        <img class="qr-code" src="data:image/png;base64,${pixQrCodeBase64}" alt="QR Code PIX" />
        
        <div class="pix-copy-box">
          <div class="pix-copy-label">PIX COPIA E COLA:</div>
          <div class="pix-copy-code" id="pix-code">${pixQrCode}</div>
          <button class="copy-btn" onclick="copyPixCode()">📋 COPIAR</button>
        </div>
        <p style="font-size: 9px; color: #666; margin-top: 5px;">
          Escaneie o QR Code OU copie o código e cole no seu app bancário
        </p>
      </div>
      ` : ''}

      <!-- Avisos e Informações Importantes -->
      <div style="grid-column: 1 / -1; border-top: 2px solid #333; padding: 8px; background: #fffbeb; margin-top: 5px;">
        <div style="font-size: 11px; font-weight: bold; color: #dc2626; text-align: center; margin-bottom: 5px;">
          ⚠️ ATENÇÃO - AVISOS IMPORTANTES ⚠️
        </div>
        
        <div style="background: #fef2f2; border: 2px solid #ef4444; padding: 5px; margin: 5px 0; border-radius: 3px;">
          <div style="font-weight: bold; color: #dc2626; font-size: 10px; margin-bottom: 3px;">
            🚨 PAGAMENTO EM ATRASO BLOQUEIA NOVOS PEDIDOS
          </div>
          <div style="font-size: 9px; color: #991b1b;">
            Cliente com boletos vencidos não poderá realizar novos pedidos até a regularização do pagamento. Mantenha seus pagamentos em dia!
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 5px 0;">
          <div style="border: 1px solid #d1d5db; padding: 5px; background: white; border-radius: 3px;">
            <div style="font-weight: bold; font-size: 9px; color: #16a34a; margin-bottom: 2px;">
              📱 WHATSAPP
            </div>
            <div style="font-size: 10px; font-weight: bold; color: #000;">
              (63) 99999-7942
            </div>
          </div>

          <div style="border: 1px solid #d1d5db; padding: 5px; background: white; border-radius: 3px;">
            <div style="font-weight: bold; font-size: 9px; color: #f97316; margin-bottom: 2px;">
              🕐 HORÁRIO DE FUNCIONAMENTO
            </div>
            <div style="font-size: 9px; color: #000; line-height: 1.3;">
              Seg-Sex: 8h-18h (Almoço: 12h-14h)<br>
              Sábado: 8h-12h
            </div>
          </div>
        </div>

        <div style="border: 1px solid #d1d5db; padding: 5px; background: white; border-radius: 3px; margin: 5px 0;">
          <div style="font-weight: bold; font-size: 9px; color: #2563eb; margin-bottom: 3px;">
            📦 HORÁRIO DE ENTREGAS
          </div>
          <div style="font-size: 9px; color: #000; line-height: 1.3;">
            • Pedidos até 15h: entrega no mesmo dia<br>
            • Pedidos após 15h: entrega no próximo dia<br>
            • Fora da cidade: 1 dia de antecedência<br>
            • Entregas: Seg-Sex, 16h-18h (horário fixo)
          </div>
        </div>

        <div style="border-top: 2px solid #333; margin-top: 8px; padding-top: 8px;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 8px; text-align: center;">
            ✍️ COMPROVANTE DE RECEBIMENTO
          </div>
          
          <div style="background: #f9fafb; padding: 5px; border-radius: 3px; margin-bottom: 8px; border: 1px solid #d1d5db;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 8px;">
              <div>
                <span style="color: #666;">Boleto:</span>
                <strong style="margin-left: 3px;">${boletoNumber}</strong>
              </div>
              <div>
                <span style="color: #666;">Venc:</span>
                <strong style="margin-left: 3px;">${formattedDueDate}</strong>
              </div>
              <div style="grid-column: 1 / -1;">
                <span style="color: #666;">Cliente:</span>
                <strong style="margin-left: 3px;">${customerName}</strong>
              </div>
              <div style="grid-column: 1 / -1;">
                <span style="color: #666;">CPF/CNPJ:</span>
                <strong style="margin-left: 3px;">${customerCpfCnpj}</strong>
              </div>
              <div style="grid-column: 1 / -1;">
                <span style="color: #666;">Valor:</span>
                <strong style="margin-left: 3px;">${formattedOriginalAmount}</strong>
              </div>
            </div>
          </div>
          
          <div style="margin-top: 8px;">
            <div style="font-size: 8px; margin-bottom: 5px; text-align: center; color: #666;">
              Declaro que recebi este boleto bancário
            </div>
            <div style="border-bottom: 2px solid #333; height: 30px; margin-bottom: 5px;"></div>
            <div style="font-size: 8px; color: #666; text-align: center;">
              Assinatura do Cliente
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <strong>ESPETOS GENUÍNO</strong> | Boleto gerado em ${new Date().toLocaleString('pt-BR')}<br>
        Em caso de dúvidas, entre em contato conosco pelo WhatsApp (63) 99999-7942
      </div>
    </div>
  </div>

  <script>
    // Generate barcode
    ${barcodeNumber ? `
    try {
      JsBarcode("#barcode-canvas", "${barcodeNumber}", {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: false,
        margin: 3
      });
    } catch (e) {
      console.error('Erro ao gerar código de barras:', e);
    }
    ` : ''}

    // Copy digitable line
    function copyDigitableLine() {
      const text = document.getElementById('digitable-line').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ COPIADO!';
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      }).catch(err => {
        alert('Erro ao copiar: ' + err);
      });
    }

    // Copy PIX code
    function copyPixCode() {
      const text = document.getElementById('pix-code').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ COPIADO!';
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      }).catch(err => {
        alert('Erro ao copiar: ' + err);
      });
    }
  </script>
</body>
</html>
  `

  return html
}
