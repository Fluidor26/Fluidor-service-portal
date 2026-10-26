import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function Home() {
  const { isStaff } = await getSession();
  redirect(isStaff ? '/tickets' : '/installaties');
}
