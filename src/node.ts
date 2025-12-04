import { Nullable, Triple, Tuple } from "./type"

export interface EventHandler {
  (...args: any[]): any
}

const WILDCARD = "*"
const EMPTY = ""

function normalize(pattern: string) {
  return pattern.replace(/(\*)+/g, WILDCARD)
}

class HandlerNode {
  children: Nullable<Map<string, HandlerNode>> = null
  permanent: Nullable<Set<EventHandler>> = null
  temporary: Nullable<Set<EventHandler>> = null
  wildcard: Nullable<HandlerNode> = null
  failure: Nullable<Uint8Array> = null

  constructor(public pattern: string = EMPTY) {}

  match(pattern: string, cursor: number): string {
    const len = Math.min(this.pattern.length, pattern.length - cursor)
    for (let i = 0, j = cursor; i < len; i += 1, j += 1) {
      if (this.pattern[i] !== pattern[j]) {
        return pattern.slice(cursor, j)
      }
    }
    return pattern.slice(cursor, len + cursor)
  }

  split(match: string) {
    this.pattern = this.pattern.slice(match.length)
    this.failure &&= null
    const node = new HandlerNode(match)
    node.children = new Map([[this.pattern[0], this]])
    return node
  }

  remove(handler?: EventHandler): boolean {
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
    return !this.permanent?.size && !this.temporary?.size && !this.children && !this.wildcard
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

export class PatternMatcher {
  private readonly root: HandlerNode = new HandlerNode()

  clear() {
    this.root.permanent = null
    this.root.temporary = null
    this.root.wildcard = null
    this.root.children = null
  }

  insert(pattern: string, handler: EventHandler, isTemporary: boolean) {
    const patterns = normalize(pattern).split(WILDCARD)
    let current = this.root as HandlerNode
    const end = patterns.length - 1
    for (let i = 0, remain = patterns[0]; i < patterns.length; remain = patterns[++i]) {
      let cursor = 0
      inner: while (cursor < remain.length) {
        const prefix = remain[cursor]
        const child = current.children?.get(prefix)
        if (!child) {
          current.children ??= new Map()
          current.children.set(prefix, (current = new HandlerNode(remain.slice(cursor))))
          break inner
        }

        const match = child.match(remain, cursor)
        cursor += match.length
        if (match === child.pattern) {
          current = child
          continue inner
        }

        current.children ??= new Map()
        current.children.set(prefix, (current = child.split(match)))
      }

      if (i === end) {
        break
      }
      current = current.wildcard ??= new HandlerNode()
    }

    const handlers = isTemporary
      ? (current.temporary ??= new Set())
      : (current.permanent ??= new Set())
    handlers.add(handler)
  }

  remove(pattern: string, handler?: EventHandler) {
    const patterns = normalize(pattern).split(WILDCARD)
    const end = patterns.length - 1
    let current = this.root as HandlerNode
    const stack: Tuple<string, HandlerNode>[] = []

    for (let i = 0, pattern = patterns[0]; i < patterns.length; pattern = patterns[++i]) {
      let cursor = 0
      while (cursor < pattern.length) {
        const prefix = pattern[cursor]
        const child = current.children?.get(prefix)
        if (!child || !pattern.startsWith(child.pattern, cursor)) {
          return
        }

        stack.push([prefix, current])
        cursor += child.pattern.length
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

    if (!current.remove(handler)) {
      return
    }
    if (!current.shrink()) {
      return
    }

    while (stack.length > 0) {
      const [prefix, current] = stack.pop()!
      if (prefix === EMPTY) {
        if (current.wildcard?.isEmpty()) {
          current.wildcard = null
        }
      } else if (current.children?.get(prefix)?.isEmpty()) {
        if (current.children.delete(prefix) && current.children.size === 0) {
          current.children = null
        }
      }
      if (!current.shrink()) {
        break
      }
    }
  }

  *patterns(): Generator<string> {
    const stack: Tuple<string, HandlerNode>[] = [[EMPTY, this.root]]

    while (stack.length > 0) {
      const [prefix, current] = stack.pop()!
      const pattern = prefix.concat(current.pattern)

      if (!!current.temporary?.size || !!current.permanent?.size) {
        yield pattern
      }

      if (current.wildcard) {
        stack.push([pattern.concat(WILDCARD), current.wildcard])
      }
      if (!current.children) {
        continue
      }

      for (const child of current.children.values()) {
        stack.push([pattern, child])
      }
    }
  }

  call(pattern: string, args: any[]): boolean {
    const search: Triple<number, HandlerNode, Tuple<string, HandlerNode>[]>[] = []
    search.push([0, this.root, []])
    const branches: Tuple<string, HandlerNode>[][] = []
    const len = pattern.length

    while (search.length > 0) {
      const [cursor, current, stack] = search.pop()!
      if (cursor === len) {
        stack.push([EMPTY, current])
        branches.push(stack)
        continue
      }

      const prefix = pattern[cursor]
      const child = current.children?.get(prefix)

      const hasChild = child && pattern.startsWith(child.pattern, cursor)
      if (!current.wildcard) {
        if (!hasChild) {
          continue
        }

        stack.push([prefix, current])
        search.push([cursor + child.pattern.length, child, stack])
        continue
      }

      stack.push([prefix, current])
      branches.push(stack)
      if (hasChild) {
        search.push([cursor + child.pattern.length, child, []])
      }
      if (!current.wildcard.children) {
        continue
      }

      for (const child of current.wildcard.children.values()) {
        const childPattern = child.pattern
        let wildcard: Tuple<string, HandlerNode>

        const failure = child.getFailure()
        const m = childPattern.length
        kmp: for (let i = cursor, j = 0; i < len; i += 1) {
          while (j > 0 && pattern[i] !== childPattern[j]) {
            j = failure[j - 1]
          }
          if (pattern[i] === childPattern[j]) {
            j += 1
          }
          if (j !== m) {
            continue kmp
          }

          wildcard ??= [childPattern[0], current.wildcard]
          search.push([i + 1, child, [wildcard]])
          j = failure[j - 1]
        }
      }
    }

    let called = false
    while (branches.length > 0) {
      const stack = branches.pop()!

      inner: while (stack.length > 0) {
        const [prefix, current] = stack.pop()!
        const wildcard = current.wildcard
        if (wildcard) {
          wildcard.permanent?.forEach((handler) => (handler(...args), (called ||= true)))
          wildcard.temporary?.forEach((handler) => (handler(...args), (called ||= true)))
          wildcard.temporary = null
          if (wildcard.isEmpty()) {
            current.wildcard = null
          }
        }
        if (prefix === EMPTY) {
          current.permanent?.forEach((handler) => (handler(...args), (called ||= true)))
          current.temporary?.forEach((handler) => (handler(...args), (called ||= true)))
          current.temporary = null
        } else if (current.children?.get(prefix)?.isEmpty()) {
          if (current.children.delete(prefix) && current.children.size === 0) {
            current.children = null
          }
        }

        if (!current.shrink()) {
          break inner
        }
      }
    }

    return called
  }

  *handlers(pattern: string): Generator<EventHandler> {
    const patterns = normalize(pattern).split(WILDCARD)

    const end = patterns.length - 1
    let current: HandlerNode = this.root as HandlerNode
    for (let i = 0, pattern = patterns[0]; i < patterns.length; pattern = patterns[++i]) {
      let cursor = 0
      while (cursor < pattern.length) {
        const prefix = pattern[cursor]
        const child = current.children?.get(prefix)
        if (!child || !pattern.startsWith(child.pattern, cursor)) {
          return
        }

        cursor += child.pattern.length
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

  handlersCount(pattern: string) {
    const patterns = normalize(pattern).split(WILDCARD)
    const end = patterns.length - 1
    let current: HandlerNode = this.root as HandlerNode
    for (let i = 0, pattern = patterns[0]; i < patterns.length; pattern = patterns[++i]) {
      let cursor = 0
      while (cursor < pattern.length) {
        const prefix = pattern[cursor]
        const child = current.children?.get(prefix)
        if (!child || !pattern.startsWith(child.pattern, cursor)) {
          return
        }

        cursor += child.pattern.length
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
