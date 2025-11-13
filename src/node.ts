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
  private persists: Set<EventHandler> = new Set()
  private temporaries: Set<EventHandler> = new Set()
  private wildcard: HandlerNode | null = null

  constructor(
    private pattern: string = EMPTY,
    ...children: HandlerNode[]
  ) {
    this.children = children
  }

  clear() {
    this.persists.clear()
    this.temporaries.clear()
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

    const length = patterns.length
    const stack: [number, HandlerNode][] = []

    let current: HandlerNode | null = this as HandlerNode
    outer: for (let pattern of patterns) {
      while (pattern !== EMPTY) {
        const [index, child, exact] = current.exact(pattern)
        if (!child) {
          break outer
        }

        pattern = exact ? EMPTY : pattern.slice(child.pattern.length)
        stack.push([index, current])
        current = child
      }

      if (!current.wildcard) {
        break outer
      }

      stack.push([NONE_INDEX, current])
      current = current.wildcard
    }

    if (stack.length !== length) {
      return
    }

    if (!handler) {
      current.persists.clear()
      current.temporaries.clear()
    } else if (!current.persists.delete(handler) || !current.temporaries.delete(handler)) {
      return
    }
    if (current.isEmpty()) {
      current = null
    }

    while (stack.length > 0) {
      const [index, node] = stack.pop()!
      if (index === NONE_INDEX) {
        if (!current) {
          node.wildcard = null
        }
        if (!node.hasToShrink()) {
          break
        }
        if (node.children.length === 0) {
          current = null
          continue
        }

        current = node.replace()
        continue
      }

      const child = node.children[index]
      if (!current) {
        node.children.splice(index, 1)
      } else if (child !== current) {
        node.children[index] = current
      }
      if (!node.hasToShrink()) {
        break
      }
      if (node.children.length === 0) {
        current = null
        continue
      }

      current = node.replace()
    }
  }

  private replace() {
    const replace = this.children[0]
    replace.pattern = this.pattern.concat(replace.pattern)
    return replace
  }

  private hasToShrink(): boolean {
    return (
      this.children.length < 2 &&
      this.persists.size === 0 &&
      this.temporaries.size === 0 &&
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
      this.persists.size === 0 &&
      this.temporaries.size === 0 &&
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
      current.temporaries.add(handler)
    } else {
      current.persists.add(handler)
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

      if (current.temporaries.size > 0 || current.persists.size > 0) {
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
    for (const handler of this.persists.values()) {
      handler(...args)
    }

    let called = false
    for (const handler of this.temporaries.values()) {
      handler(...args)
      called ||= true
    }
    this.temporaries.clear()
    return called
  }

  call(pattern: string, args: any[]) {
    // TODO 이거 다 완전히 정리가 안되는데 정리되도록 수정 필요
    const findQueue: [string, HandlerNode, number][] = []
    const callStack: [number, HandlerNode][] = []

    if (this.wildcard) {
      callStack.push([NONE_INDEX, this])
      for (let i = 0; i < this.wildcard.children.length; i += 1) {
        for (const remain of this.wildcard.children[i].pMatch(pattern)) {
          findQueue.push([remain, this.wildcard, i])
        }
      }
    }

    const [index, child] = this.exact(pattern)
    if (child) {
      findQueue.push([pattern.slice(child.pattern.length), this, index])
    }

    while (findQueue.length > 0) {
      const [pattern, parent, index] = findQueue.shift()!
      const current = parent.children[index]

      if (pattern === EMPTY) {
        callStack.push([index, parent])
        if (!current.wildcard) {
          continue
        }
        callStack.push([NONE_INDEX, current])
        continue
      }

      const [i, child] = current.exact(pattern)
      if (child) {
        findQueue.push([pattern.slice(child.pattern.length), current, i])
      }
      if (!current.wildcard) {
        continue
      }

      callStack.push([NONE_INDEX, current])
      for (let i = 0; i < current.wildcard.children.length; i += 1) {
        for (const remain of current.wildcard.children[i].pMatch(pattern)) {
          findQueue.push([remain, current.wildcard, i])
        }
      }
    }

    while (callStack.length > 0) {
      const [index, parent] = callStack.pop()!
      if (index === NONE_INDEX) {
        const current = parent.wildcard!
        if (current._call(args) && current.isEmpty()) {
          parent.wildcard = null
        }
        if (!parent.hasToShrink()) {
          continue
        }
        parent.merge()
        continue
      }

      const current = parent.children[index]
      if (!current._call(args)) {
        continue
      }
      if (current.isEmpty()) {
        parent.children.splice(index, 1)
      }
      if (!parent.hasToShrink()) {
        continue
      }
      parent.merge()
    }
  }

  private merge() {
    const replace = this.children[0]
    this.pattern = this.pattern.concat(replace.pattern)
    this.children = replace.children
    this.wildcard = replace.wildcard
    this.persists = replace.persists
    this.temporaries = replace.temporaries
  }
}
