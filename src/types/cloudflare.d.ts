declare global {
  type KVNamespaceGetOptions = { type?: 'text' }

  type KVNamespacePutOptions = {
    expiration?: number
    expirationTtl?: number
    metadata?: unknown
  }

  interface KVNamespace {
    get(key: string, options?: KVNamespaceGetOptions): Promise<string | null>
    put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: KVNamespacePutOptions
    ): Promise<void>
    delete(key: string): Promise<void>
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement
    first<T = unknown>(): Promise<T | null>
    all<T = unknown>(): Promise<{ results?: T[] }>
    run(): Promise<unknown>
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement
    batch(statements: D1PreparedStatement[]): Promise<unknown>
  }

  type R2HTTPMetadata = {
    contentType?: string
    contentLanguage?: string
    contentDisposition?: string
    contentEncoding?: string
    cacheControl?: string
    cacheExpiry?: Date
  }

  type R2PutOptions = {
    httpMetadata?: R2HTTPMetadata
    customMetadata?: Record<string, string>
  }

  interface R2Bucket {
    put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: R2PutOptions
    ): Promise<void>
    delete(key: string | string[]): Promise<void>
  }
}

export {}
