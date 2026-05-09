import type { Signal } from "../types/signal.js"
import { extractQueryIntent } from "./query-intent.js"

export interface LexicalBoostOptions {
  nameWeight: number
  textWeight: number
  fileWeight: number
  tagWeight: number
  minOverlap: number
}

export const DEFAULT_LEXICAL_BOOST_OPTIONS: LexicalBoostOptions = {
  nameWeight: 3.0,
  textWeight: 1.0,
  fileWeight: 2.0,
  tagWeight: 1.5,
  minOverlap: 1,
}

function fuzzyMatch(term: string, target: string): boolean {
  if (target.includes(term)) return true

  const termLower = term.toLowerCase()
  const targetLower = target.toLowerCase()

  if (targetLower.includes(termLower)) return true

  const stemmed = stemWord(termLower)
  if (stemmed !== termLower && targetLower.includes(stemmed)) return true

  if (stemWord(targetLower).includes(stemmed)) return true

  if (termLower.length > 4 && targetLower.includes(termLower.slice(0, -1))) return true
  if (targetLower.length > 4 && termLower.includes(targetLower.slice(0, -1))) return true

  return false
}

function stemWord(word: string): string {
  if (word.length < 4) return word
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1)
  if (word.endsWith("es")) return word.slice(0, -2)
  if (word.endsWith("ing")) return word.slice(0, -3)
  if (word.endsWith("ed") && !word.endsWith("eed")) return word.slice(0, -2)
  return word
}

export function computeLexicalBoost(
  query: string,
  signal: Signal,
  options: Partial<LexicalBoostOptions> = {}
): number {
  const opts = { ...DEFAULT_LEXICAL_BOOST_OPTIONS, ...options }
  const intent = extractQueryIntent(query)

  const nameLower = (signal.name || "").toLowerCase()
  const textLower = (signal.text || "").toLowerCase()
  const fileLower = (signal.file || "").toLowerCase()
  const tagsLower = (signal.tags || []).map(t => t.toLowerCase())

  let nameScore = 0
  let textScore = 0
  let fileScore = 0
  let tagScore = 0

  const allTerms = [...intent.expandedTerms]

  for (const term of allTerms) {
    if (fuzzyMatch(term, nameLower)) {
      nameScore += 1
      if (nameLower.startsWith(term) || nameLower.includes(`_${term}`) || nameLower.includes(`${term}_`)) {
        nameScore += 0.5
      }
    }

    const textTokens = textLower.split(/\s+/)
    if (textTokens.some(t => fuzzyMatch(term, t))) {
      textScore += 1
    }

    if (fuzzyMatch(term, fileLower)) {
      fileScore += 1
      const fileParts = fileLower.split(/[\\/._-]/)
      if (fileParts.some(p => fuzzyMatch(term, p))) {
        fileScore += 0.5
      }
    }

    for (const tag of tagsLower) {
      if (fuzzyMatch(term, tag)) {
        tagScore += 1
      }
    }
  }

  const totalScore = (
    nameScore * opts.nameWeight +
    textScore * opts.textWeight +
    fileScore * opts.fileWeight +
    tagScore * opts.tagWeight
  )

  return totalScore
}

export function computeLexicalBoostFromTerms(
  terms: string[],
  signal: Signal,
  options: Partial<LexicalBoostOptions> = {}
): number {
  const opts = { ...DEFAULT_LEXICAL_BOOST_OPTIONS, ...options }

  const nameLower = (signal.name || "").toLowerCase()
  const textLower = (signal.text || "").toLowerCase()
  const fileLower = (signal.file || "").toLowerCase()
  const tagsLower = (signal.tags || []).map(t => t.toLowerCase())

  let nameScore = 0
  let textScore = 0
  let fileScore = 0
  let tagScore = 0

  for (const term of terms) {
    if (fuzzyMatch(term, nameLower)) {
      nameScore += 1
      if (nameLower.startsWith(term) || nameLower.includes(`_${term}`) || nameLower.includes(`${term}_`)) {
        nameScore += 0.5
      }
    }

    const textTokens = textLower.split(/\s+/)
    if (textTokens.some(t => fuzzyMatch(term, t))) {
      textScore += 1
    }

    if (fuzzyMatch(term, fileLower)) {
      fileScore += 1
      const fileParts = fileLower.split(/[\\/._-]/)
      if (fileParts.some(p => fuzzyMatch(term, p))) {
        fileScore += 0.5
      }
    }

    for (const tag of tagsLower) {
      if (fuzzyMatch(term, tag)) {
        tagScore += 1
      }
    }
  }

  const totalScore = (
    nameScore * opts.nameWeight +
    textScore * opts.textWeight +
    fileScore * opts.fileWeight +
    tagScore * opts.tagWeight
  )

  return totalScore
}