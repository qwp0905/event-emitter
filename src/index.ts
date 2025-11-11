interface EventHandler {
  (...args: any[]): any
}
const WILDCARD = "*"
const EMPTY = ""
function normalize(pattern: string) {
  return pattern.replace(/\*+/g, WILDCARD)
}

class HandlerNode {
  protected readonly children: HandlerNode[]
  private readonly handlers = new Set<EventHandler>()
  private wildcard: HandlerNode | null = null
  constructor(
    public pattern: string = "",
    ...children: HandlerNode[]
  ) {
    this.children = children
  }

  call(args: any[]) {
    for (const handler of this.handlers) {
      handler(...args)
    }
  }

  insert(pattern: string, handler: EventHandler) {
    const splitted = pattern.split(WILDCARD)
    const last = splitted.pop()!

    let current = this as HandlerNode
    for (const part of splitted) {
      const node = current._insert(part)
      current = node.wildcard ??= new WildcardNode()
    }

    return current._insert(last, handler)
  }

  private _insert(pattern: string, handler?: EventHandler): HandlerNode {
    if (pattern === EMPTY) {
      if (handler) {
        this.handlers.add(handler)
      }
      return this
    }

    const [index, found] = this.findIndex(pattern)
    if (found) {
      return this.children[index]._insert(EMPTY, handler)
    }

    const start = Math.max(index - 1, 0)
    const end = Math.min(index, this.children.length - 1)

    for (let i = start; i <= end; i += 1) {
      const child = this.children[i]
      const match = child.match(pattern)
      if (match === EMPTY) {
        continue
      }

      if (match === child.pattern) {
        return child._insert(pattern.slice(match.length), handler)
      }

      const node = new HandlerNode(match, child)
      child.pattern = child.pattern.slice(match.length)
      this.children[i] = node
      return node._insert(pattern.slice(match.length), handler)
    }

    const node = new HandlerNode(pattern)
    this.children.splice(index, 0, node)
    return node._insert(EMPTY, handler)
  }

  private findIndex(pattern: string): [number, boolean] {
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

  private match(pattern: string) {
    const len = Math.min(this.pattern.length, pattern.length)
    for (let i = 0; i < len; i += 1) {
      if (this.pattern[i] !== pattern[i]) {
        return pattern.slice(0, i)
      }
    }
    return pattern.slice(0, len)
  }

  *search(pattern: string): Generator<HandlerNode> {
    if (this.wildcard) {
      yield* this.wildcard.search(pattern)
    }
    if (pattern === EMPTY) {
      yield this
      return
    }
    const [index, found] = this.findIndex(pattern)
    if (found) {
      yield* this.children[index].search(EMPTY)
      return
    }

    const start = Math.max(index - 1, 0)
    const end = Math.min(index, this.children.length - 1)
    for (let i = start; i <= end; i += 1) {
      const child = this.children[i]
      if (pattern.startsWith(child.pattern)) {
        yield* child.search(pattern.slice(child.pattern.length))
        return
      }
    }
  }
}

class WildcardNode extends HandlerNode {
  *search(pattern: string): Generator<HandlerNode> {
    yield this

    for (const child of this.children) {
      const index = pattern.indexOf(child.pattern)
      if (index === -1) {
        continue
      }
      yield* child.search(pattern.slice(index + child.pattern.length))
    }
  }
}

export class EventEmitter {
  private readonly root = new HandlerNode()

  on(pattern: string, handler: EventHandler) {
    this.root.insert(normalize(pattern), handler)
    return this
  }
  addListener = this.on

  // off(pattern: string, handler: EventHandler) {}
  // removeListener = this.off

  emit(pattern: string, ...args: any[]) {
    for (const node of this.root.search(pattern)) {
      node.call(args)
    }
  }
}
