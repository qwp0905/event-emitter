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
  private children: HandlerNode[]
  private permanent: Nullable<Set<EventHandler>> = null
  private temporary: Nullable<Set<EventHandler>> = null
  private wildcard: Nullable<HandlerNode> = null
  private parent: Nullable<WeakRef<HandlerNode>> = null
  private failure: Nullable<Uint8Array> = null

  constructor(
    private pattern: string = EMPTY,
    ...children: HandlerNode[]
  ) {
    this.children = children
  }

  private create(pattern?: string, ...children: HandlerNode[]) {
    const node = new HandlerNode(pattern, ...children)
    node.parent = new WeakRef(this)
    return node
  }

  clear() {
    this.permanent = null
    this.temporary = null
    this.wildcard = null
    this.children.length = 0
  }

  insert(pattern: string, handler: EventHandler, isTemporary: boolean = false) {
    let current = this as HandlerNode
    const patterns = normalize(pattern).split(WILDCARD)
    for (let i = 0; i < patterns.length - 1; i += 1) {
      const part = patterns[i]
      const inserted = current._insert(part)
      current = inserted.wildcard ??= inserted.create()
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

    outer: while (remain !== EMPTY) {
      const [index, exact] = current.binarySearch(remain)
      if (exact) {
        remain = EMPTY
        current = current.children[index]
        continue outer
      }

      const start = Math.max(index - 1, 0)
      const end = Math.min(index, current.children.length - 1)
      inner: for (let i = start; i <= end; i += 1) {
        const child = current.children[i]
        const match = child.match(remain)
        if (match === EMPTY) {
          continue inner
        }

        if (match === child.pattern) {
          remain = remain.slice(match.length)
          current = child
          continue outer
        }

        remain = remain.slice(match.length)
        current.children[i] = current = child.split(match)
        continue outer
      }

      const node = current.create(remain)
      current.children.splice(index, 0, node)
      remain = EMPTY
      current = node
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
    const node = new HandlerNode(match, this)
    node.parent = this.parent
    this.parent = new WeakRef(node)
    this.pattern = this.pattern.slice(match.length)
    return node
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
    for (let i = 0; i < patterns.length; i += 1) {
      let pattern = patterns[i]
      while (pattern !== EMPTY) {
        const [child, remain] = current.findChild(pattern)
        if (!child) {
          return
        }

        pattern = remain
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

    if (!current._remove(handler)) {
      return
    }
    if (!current.shrink()) {
      return
    }

    while (!!current.parent) {
      const parent = current.parent.deref()!
      if (!parent.shrink()) {
        break
      }
      current = parent
    }
  }

  private shrink() {
    if (this.wildcard?.isEmpty()) {
      this.wildcard = null
    }
    this.children = this.children.filter((child) => !child.isEmpty())
    if (this.children.length > 1) {
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

    const replace = this.children[0]
    if (!replace) {
      return true
    }

    this.pattern += replace.pattern
    this.children = replace.children
    this.wildcard = replace.wildcard
    this.permanent = replace.permanent
    this.temporary = replace.temporary
  }

  private findChild(pattern: string): Tuple<Nullable<HandlerNode>, string> {
    const [index, exact] = this.binarySearch(pattern)
    if (exact) {
      return [this.children[index], EMPTY]
    }

    const start = Math.max(index - 1, 0)
    const end = Math.min(index, this.children.length - 1)

    for (let i = start; i <= end; i += 1) {
      const child = this.children[i]
      if (pattern.startsWith(child.pattern)) {
        return [child, pattern.slice(child.pattern.length)]
      }
    }

    return [null, EMPTY]
  }

  private isEmpty() {
    return (
      !this.permanent?.size && !this.temporary?.size && this.children.length === 0 && !this.wildcard
    )
  }

  private binarySearch(pattern: string): Tuple<number, boolean> {
    let low = 0
    let high = this.children.length
    while (low < high) {
      const mid = low + ((high - low) >>> 1)
      const cmp = this.children[mid].pattern.localeCompare(pattern)
      if (cmp < 0) {
        high = mid
      } else if (cmp > 0) {
        low = mid + 1
      } else {
        return [mid, true]
      }
    }

    return [low, false]
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
        stack.push([pattern.concat(WILDCARD), current.wildcard])
      }

      for (const child of current.children) {
        stack.push([pattern, child])
      }
    }
  }

  private *kmp(text: string): Generator<string> {
    const n = text.length
    const m = this.pattern.length
    if (this.failure?.length !== m) {
      this.failure = new Uint8Array(m)
      let j = 0

      for (let i = 1; i < m; i += 1) {
        while (j > 0 && this.pattern[i] !== this.pattern[j]) {
          j = this.failure[j - 1]
        }
        if (this.pattern[i] === this.pattern[j]) {
          j += 1
        }
        this.failure[i] = j
      }
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
    const queue: Queue<Tuple<string, HandlerNode>> = Queue.from([pattern, this])
    const callStack: HandlerNode[] = []

    while (queue.length > 0) {
      const [pattern, current] = queue.shift()!
      if (pattern === EMPTY) {
        callStack.push(current)
        if (current.wildcard) {
          callStack.push(current.wildcard)
        }
        continue
      }

      const [child, remain] = current.findChild(pattern)
      if (child) {
        queue.push([remain, child])
      }

      if (!current.wildcard) {
        continue
      }

      callStack.push(current.wildcard)
      for (const child of current.wildcard.children) {
        for (const remain of child.kmp(pattern)) {
          queue.push([remain, child])
        }
      }
    }

    let called = false
    outer: while (callStack.length > 0) {
      let current = callStack.pop()!

      if (current.permanent) {
        called ||= true
        current.permanent.forEach((handler) => handler(...args))
      }

      if (!current.temporary) {
        continue outer
      }

      called ||= true
      current.temporary.forEach((handler) => handler(...args))
      current.temporary = null

      inner: while (!!current.parent) {
        const parent = current.parent.deref()!
        if (!parent.shrink()) {
          break inner
        }
        current = parent
      }
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
        const [child, remain] = current.findChild(pattern)
        if (!child) {
          return
        }

        pattern = remain
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
}
