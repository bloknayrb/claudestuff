import type { Answer, Book, DecideInput, Decision, LabelAnswer } from '../types'

export const EMPTY_BOOK: Book = { decisions: [], nextId: 1 }

export function addDecision(book: Book, input: DecideInput, useId: string, now: number): Book {
  if (book.decisions.some(d => d.useId === useId)) return book
  const decision: Decision = { ...input, id: book.nextId, useId, status: 'pending', createdAt: now }
  return { ...book, decisions: [...book.decisions, decision], nextId: book.nextId + 1 }
}

export function idForUse(book: Book, useId: string): number | undefined {
  return book.decisions.find(d => d.useId === useId)?.id
}

export function pending(book: Book): Decision[] {
  return book.decisions.filter(d => d.status === 'pending')
}

export function markAnswered(book: Book, id: number, answer: Answer, nonce: string): Book {
  return {
    ...book,
    decisions: book.decisions.map(d =>
      d.id === id && d.status === 'pending' ? { ...d, status: 'answered', answer, answerNonce: nonce } : d,
    ),
  }
}

export function isAnsweredBy(book: Book, id: number, nonce: string): boolean {
  return book.decisions.some(d => d.id === id && d.status === 'answered' && d.answerNonce === nonce)
}

export function reopen(book: Book, id: number, nonce: string): Book {
  return {
    ...book,
    decisions: book.decisions.map(d => {
      if (d.id !== id || d.answerNonce !== nonce) return d
      const { answer: _answer, answerNonce: _nonce, ...rest } = d
      return { ...rest, status: 'pending' }
    }),
  }
}

export function recommendedAnswer(decision: Decision): LabelAnswer {
  const option = decision.options[decision.recommend]
  if (option === undefined) throw new Error(`decision #${decision.id} recommends a missing option`)
  return { choice: 'label', label: option.label }
}
