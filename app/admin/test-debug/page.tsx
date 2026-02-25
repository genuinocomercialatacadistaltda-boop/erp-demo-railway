export const dynamic = "force-dynamic"

export default async function TestDebugPage() {
  const logs = [];
  
  try {
    logs.push("✅ Página carregou");
    
    // Test 1: Environment variables
    logs.push(`DATABASE_URL: ${process.env.DATABASE_URL ? "DEFINIDA" : "NÃO DEFINIDA"}`);
    
    // Test 2: Date operations  
    const today = new Date();
    logs.push(`Data atual: ${today.toISOString()}`);
    
    // Test 3: Simple data
    const testData = {
      dailyRevenue: 1234.56,
      monthlyRevenue: 9876.54
    };
    logs.push(`Teste de serialização: ${JSON.stringify(testData)}`);
    
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Página de Diagnóstico</h1>
        <div className="space-y-2">
          {logs.map((log, i) => (
            <div key={i} className="p-2 bg-gray-100 rounded">
              {log}
            </div>
          ))}
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">ERRO</h1>
        <pre className="bg-red-100 p-4 rounded">
          {error.message}
          {"\n"}
          {error.stack}
        </pre>
      </div>
    );
  }
}
