import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Document openen. De rechten (RLS) bepalen of de gebruiker het document mag zien;
 * daarna volgt een tijdelijke downloadlink van 60 seconden.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase.from('documents').select('storage_path, file_name').eq('id', params.id).maybeSingle();
  if (!doc) return new NextResponse('Document niet gevonden of geen toegang.', { status: 404 });
  const download = request.nextUrl.searchParams.has('download');
  const { data, error } = await supabase.storage
    .from('documenten')
    .createSignedUrl(doc.storage_path, 60, download ? { download: doc.file_name } : undefined);
  if (error || !data) return new NextResponse('Document kon niet worden geopend.', { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
