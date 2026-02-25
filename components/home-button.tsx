
'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export function HomeButton() {
  const router = useRouter()
  const { data: session } = useSession() || {}
  const user = session?.user as any

  const handleGoHome = () => {
    if (user?.userType === 'ADMIN') {
      router.push('/admin')
    } else if (user?.userType === 'SELLER') {
      router.push('/seller')
    } else if (user?.userType === 'CUSTOMER') {
      router.push('/dashboard')
    } else {
      router.push('/')
    }
  }

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleGoHome}
      className="flex items-center gap-2"
    >
      <Home className="h-4 w-4" />
      Início
    </Button>
  )
}
