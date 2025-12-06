import { EMPTY } from "./constants"
import { Nullable } from "./type"

export interface EventHandler<T extends any[] = any[], R = any> {
  (...args: T): R
}

export class HandlerNode {
  children: Nullable<Map<string, HandlerNode>> = null
  permanent: Nullable<Set<EventHandler>> = null
  temporary: Nullable<Set<EventHandler>> = null
  wildcard: Nullable<HandlerNode> = null
  failure: Nullable<Uint8Array> = null

  constructor(public pattern: string = EMPTY) {}

  match(pattern: string, cursor: number): string {
    const current = this.pattern
    const len = Math.min(current.length, pattern.length - cursor)
    for (let i = 0, j = cursor; i < len; i += 1, j += 1) {
      if (current[i] !== pattern[j]) {
        return pattern.slice(cursor, j)
      }
    }
    return pattern.slice(cursor, len + cursor)
  }

  split(match: string) {
    this.pattern = this.pattern.slice(match.length)
    this.failure &&= null
    const node = new HandlerNode(match)
    ;(node.children = new Map()).set(this.pattern[0], this)
    return node
  }

  remove(handler?: EventHandler): boolean {
    if (!handler) {
      if (!this.permanent && !this.temporary) {
        return false
      }

      this.permanent &&= null
      this.temporary &&= null
      return true
    }

    if (this.permanent?.delete(handler)) {
      if (this.permanent.size === 0) {
        this.permanent = null
      }
      return true
    }

    if (!this.temporary?.delete(handler)) {
      return false
    }

    if (this.temporary.size > 0) {
      return true
    }
    this.temporary = null
    return true
  }

  shrink() {
    if (this.permanent?.size) {
      return false
    }
    if (this.temporary?.size) {
      return false
    }
    if (this.wildcard) {
      return false
    }
    if (!this.children) {
      return true
    }
    if (this.children.size > 1) {
      return false
    }
    if (this.pattern === EMPTY) {
      return true
    }

    const replace = this.children.values().next().value!
    this.pattern += replace.pattern
    this.children = replace.children
    this.wildcard = replace.wildcard
    this.permanent = replace.permanent
    this.temporary = replace.temporary
    this.failure &&= null
    return true
  }

  isEmpty() {
    return !this.permanent && !this.temporary && !this.children && !this.wildcard
  }

  getFailure(): Uint8Array {
    if (this.failure !== null) {
      return this.failure
    }

    const pattern = this.pattern
    const m = pattern.length
    const failure = new Uint8Array(m)

    let j = 0
    for (let i = 1; i < m; i += 1) {
      while (j > 0 && pattern[i] !== pattern[j]) {
        j = failure[j - 1]
      }
      if (pattern[i] === pattern[j]) {
        j += 1
      }
      failure[i] = j
    }

    return (this.failure = failure)
  }
}
