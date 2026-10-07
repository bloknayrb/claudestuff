/** cyrb53: a fast 53-bit string hash. A collision only costs one wrong re-issue match. */
export function cyrb53(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

export type SpawnFields = { prompt: string; description: string; subagentType: string; model: string | undefined }

/** Re-issue identity: prompt, description, agent type and model, never tool_use_id (a re-issue gets a new one). */
export function spawnHash(f: SpawnFields): string {
  return cyrb53(JSON.stringify([f.prompt, f.description, f.subagentType, f.model ?? null]))
}

/**
 * Task identity: the same prompt and description under any model or agent type. Links a changed call
 * back to its deny; switching to a typed agent such as Explore is acting on the deny too.
 */
export function taskHash(f: Pick<SpawnFields, 'prompt' | 'description'>): string {
  return cyrb53(JSON.stringify([f.prompt, f.description]))
}
