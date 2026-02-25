
'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface FinancialAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action?: string;
}

export function FinancialAlerts() {
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadAlerts();
    // Recarregar alertas a cada 5 minutos
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/financial/alerts/check');
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <AlertCircle className="h-4 w-4" />;
      case 'medium':
        return <Info className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getAlertVariant = (severity: string) => {
    if (severity === 'critical') return 'destructive';
    return 'default';
  };

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />;
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Alertas Financeiros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>Nenhum alerta no momento</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Alertas Financeiros ({alerts.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.slice(0, 5).map((alert, index) => (
          <Alert key={index} variant={getAlertVariant(alert.severity)}>
            {getAlertIcon(alert.severity)}
            <AlertTitle className="text-sm">{alert.title}</AlertTitle>
            <AlertDescription className="text-xs">
              {alert.description}
              {alert.action && (
                <Button
                  variant="link"
                  size="sm"
                  className="ml-2 h-auto p-0"
                  onClick={() => router.push(alert.action!)}
                >
                  Ver detalhes →
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ))}
        {alerts.length > 5 && (
          <p className="text-xs text-gray-500 text-center">
            + {alerts.length - 5} alertas adicionais
          </p>
        )}
      </CardContent>
    </Card>
  );
}
