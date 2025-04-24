import { SerializedLexicalNode } from 'lexical'

export const COMMAND_SCHEMA_VERSION = 1

export type Command = {
  id: string
  name: string
  content: { nodes: SerializedLexicalNode[] }
  createdAt: number
  updatedAt: number
  schemaVersion: number
}

export type CommandMetadata = {
  id: string
  name: string
  schemaVersion: number
}
