import { Queue } from "./queue"
import { Nullable, Tuple } from "./type"

export interface EventHandler {
  (...args: any[]): any
}

const WILDCARD = "*"
const EMPTY = ""

function normalize(pattern: string) {
  return pattern.replace(/(\*)+/g, WILDCARD)
}

export class HandlerNode {
  private children: Map<string, HandlerNode>
  private permanent: Nullable<Set<EventHandler>> = null
  private temporary: Nullable<Set<EventHandler>> = null
  private wildcard: Nullable<HandlerNode> = null
  private failure: Nullable<Uint8Array> = null

  constructor(
    private pattern: string = EMPTY,
    ...children: HandlerNode[]
  ) {
    this.children = new Map(children.map((child) => [child.pattern[0], child]))
  }

  clear() {
    this.permanent = null
    this.temporary = null
    this.wildcard = null
    this.children.clear()
  }

  insert(pattern: string, handler: EventHandler, isTemporary: boolean = false) {
    let current = this as HandlerNode
    const patterns = normalize(pattern).split(WILDCARD)
    for (let i = 0; i < patterns.length - 1; i += 1) {
      const part = patterns[i]
      const inserted = current._insert(part)
      current = inserted.wildcard ??= new HandlerNode(WILDCARD)
    }

    current._insert(patterns.at(-1)!, handler, isTemporary)
  }

  private match(pattern: string): string {
    const len = Math.min(this.pattern.length, pattern.length)
    for (let i = 0; i < len; i += 1) {
      if (this.pattern[i] !== pattern[i]) {
        return pattern.slice(0, i)
      }
    }
    return pattern.slice(0, len)
  }

  private _insert(
    pattern: string,
    handler?: EventHandler,
    isTemporary: boolean = false
  ): HandlerNode {
    let current = this as HandlerNode
    let remain = pattern

    while (remain !== EMPTY) {
      const prefix = remain[0]
      const child = current.children.get(prefix)
      if (!child) {
        current.children.set(prefix, (current = new HandlerNode(remain)))
        break
      }

      const match = child.match(remain)
      if (match === child.pattern) {
        current = child
        remain = remain.slice(match.length)
        continue
      }

      remain = remain.slice(match.length)
      current.children.set(prefix, (current = child.split(match)))
    }

    if (!handler) {
      return current
    }

    const handlers = isTemporary
      ? (current.temporary ??= new Set())
      : (current.permanent ??= new Set())
    handlers.add(handler)
    return current
  }

  private split(match: string) {
    this.pattern = this.pattern.slice(match.length)
    this.failure &&= null
    return new HandlerNode(match, this)
  }

  private _remove(handler?: EventHandler): boolean {
    if (!handler) {
      if (!this.permanent && !this.temporary) {
        return false
      }

      this.permanent = null
      this.temporary = null
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

  remove(pattern: string, handler?: EventHandler) {
    const patterns = normalize(pattern).split(WILDCARD)
    const end = patterns.length - 1
    let current = this as HandlerNode
    const stack: Tuple<string, HandlerNode>[] = []

    for (let i = 0; i < patterns.length; i += 1) {
      let pattern = patterns[i]
      while (pattern !== EMPTY) {
        const prefix = pattern[0]
        const child = current.children.get(prefix)
        if (!child || !pattern.startsWith(child.pattern)) {
          return
        }
        stack.push([pattern, current])
        pattern = pattern.slice(child.pattern.length)
        current = child
      }

      if (i === end) {
        break
      }

      if (!current.wildcard) {
        return
      }
      stack.push([EMPTY, current])
      current = current.wildcard
    }

    if (!current._remove(handler)) {
      return
    }
    if (!current.shrink()) {
      return
    }

    while (stack.length > 0) {
      const [pattern, current] = stack.pop()!
      if (pattern !== EMPTY && current.children.get(pattern[0])?.isEmpty()) {
        current.children.delete(pattern[0])
      }
      if (current.shrink()) {
        continue
      }
      return
    }
  }

  private shrink() {
    if (this.wildcard?.isEmpty()) {
      this.wildcard = null
    }
    if (this.children.size > 1) {
      return false
    }
    if (this.permanent?.size) {
      return false
    }
    if (this.temporary?.size) {
      return false
    }
    if (this.wildcard) {
      return false
    }
    if (this.pattern === EMPTY) {
      return false
    }
    if (this.pattern === WILDCARD) {
      return true
    }

    const replace = this.children.values().next().value
    if (!replace) {
      return true
    }

    this.pattern += replace.pattern
    this.children = replace.children
    this.wildcard = replace.wildcard
    this.permanent = replace.permanent
    this.temporary = replace.temporary
    this.failure &&= null
    return true
  }

  private isEmpty() {
    return (
      !this.permanent?.size && !this.temporary?.size && this.children.size === 0 && !this.wildcard
    )
  }

  *patterns(): Generator<string> {
    const stack: Tuple<string, HandlerNode>[] = [[EMPTY, this]]

    while (stack.length > 0) {
      const [prefix, current] = stack.pop()!
      const pattern = prefix.concat(current.pattern)

      if (!!current.temporary?.size || !!current.permanent?.size) {
        yield pattern
      }

      if (current.wildcard) {
        stack.push([pattern, current.wildcard])
      }

      for (const child of current.children.values()) {
        stack.push([pattern, child])
      }
    }
  }

  private *kmp(text: string): Generator<string> {
    const n = text.length
    const m = this.pattern.length
    if (!this.failure) {
      const failure = new Uint8Array(m)
      let j = 0

      for (let i = 1; i < m; i += 1) {
        while (j > 0 && this.pattern[i] !== this.pattern[j]) {
          j = failure[j - 1]
        }
        if (this.pattern[i] === this.pattern[j]) {
          j += 1
        }
        failure[i] = j
      }

      this.failure = failure
    }

    let j = 0
    for (let i = 0; i < n; i += 1) {
      while (j > 0 && text[i] !== this.pattern[j]) {
        j = this.failure[j - 1]
      }
      if (text[i] === this.pattern[j]) {
        j += 1
      }
      if (j !== m) {
        continue
      }

      yield text.slice(i + 1)
      j = this.failure[j - 1]
    }
  }

  call(pattern: string, args: any[]): boolean {
    const queue = Queue.from<Tuple<string, HandlerNode>>([pattern, this])
    const stack: Tuple<string, HandlerNode>[] = []

    while (queue.length > 0) {
      const [pattern, current] = queue.shift()!
      stack.push([pattern, current])

      if (pattern === EMPTY) {
        if (current.wildcard) {
          stack.push([EMPTY, current.wildcard])
        }
        continue
      }

      if (current.pattern !== WILDCARD) {
        const child = current.children.get(pattern[0])
        if (child && pattern.startsWith(child.pattern)) {
          queue.push([pattern.slice(child.pattern.length), child])
        }
        if (current.wildcard) {
          queue.push([pattern, current.wildcard])
        }
        continue
      }

      stack.push([EMPTY, current])
      for (const child of current.children.values()) {
        let found = false
        for (const remain of child.kmp(pattern)) {
          found ||= true
          queue.push([remain, child])
        }
        if (!found) {
          continue
        }
        stack.push([child.pattern, current])
      }
    }

    let called = false
    while (stack.length > 0) {
      const [pattern, current] = stack.pop()!
      if (pattern === EMPTY) {
        current.permanent?.forEach((handler) => (handler(...args), (called ||= true)))
        current.temporary?.forEach((handler) => (handler(...args), (called ||= true)))
        current.temporary = null
      } else if (current.children.get(pattern[0])?.isEmpty()) {
        current.children.delete(pattern[0])
      }

      current.shrink()
    }
    return called
  }

  *find(pattern: string): Generator<EventHandler> {
    const patterns = normalize(pattern).split(WILDCARD)

    const end = patterns.length - 1
    let current: HandlerNode = this as HandlerNode
    for (let i = 0; i < patterns.length; i += 1) {
      let pattern = patterns[i]
      while (pattern !== EMPTY) {
        const prefix = pattern[0]
        const child = current.children.get(prefix)
        if (!child || !pattern.startsWith(child.pattern)) {
          return
        }

        pattern = pattern.slice(child.pattern.length)
        current = child
      }

      if (i === end) {
        break
      }

      if (!current.wildcard) {
        return
      }

      current = current.wildcard
    }
    if (current.permanent) {
      yield* current.permanent.values()
    }
    if (current.temporary) {
      yield* current.temporary.values()
    }
  }

  count(pattern: string) {
    const patterns = normalize(pattern).split(WILDCARD)

    const end = patterns.length - 1
    let current: HandlerNode = this as HandlerNode
    for (let i = 0; i < patterns.length; i += 1) {
      let pattern = patterns[i]
      while (pattern !== EMPTY) {
        const prefix = pattern[0]
        const child = current.children.get(prefix)
        if (!child || !pattern.startsWith(child.pattern)) {
          return
        }

        pattern = pattern.slice(child.pattern.length)
        current = child
      }

      if (i === end) {
        break
      }

      if (!current.wildcard) {
        return
      }

      current = current.wildcard
    }
    return (current.permanent?.size ?? 0) + (current.temporary?.size ?? 0)
  }
}
