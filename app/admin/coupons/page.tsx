
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'
import { CouponsManagement } from './coupons-management'

export default async function CouponsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
    redirect('/auth/login')
  }

  return <CouponsManagement />
}
