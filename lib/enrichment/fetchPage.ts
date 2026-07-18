import { ProxyAgent } from 'undici'

const CAP = 12000

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CAP)

async function viaOxylabs(url: string): Promise<string> {
  const { OXYLABS_USERNAME, OXYLABS_PASSWORD, OXYLABS_PROXY } = process.env
  if (!OXYLABS_USERNAME || !OXYLABS_PROXY) return ''
  const dispatcher = new ProxyAgent({
    uri: `http://${OXYLABS_PROXY}`,
    token: 'Basic ' + Buffer.from(`${OXYLABS_USERNAME}:${OXYLABS_PASSWORD}`).toString('base64'),
  })
  try {
    // @ts-expect-error undici dispatcher option
    const r = await fetch(url, { dispatcher })
    return r.ok ? strip(await r.text()) : ''
  } catch {
    return ''
  }
}

export async function getPageContent(url: string, tavilyContent: string): Promise<string> {
  if (tavilyContent && tavilyContent.length > 200) return tavilyContent.slice(0, CAP)
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return ''
    }
  })()
  const needsProxy = /amazon\.|ebay\./.test(host)
  if (!needsProxy) {
    try {
      const r = await fetch(url)
      if (r.ok) return strip(await r.text())
    } catch {}
  }
  return viaOxylabs(url)
}
