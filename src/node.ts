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
  private permanent: Set<EventHandler> = new Set()
  private temporary: Set<EventHandler> = new Set()
  private wildcard: HandlerNode | null = null

  constructor(
    private pattern: string = EMPTY,
    ...children: HandlerNode[]
  ) {
    this.children = children
  }

  clear() {
    this.permanent.clear()
    this.temporary.clear()
    this.wildcard = null
    this.children.length = 0
  }

  insert(pattern: string, handler: EventHandler, isTemporary: boolean = false) {
    let current = this as HandlerNode
    const patterns = normalize(pattern).split(WILDCARD)
    for (const part of patterns.slice(0, -1)) {
      const inserted = current._insert(part)
      current = inserted.wildcard ??= new HandlerNode()
    }

    return current._insert(patterns.at(-1)!, handler, isTemporary)
  }

  remove(pattern: string, handler?: EventHandler) {
    const patterns = normalize(pattern).split(WILDCARD)

    const stack: [number, HandlerNode][] = []

    const end = patterns.length - 1
    let current: HandlerNode = this as HandlerNode
    for (let i = 0; i < patterns.length; i += 1) {
      let pattern = patterns[i]
      while (pattern !== EMPTY) {
        const [index, child, exact] = current.exact(pattern)
        if (!child) {
          return
        }

        pattern = exact ? EMPTY : pattern.slice(child.pattern.length)
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

    if (!handler) {
      current.permanent.clear()
      current.temporary.clear()
    } else if (!current.permanent.delete(handler) || !current.temporary.delete(handler)) {
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
      this.permanent.size === 0 &&
      this.temporary.size === 0 &&
      !this.wildcard &&
      this.pattern !== EMPTY
    )
  }

  private exact(pattern: string): [number, HandlerNode | null, boolean] {
    const [index, exact] = this.binarySearch(pattern)
    if (exact) {
      return [index, this.children[index], true]
    }

    const start = Math.max(index - 1, 0)
    const end = Math.min(index, this.children.length - 1)

    for (let i = start; i <= end; i += 1) {
      const child = this.children[i]
      if (pattern.startsWith(child.pattern)) {
        return [i, child, false]
      }
    }

    return [index, null, false]
  }

  private isEmpty() {
    return (
      this.permanent.size === 0 &&
      this.temporary.size === 0 &&
      this.children.length === 0 &&
      !this.wildcard
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
    if (isTemporary) {
      current.temporary.add(handler)
    } else {
      current.permanent.add(handler)
    }
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

      if (current.temporary.size > 0 || current.permanent.size > 0) {
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

  private *pMatch(text: string): Generator<string> {
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
    for (const handler of this.permanent.values()) {
      handler(...args)
      called ||= true
    }

    for (const handler of this.temporary.values()) {
      handler(...args)
      called ||= true
    }

    this.temporary.clear()
    return called
  }

  call(pattern: string, args: any[]): boolean {
    let called = false
    const queue: [string[], HandlerNode][] = [[[pattern], this]]
    const stack: [number[], HandlerNode][] = []

    outer: while (queue.length > 0) {
      const [patterns, current] = queue.shift()!
      const indexes: number[] = []

      if (current.wildcard?._call(args)) {
        called ||= true
        indexes.push(NONE_INDEX)
      }

      inner: for (const pattern of patterns) {
        if (pattern === EMPTY) {
          if (current._call(args)) {
            called ||= true
            stack.push([[], current])
          }
          continue inner
        }

        const [index, child, exact] = current.exact(pattern)
        if (!child) {
          continue inner
        }

        indexes.push(index)
        const next = exact ? EMPTY : pattern.slice(child.pattern.length)
        queue.push([[next], child])
      }

      if (indexes.length > 0) {
        stack.push([indexes, current])
      }

      if (!current.wildcard) {
        continue outer
      }

      const wcIndexes: number[] = []
      inner: for (let i = 0; i < current.wildcard.children.length; i += 1) {
        const child = current.wildcard.children[i]
        const next = patterns.flatMap((pattern) => Array.from(child.pMatch(pattern)))
        if (next.length === 0) {
          continue inner
        }
        queue.push([next, child])
        wcIndexes.push(i)
      }

      if (wcIndexes.length === 0) {
        continue
      }

      stack.push([wcIndexes, current.wildcard])
    }

    outer: while (stack.length > 0) {
      const [indexes, parent] = stack.pop()!
      const toBeDelete = new Set<number>()

      inner: for (const index of indexes) {
        const child = index === NONE_INDEX ? parent.wildcard! : parent.children[index]
        if (!child.isEmpty()) {
          continue inner
        }
        toBeDelete.add(index)
      }

      parent.children = parent.children.filter((_, index) => !toBeDelete.has(index))
      if (toBeDelete.has(NONE_INDEX)) {
        parent.wildcard = null
      }

      if (!parent.hasToShrink()) {
        continue outer
      }
      parent.shrink()
    }

    return called
  }

  find(pattern: string): EventHandler[] {
    const patterns = normalize(pattern).split(WILDCARD)

    const end = patterns.length - 1
    let current: HandlerNode = this as HandlerNode
    for (let i = 0; i < patterns.length; i += 1) {
      let pattern = patterns[i]
      while (pattern !== EMPTY) {
        const [, child, exact] = current.exact(pattern)
        if (!child) {
          return []
        }

        pattern = exact ? EMPTY : pattern.slice(child.pattern.length)
        current = child
      }

      if (i === end) {
        break
      }

      if (!current.wildcard) {
        return []
      }

      current = current.wildcard
    }

    return [...current.permanent.values(), ...current.temporary.values()]
  }
}
