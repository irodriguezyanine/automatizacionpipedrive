import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function HomePage() {
  const c = await cookies()
  if (c.get('vedisa_admin')?.value === 'ok') {
    redirect('/dashboard')
  }
  redirect('/login')
}
