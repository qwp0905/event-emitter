import { EMPTY, WILDCARD } from "./constants"
import { EventHandler, HandlerNode } from "./node"
import { Triple, Tuple } from "./type"

function normalize(pattern: string) {
  return pattern.replace(/(\*)+/g, WILDCARD)
}

export class PatternMatcher {
  private readonly root: HandlerNode = new HandlerNode()

  clear() {
    this.root.permanent &&= null
    this.root.temporary &&= null
    this.root.wildcard &&= null
    this.root.children &&= null
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
          const children = (current.children ??= new Map())
          children.set(prefix, (current = new HandlerNode(remain.slice(cursor))))
          break inner
        }

        const match = child.match(remain, cursor)
        cursor += match.length
        if (match === child.pattern) {
          current = child
          continue inner
        }

        const children = (current.children ??= new Map())
        children.set(prefix, (current = child.split(match)))
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

    for (let i = 0, remain = patterns[0]; i < patterns.length; remain = patterns[++i]) {
      let cursor = 0
      while (cursor < remain.length) {
        const prefix = remain[cursor]
        const child = current.children?.get(prefix)
        if (!child || !remain.startsWith(child.pattern, cursor)) {
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
      const children = current.children
      if (prefix === EMPTY) {
        if (current.wildcard?.isEmpty()) {
          current.wildcard = null
        }
      } else if (children?.get(prefix)?.isEmpty()) {
        if (children.delete(prefix) && children.size === 0) {
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

      if (!!current.temporary || !!current.permanent) {
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
      const wildcard = current.wildcard

      if (!wildcard) {
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
      if (!wildcard.children) {
        continue
      }

      for (const child of wildcard.children.values()) {
        const childPattern = child.pattern
        let item: Tuple<string, HandlerNode>

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

          item ??= [childPattern[0], wildcard]
          search.push([i + 1, child, [item]])
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
          wildcard.temporary &&= null
          if (wildcard.isEmpty()) {
            current.wildcard = null
          }
        }

        const children = current.children
        if (prefix === EMPTY) {
          current.permanent?.forEach((handler) => (handler(...args), (called ||= true)))
          current.temporary?.forEach((handler) => (handler(...args), (called ||= true)))
          current.temporary &&= null
        } else if (children?.get(prefix)?.isEmpty()) {
          if (children.delete(prefix) && children.size === 0) {
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
    for (let i = 0, remain = patterns[0]; i < patterns.length; remain = patterns[++i]) {
      let cursor = 0
      while (cursor < remain.length) {
        const prefix = remain[cursor]
        const child = current.children?.get(prefix)
        if (!child || !remain.startsWith(child.pattern, cursor)) {
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

  handlersCount(pattern: string): number {
    const patterns = normalize(pattern).split(WILDCARD)
    const end = patterns.length - 1
    let current: HandlerNode = this.root as HandlerNode
    for (let i = 0, remain = patterns[0]; i < patterns.length; remain = patterns[++i]) {
      let cursor = 0
      while (cursor < remain.length) {
        const prefix = remain[cursor]
        const child = current.children?.get(prefix)
        if (!child || !remain.startsWith(child.pattern, cursor)) {
          return 0
        }

        cursor += child.pattern.length
        current = child
      }

      if (i === end) {
        break
      }

      if (!current.wildcard) {
        return 0
      }

      current = current.wildcard
    }
    return (current.permanent?.size ?? 0) + (current.temporary?.size ?? 0)
  }
}
