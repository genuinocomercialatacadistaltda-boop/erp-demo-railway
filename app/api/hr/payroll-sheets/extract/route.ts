import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import PDFParser from 'pdf2json';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// API para extração de dados de folha de pagamento em PDF - v5.1 (LLM-powered - Restaurado)
export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;
  
  try {
    console.log('🔍 [EXTRACT API v5.0 - LLM] Iniciando extração...');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    console.log('📄 [EXTRACT] Arquivo:', file.name, 'Tamanho:', (file.size / 1024).toFixed(2), 'KB');

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Salvar temporariamente o buffer em arquivo (pdf2json precisa de arquivo)
    tempFilePath = path.join(os.tmpdir(), `payroll_${Date.now()}.pdf`);
    await fs.writeFile(tempFilePath, buffer);

    // Extrair texto usando pdf2json
    const text = await extractTextFromPDF(tempFilePath);
    
    console.log('✅ [EXTRACT] Texto extraído:', text.length, 'caracteres');
    console.log('📄 [DEBUG] Primeiros 2000 caracteres do texto:');
    console.log(text.substring(0, 2000));

    // ⭐ USAR LLM PARA EXTRAIR DADOS ESTRUTURADOS
    const extractedData = await extractWithLLM(text);
    
    console.log('✅ [EXTRACT] Processado via LLM:', extractedData.employees.length, 'funcionários');

    return NextResponse.json({
      success: true,
      data: extractedData,
      rawText: text.substring(0, 2000) // Primeiros 2000 caracteres para debug
    });

  } catch (error: any) {
    console.error('❌ [EXTRACT] Erro:', error.message);
    return NextResponse.json({ 
      error: 'Erro ao processar PDF',
      details: error.message,
      hint: 'Verifique se o PDF está no formato correto.'
    }, { status: 500 });
  } finally {
    // Limpar arquivo temporário
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Silencioso
      }
    }
  }
}

// Função para extrair texto do PDF usando pdf2json
async function extractTextFromPDF(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1);
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`Erro ao parsear PDF: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      let fullText = '';
      
      if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
        for (const page of pdfData.Pages) {
          if (page.Texts && Array.isArray(page.Texts)) {
            const pageTexts: string[] = [];
            
            for (const text of page.Texts) {
              if (text.R && Array.isArray(text.R)) {
                for (const run of text.R) {
                  if (run.T) {
                    try {
                      pageTexts.push(decodeURIComponent(run.T));
                    } catch {
                      pageTexts.push(run.T);
                    }
                  }
                }
              }
            }
            
            fullText += pageTexts.join(' ') + '\n';
          }
        }
      }
      
      resolve(fullText);
    });
    
    pdfParser.loadPDF(filePath);
  });
}

// ⭐ FUNÇÃO PRINCIPAL: Extração via LLM
async function extractWithLLM(text: string): Promise<{ employees: any[], summary: any }> {
  // Detectar se é contracheque de adiantamento
  const isAdvancePayslip = text.includes('Recibo de Pgto de Adiantamento') || 
                           text.includes('Recibo de Pagamento de Adiantamento') ||
                           text.includes('Pgto de Adiantamento');
  
  console.log(`🔍 [LLM] Tipo de documento detectado: ${isAdvancePayslip ? 'ADIANTAMENTO SALARIAL' : 'FOLHA DE PAGAMENTO NORMAL'}`);
  
  const prompt = isAdvancePayslip ? getAdvancePayslipPrompt(text) : getNormalPayslipPrompt(text);

  try {
    console.log('🤖 [LLM] Enviando texto para análise...');
    
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de documentos de RH brasileiros. Sempre responda em JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [LLM] Erro na API:', response.status, errorText);
      throw new Error(`Erro na API do LLM: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Resposta vazia do LLM');
    }

    console.log('🤖 [LLM] Resposta recebida:', content.substring(0, 500));
    
    // Parsear JSON da resposta
    const parsed = JSON.parse(content);
    
    // Validar e normalizar dados
    const employees = (parsed.employees || []).map((emp: any) => ({
      name: emp.name || 'Nome não identificado',
      cpf: formatCPF(emp.cpf || ''),
      salaryAmount: parseNumber(emp.salary), // Salário base informativo
      advanceAmount: parseNumber(emp.advanceAmount), // Valor do adiantamento (>0 apenas para contracheques de adiantamento)
      foodVoucherAmount: parseNumber(emp.valeAlimentacao),
      bonusAmount: parseNumber(emp.bonus),
      earningsItems: (emp.earningsItems || []).map((item: any) => ({
        description: item.description || 'Vencimento',
        amount: parseNumber(item.amount)
      })).filter((item: any) => item.amount > 0),
      discountItems: (emp.discountItems || []).map((item: any) => ({
        description: item.description || 'Desconto',
        amount: parseNumber(item.amount)
      })).filter((item: any) => item.amount > 0),
      // Campos calculados para o frontend
      deductions: parseNumber(emp.totalDiscounts), // Total de descontos
      netAmount: parseNumber(emp.netValue), // Valor líquido
      paymentType: emp.paymentType || 'SALARIO',
      notes: ''
    }));

    console.log('✅ [LLM] Funcionários extraídos:', employees.length);
    employees.forEach((emp: any, i: number) => {
      const isAdvance = emp.paymentType === 'ADIANTAMENTO';
      console.log(`   ${i+1}. ${emp.name} - CPF: ${emp.cpf}`);
      console.log(`      💰 Salário Base: R$ ${emp.salaryAmount?.toFixed(2) || 0}`);
      if (isAdvance || emp.advanceAmount > 0) {
        console.log(`      🏦 Adiantamento: R$ ${emp.advanceAmount?.toFixed(2) || 0}`);
      }
      console.log(`      📊 Tipo: ${emp.paymentType}`);
      console.log(`      💵 Valor Líquido: R$ ${emp.netAmount?.toFixed(2) || 0}`);
      if (emp.earningsItems?.length > 0) {
        console.log(`      📈 Vencimentos Extras: ${emp.earningsItems.map((e: any) => `${e.description}: R$ ${e.amount.toFixed(2)}`).join(', ')}`);
      }
      if (emp.discountItems?.length > 0) {
        console.log(`      📉 Descontos: ${emp.discountItems.map((d: any) => `${d.description}: R$ ${d.amount.toFixed(2)}`).join(', ')}`);
      }
    });

    return {
      employees,
      summary: parsed.summary || {
        totalEmployees: employees.length,
        documentType: 'Folha de Pagamento',
        referenceMonth: null
      }
    };

  } catch (error: any) {
    console.error('❌ [LLM] Erro ao processar:', error.message);
    throw new Error(`Erro na extração via LLM: ${error.message}`);
  }
}

// ======================================
// FUNÇÕES DE PROMPT PARA DIFERENTES TIPOS DE CONTRACHEQUE
// ======================================

// Prompt para FOLHA DE PAGAMENTO NORMAL (final do mês)
function getNormalPayslipPrompt(text: string): string {
  return `Você é um especialista em análise de contracheques/holerites brasileiros.

Analise o texto abaixo extraído de um PDF de folha de pagamento e extraia os dados de TODOS os funcionários encontrados.

=== ESTRUTURA DO CONTRACHEQUE ===
O contracheque tem formato tabular com 5 colunas:
CÓD. | DESCRIÇÃO | REFERÊNCIA | VENCIMENTOS | DESCONTOS

EXEMPLO REAL de linha do contracheque:
"1 Salário base 31,00 2.299,75"
Interpretação:
- Código: 1
- Descrição: Salário base
- Referência: 31,00 (dias trabalhados - IGNORAR!)
- Vencimentos: 2.299,75 ← ESTE É O SALÁRIO!
- Descontos: (vazio)

=== REGRA CRÍTICA DO SALÁRIO ===
⚠️ O SALÁRIO BASE está SEMPRE na coluna VENCIMENTOS, NUNCA na coluna REFERÊNCIA!
- A coluna REFERÊNCIA contém dias/horas: 31, 30, 31,00, *9,00 - NUNCA use como valor monetário
- A coluna VENCIMENTOS contém valores em R$: 2.299,75, 1.895,40, etc - ESTE É O SALÁRIO
- Procure "Salário base" ou "Salário Base" - o valor ao lado direito (maior que 500) é o salário

=== VENCIMENTOS EXTRAS (além do salário) - MUITO IMPORTANTE! ===
Extraia TODOS os vencimentos adicionais e coloque em earningsItems:
- Hora Extra 50% (código 5) ← valor na coluna VENCIMENTOS
- Hora Extra 100% (código 6) ← valor na coluna VENCIMENTOS
- (DSR) Repouso remunerado (código 10) ← IMPORTANTE! Extrair este valor!
- DSR ou D.S.R. ← Mesmo que "Repouso remunerado"
- Adicional Noturno
- Salário Família (código 91 ou similar) ← IMPORTANTE! Valor pago por filho
- Gratificação
- Comissão
- Periculosidade
- Insalubridade

⚠️ EXEMPLO DSR: "10 (DSR) Repouso remunerado 151,88" → earningsItems: {"description": "DSR - Repouso Remunerado", "amount": 151.88}
⚠️ EXEMPLO HORA EXTRA: "5 Hora extra 50% 61:05 789,76" → earningsItems: {"description": "Hora Extra 50%", "amount": 789.76}

=== DESCONTOS - EXTRAIR TODOS ===
Extraia CADA desconto separadamente:
- INSS (código 71)
- Adiantamento salarial anterior (código 74) ← ATENÇÃO: Este é um DESCONTO do adiantamento já pago!
- Faltas (código 78) ← IMPORTANTE! Extrair valor de faltas!
- Falta - Horas (código 78 ou similar) ← Mesmo que "Faltas", desconto por horas não trabalhadas
- eConsignado - Folha (código 347) - parcela normal do empréstimo
- eConsignado - Adiantamento (código 352) - parcela extra do empréstimo ← NÃO ESQUECER!
- D.S.R. descontado por falta ← DESCONTO, não confundir com DSR vencimento!
- IRRF
- Vale Transporte
- Pensão Alimentícia
- Empréstimo Consignado

⚠️ EXEMPLO FALTA: "78 Faltas 7,30 54,10" → discountItems: {"description": "Faltas", "amount": 54.10}
⚠️ O código 78 pode aparecer como "Faltas", "Falta - Horas", "Falta Horas" - EXTRAIA SEMPRE!

⚠️ eConsignado - Folha e eConsignado - Adiantamento são DESCONTOS DIFERENTES! Extraia ambos!

=== REGRA CRÍTICA SOBRE advanceAmount ===
⚠️ O campo "advanceAmount" deve ser SEMPRE 0 (zero) para contracheques normais!
- "Adiantamento salarial anterior" NÃO vai em advanceAmount - vai em discountItems!
- advanceAmount é usado APENAS para contracheques de ADIANTAMENTO (pagamento do dia 20)

=== FORMATO DE SAÍDA ===
Para cada funcionário:
{
  "name": "Nome completo",
  "cpf": "000.000.000-00",
  "salary": número (Salário Base da coluna VENCIMENTOS - valor > 500),
  "advanceAmount": 0,
  "valeAlimentacao": 0,
  "bonus": 0,
  "earningsItems": [
    {"description": "Hora Extra 50%", "amount": número},
    {"description": "DSR - Repouso Remunerado", "amount": número},
    {"description": "Salário Família", "amount": número}
  ],
  "discountItems": [
    {"description": "INSS", "amount": número},
    {"description": "Adiantamento salarial anterior", "amount": número},
    {"description": "Faltas", "amount": número},
    {"description": "eConsignado - Folha", "amount": número},
    {"description": "eConsignado - Adiantamento", "amount": número},
    {"description": "Falta - Horas", "amount": número},
    {"description": "D.S.R. descontado por falta", "amount": número}
  ],
  "totalEarnings": número,
  "totalDiscounts": número,
  "netValue": número,
  "paymentType": "SALARIO",
  "notes": ""
}

TEXTO DO PDF:
${text}

Responda APENAS com JSON válido no formato:
{
  "employees": [array de funcionários],
  "summary": {
    "totalEmployees": número,
    "documentType": "Folha de Pagamento",
    "referenceMonth": "MM/YYYY se identificável"
  }
}`;
}

// Prompt para CONTRACHEQUE DE ADIANTAMENTO SALARIAL (dia 20)
function getAdvancePayslipPrompt(text: string): string {
  return `Você é um especialista em análise de contracheques/holerites brasileiros.

⚠️ ATENÇÃO CRÍTICA: Este é um RECIBO DE PAGAMENTO DE ADIANTAMENTO SALARIAL (pagamento do dia 20).
É COMPLETAMENTE DIFERENTE da folha de pagamento normal do final do mês!

=== REGRAS ABSOLUTAS PARA ADIANTAMENTO ===

1. ⚠️ O campo "salary" DEVE SER SEMPRE 0 (ZERO)!
   - IGNORE completamente qualquer "Salário Base" que apareça no rodapé
   - Em adiantamento NÃO extraímos salário, apenas o valor do adiantamento

2. O campo "advanceAmount" recebe o valor de "Adiantamento salarial" da coluna VENCIMENTOS
   - Este é o valor que o funcionário vai receber
   - Exemplo: "Adiantamento salarial 758,16" → advanceAmount: 758.16

3. ⚠️ "Adiantamento salarial" NÃO É DESCONTO! É VENCIMENTO!
   - Nunca coloque "Adiantamento salarial" em discountItems
   - Apenas descontos REAIS como eConsignado vão em discountItems

4. DESCONTOS possíveis em adiantamento:
   - eConsignado - Adiantamento (parcela do empréstimo consignado)
   - Outros descontos específicos
   - Se não houver descontos, discountItems deve ser array vazio []

=== EXEMPLOS DE EXTRAÇÃO ===

EXEMPLO 1 - Eliete (SEM descontos):
Texto: "Adiantamento salarial 758,16 Total de Vencimentos 758,16 Valor Líquido 758,16"
Extração:
{
  "name": "Eliete Ferreira da Anunciacao",
  "cpf": "088.267.931-74",
  "salary": 0,                 ← SEMPRE ZERO em adiantamento!
  "advanceAmount": 758.16,     ← Valor do adiantamento
  "discountItems": [],         ← Vazio pois não tem descontos
  "totalEarnings": 758.16,
  "totalDiscounts": 0,
  "netValue": 758.16,
  "paymentType": "ADIANTAMENTO"
}

EXEMPLO 2 - Jonathan (COM desconto de eConsignado):
Texto: "Adiantamento salarial 919,90 eConsignado - Adiantamento 118,44 Total de Vencimentos 919,90 Total de Descontos 118,44 Valor Líquido 801,46"
Extração:
{
  "name": "Jonathan Pereira de Souza",
  "cpf": "061.141.081-83",
  "salary": 0,                 ← SEMPRE ZERO em adiantamento!
  "advanceAmount": 919.90,     ← Valor do adiantamento
  "discountItems": [
    {"description": "eConsignado - Adiantamento", "amount": 118.44}
  ],
  "totalEarnings": 919.90,
  "totalDiscounts": 118.44,
  "netValue": 801.46,
  "paymentType": "ADIANTAMENTO"
}

=== FORMATO DE SAÍDA ===
Para cada funcionário:
{
  "name": "Nome completo",
  "cpf": "000.000.000-00",
  "salary": 0,                 ← SEMPRE ZERO!
  "advanceAmount": número,     ← Valor de "Adiantamento salarial" dos VENCIMENTOS
  "valeAlimentacao": 0,
  "bonus": 0,
  "earningsItems": [],
  "discountItems": [           ← Apenas descontos REAIS (eConsignado, etc)
    {"description": "nome", "amount": número}
  ],
  "totalEarnings": número,     ← Igual ao advanceAmount
  "totalDiscounts": número,
  "netValue": número,          ← advanceAmount - totalDiscounts
  "paymentType": "ADIANTAMENTO",
  "notes": ""
}

TEXTO DO PDF:
${text}

Responda APENAS com JSON válido no formato:
{
  "employees": [array de funcionários],
  "summary": {
    "totalEmployees": número,
    "documentType": "Adiantamento",
    "referenceMonth": "MM/YYYY se identificável"
  }
}`;
}

// Funções auxiliares
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remover caracteres não numéricos exceto vírgula e ponto
    const cleaned = value.replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function formatCPF(cpf: string): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function buildNotes(emp: any): string {
  const parts: string[] = [];
  
  if (emp.paymentType === 'ADIANTAMENTO') {
    parts.push('💰 Tipo: Adiantamento Salarial');
  } else if (emp.paymentType === 'DECIMO_TERCEIRO') {
    parts.push('🎄 Tipo: 13º Salário');
  }
  
  if (emp.earningsItems && emp.earningsItems.length > 0) {
    parts.push('\n📈 Vencimentos Adicionais:');
    emp.earningsItems.forEach((item: any) => {
      const amount = parseNumber(item.amount);
      if (amount > 0) {
        parts.push(`  • ${item.description}: R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      }
    });
  }
  
  if (emp.discountItems && emp.discountItems.length > 0) {
    parts.push('\n📉 Descontos:');
    emp.discountItems.forEach((item: any) => {
      const amount = parseNumber(item.amount);
      if (amount > 0) {
        parts.push(`  • ${item.description}: R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      }
    });
  }
  
  if (emp.notes && typeof emp.notes === 'string') {
    parts.push(`\n📝 ${emp.notes}`);
  }
  
  return parts.join('\n');
}
