
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Award, Medal, TrendingUp } from 'lucide-react';

interface RankingItem {
  rank: number;
  id: string;
  name: string;
  city: string;
  pointsBalance: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  _count: {
    Order: number;
  };
}

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    try {
      const response = await fetch('/api/admin/rewards/ranking?limit=20');
      if (response.ok) {
        const data = await response.json();
        setRanking(data);
      }
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-8 w-8 text-yellow-500" />;
      case 2:
        return <Award className="h-8 w-8 text-gray-400" />;
      case 3:
        return <Medal className="h-8 w-8 text-amber-700" />;
      default:
        return <div className="h-8 w-8 flex items-center justify-center font-bold text-lg text-muted-foreground">{rank}</div>;
    }
  };

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-50 border-yellow-200';
      case 2:
        return 'bg-gray-50 border-gray-200';
      case 3:
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando ranking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🏆 Ranking de Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Top {ranking.length} clientes com mais pontos acumulados
        </p>
      </div>

      {ranking.length > 0 && (
        <>
          {/* Top 3 em destaque */}
          <div className="grid gap-4 md:grid-cols-3">
            {ranking.slice(0, 3).map((item) => (
              <Card key={item.id} className={getRankBgColor(item.rank)}>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-2">
                    {getRankIcon(item.rank)}
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.city}</p>
                    <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                      <TrendingUp className="h-6 w-6" />
                      {Math.round(item.pointsBalance)} pts
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                      <span>✓ {item.totalPointsEarned.toFixed(0)} ganhos</span>
                      <span>🛍️ {item._count.Order} pedidos</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Restante do ranking */}
          <Card>
            <CardHeader>
              <CardTitle>Classificação Completa</CardTitle>
              <CardDescription>
                Todos os clientes ordenados por pontos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ranking.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${getRankBgColor(item.rank)}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-12">
                        {getRankIcon(item.rank)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.city}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          {Math.round(item.pointsBalance)} pts
                        </Badge>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>✓ {item.totalPointsEarned.toFixed(0)}</span>
                          <span>↓ {item.totalPointsRedeemed.toFixed(0)}</span>
                          <span>🛍️ {item._count.Order}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {ranking.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cliente com pontos ainda</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
