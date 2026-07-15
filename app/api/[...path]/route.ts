import { NextRequest, NextResponse } from 'next/server';

const DEV_BACKEND = process.env.LOCAL_DEV_BACKEND_URL?.replace(/\/$/, '');

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!DEV_BACKEND) {
    return NextResponse.json({ error: 'local_dev_backend_not_configured' }, { status: 404 });
  }

  const { path } = await context.params;
  const target = new URL(`/api/${path.join('/')}/`, DEV_BACKEND);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.set('host', target.host);
  headers.delete('connection');

  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const response = await fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
