export interface EventHandler {
  (...args: any[]): any
}

const WILDCARD = "*"
const EMPTY = ""
const NONE_INDEX = -1

function normalize(pattern: string) {
  return pattern.replace(/(\*)+/g, WILDCARD)
}

export class HandlerNode {
  private children: HandlerNode[]
  private permanent: Set<EventHandler> | null = null
  private temporary: Set<EventHandler> | null = null
  private wildcard: HandlerNode | null = null

  constructor(
    private pattern: string = EMPTY,
    ...children: HandlerNode[]
  ) {
    this.children = children
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
      current = inserted.wildcard ??= new HandlerNode()
    }

    return current._insert(patterns.at(-1)!, handler, isTemporary)
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

    const stack: [number, HandlerNode][] = []

    const end = patterns.length - 1
    let current: HandlerNode = this as HandlerNode
    for (let i = 0; i < patterns.length; i += 1) {
      let pattern = patterns[i]
      while (pattern !== EMPTY) {
        const [index, child, remain] = current.findChild(pattern)
        if (!child) {
          return
        }

        pattern = remain
        stack.push([index, current])
        current = child
      }

      if (i === end) {
        break
      }

      if (!current.wildcard) {
        return
      }

      stack.push([NONE_INDEX, current])
      current = current.wildcard
    }

    if (!current._remove(handler)) {
      return
    }
    if (current.hasToShrink()) {
      current.shrink()
    }

    while (stack.length > 0) {
      const [index, parent] = stack.pop()!
      if (index === NONE_INDEX) {
        if (parent.wildcard?.isEmpty()) {
          parent.wildcard = null
        }
        continue
      }

      if (parent.children[index].isEmpty()) {
        parent.children.splice(index, 1)
      }

      if (!parent.hasToShrink()) {
        continue
      }
      parent.shrink()
    }
  }

  private shrink() {
    const replace = this.children[0]
    if (!replace) {
      return
    }
    this.pattern += replace.pattern
    this.children = replace.children
    this.wildcard = replace.wildcard
    this.permanent = replace.permanent
    this.temporary = replace.temporary
  }

  private hasToShrink(): boolean {
    return (
      this.children.length < 2 &&
      !this.permanent?.size &&
      !this.temporary?.size &&
      !this.wildcard &&
      this.pattern !== EMPTY
    )
  }

  private findChild(pattern: string): [number, HandlerNode | null, string] {
    const [index, exact] = this.binarySearch(pattern)
    if (exact) {
      return [index, this.children[index], EMPTY]
    }

    const start = Math.max(index - 1, 0)
    const end = Math.min(index, this.children.length - 1)

    for (let i = start; i <= end; i += 1) {
      const child = this.children[i]
      if (pattern.startsWith(child.pattern)) {
        return [i, child, pattern.slice(child.pattern.length)]
      }
    }

    return [index, null, EMPTY]
  }

  private isEmpty() {
    return (
      !this.permanent?.size && !this.temporary?.size && this.children.length === 0 && !this.wildcard
    )
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

        child.pattern = child.pattern.slice(match.length)
        const node = new HandlerNode(match, child)
        current.children[i] = node
        remain = remain.slice(match.length)
        current = node
        continue outer
      }

      const node = new HandlerNode(remain)
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

  private match(pattern: string): string {
    const len = Math.min(this.pattern.length, pattern.length)
    for (let i = 0; i < len; i += 1) {
      if (this.pattern[i] !== pattern[i]) {
        return pattern.slice(0, i)
      }
    }
    return pattern.slice(0, len)
  }

  private binarySearch(pattern: string): [number, boolean] {
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
    const stack: [string, HandlerNode][] = [[EMPTY, this]]

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
    const failure = new Uint32Array(m)
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

    j = 0
    for (let i = 0; i < n; i += 1) {
      while (j > 0 && text[i] !== this.pattern[j]) {
        j = failure[j - 1]
      }
      if (text[i] === this.pattern[j]) {
        j += 1
      }
      if (j !== m) {
        continue
      }

      yield text.slice(i + 1)
      j = failure[j - 1]
    }
  }

  private _call(args: any[]): boolean {
    let called = false
    if (this.permanent) {
      for (const handler of this.permanent.values()) {
        handler(...args)
        called ||= true
      }
    }
    if (!this.temporary) {
      return called
    }

    for (const handler of this.temporary.values()) {
      handler(...args)
      called ||= true
    }
    this.temporary = null
    return called
  }

  call(pattern: string, args: any[]): boolean {
    let called = false

    const queue: [string, HandlerNode][] = [[pattern, this]]
    const stack: HandlerNode[] = []

    while (queue.length > 0) {
      const [pattern, current] = queue.shift()!
      stack.push(current)

      if (current.wildcard?._call(args)) {
        called ||= true
      }

      if (pattern === EMPTY) {
        if (current._call(args)) {
          called ||= true
        }
        continue
      }

      const [, child, remain] = current.findChild(pattern)
      if (child) {
        queue.push([remain, child])
      }

      if (!current.wildcard) {
        continue
      }

      stack.push(current.wildcard)
      for (const child of current.wildcard.children) {
        for (const remain of child.kmp(pattern)) {
          queue.push([remain, child])
        }
      }
    }

    while (stack.length > 0) {
      const current = stack.pop()!
      current.children = current.children.filter((child) => !child.isEmpty())
      if (current.wildcard?.isEmpty()) {
        current.wildcard = null
      }

      if (!current.hasToShrink()) {
        continue
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
        const [, child, remain] = current.findChild(pattern)
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
