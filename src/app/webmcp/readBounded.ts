/**
 * Reading a response body with a size limit that holds whatever the headers
 * say: the read stops, and the body is cancelled, as soon as it is exceeded.
 */

/** The body's bytes, or null when it is larger than `limit` bytes. */
export async function readBounded(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(response.headers.get('content-length')) > limit) {
    void response.body?.cancel().catch(() => undefined)
    return null
  }
  const reader = response.body?.getReader()
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    return bytes.length > limit ? null : bytes
  }
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      void reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
