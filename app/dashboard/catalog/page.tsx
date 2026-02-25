
'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CatalogClient } from './_components/catalog-client'

export default function CatalogPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const user = session?.user as any

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || user?.userType !== 'CUSTOMER') {
      router.push('/auth/login')
    }
  }, [session, status, user?.userType, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white animate-pulse">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
            </svg>
          </div>
          <p className="text-lg text-gray-600">Carregando catálogo...</p>
        </div>
      </div>
    )
  }

  if (!session || user?.userType !== 'CUSTOMER') {
    return null
  }

  return (
    <CatalogClient 
      customerId={user.customerId}
      userName={user.name}
    />
  )
}
