import type { Env } from './worker.d'

// Pluggable delivery for sign-in codes. The console adapter makes the whole
// passwordless flow work in development with no third-party account: it logs the
// code to the Worker console. Drop in a Resend API key and the same interface
// sends real email instead — no other code changes. Whether the raw code may be
// echoed back to the caller (a dev convenience) is decided by the request host,
// not by the sender, so a real deployment can never leak codes even if email
// delivery is misconfigured (see auth.ts).

export interface EmailSender {
  /** How codes are delivered. */
  readonly mode: 'console' | 'resend'
  /** Deliver a sign-in code to an address. Resolves once handed off. */
  send(to: string, code: string): Promise<void>
}

class ConsoleEmailSender implements EmailSender {
  readonly mode = 'console' as const
  send(to: string, code: string): Promise<void> {
    console.log(`[auth] sign-in code for ${to}: ${code}`)
    return Promise.resolve()
  }
}

class ResendEmailSender implements EmailSender {
  readonly mode = 'resend' as const
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(to: string, code: string): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to,
        subject: `${code} is your FlipScorer sign-in code`,
        text: `Your FlipScorer sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Resend failed (${res.status}): ${detail}`)
    }
  }
}

/**
 * Choose an email sender from the environment: Resend when a key is configured,
 * otherwise the console adapter (logs the code for local development).
 */
export function createEmailSender(env: Env): EmailSender {
  if (env.RESEND_API_KEY) {
    const from = env.EMAIL_FROM ?? 'FlipScorer <onboarding@resend.dev>'
    return new ResendEmailSender(env.RESEND_API_KEY, from)
  }
  return new ConsoleEmailSender()
}
