import { createHash } from 'crypto';
import ssh2 from 'ssh2';

/** OpenSSH-style SHA256 fingerprint of a public key blob (matches ssh-keygen -lf). */
export function fingerprintOf(keyData: Buffer): string {
  const b64 = createHash('sha256').update(keyData).digest('base64').replace(/=+$/, '');
  return `SHA256:${b64}`;
}

export interface PubkeyCtx {
  key: { algo: string; data: Buffer };
  signature?: Buffer;
  blob?: Buffer;
  hashAlgo?: string;
}

/**
 * Verify a publickey auth attempt proves key ownership. Returns true only on a
 * valid signature. Reconstructs the offered key and checks ctx.signature over
 * ctx.blob (the exact bytes the client signed), per the ssh2 server contract.
 */
export function verifyPubkey(ctx: PubkeyCtx): boolean {
  if (!ctx.signature || !ctx.blob) return false;
  try {
    const openssh = `${ctx.key.algo} ${ctx.key.data.toString('base64')}`;
    const parsed = ssh2.utils.parseKey(openssh);
    if (!parsed || parsed instanceof Error) { console.error('[identity] parseKey failed', parsed); return false; }
    const key = Array.isArray(parsed) ? parsed[0]! : parsed;
    const ok = key.verify(ctx.blob, ctx.signature, ctx.hashAlgo);
    return ok === true;
  } catch (e) {
    console.error('[identity] verify threw', (e as Error).message);
    return false;
  }
}
