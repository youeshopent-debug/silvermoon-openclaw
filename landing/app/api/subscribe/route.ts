import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATA_DIR = '/tmp/data'
const SUBSCRIBERS_PATH = join(DATA_DIR, 'subscribers.jsonl')

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    await mkdir(DATA_DIR, { recursive: true })

    const line = JSON.stringify({
      email: email.toLowerCase(),
      subscribedAt: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown'
    }) + '\n'

    await writeFile(SUBSCRIBERS_PATH, line, { flag: 'a' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
