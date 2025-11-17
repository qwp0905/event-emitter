import { Nullable } from "./type"

class QueueNode<T> {
  next: Nullable<QueueNode<T>> = null
  constructor(readonly value: T) {}
}

export class Queue<T> {
  private head: Nullable<QueueNode<T>> = null
  private tail: Nullable<QueueNode<T>> = null
  private size = 0

  static from<T>(...values: T[]): Queue<T> {
    const queue = new Queue<T>()
    for (const value of values) {
      queue.push(value)
    }
    return queue
  }

  push(value: T): number {
    const node = new QueueNode(value)
    if (!this.tail) {
      this.head = node
      this.tail = node
    } else {
      this.tail.next = node
      this.tail = node
    }
    return (this.size += 1)
  }

  shift(): T | undefined {
    if (!this.head) {
      return
    }

    const node = this.head
    if (!node.next) {
      this.head = null
      this.tail = null
    } else {
      this.head = node.next
    }
    this.size -= 1
    return node.value
  }

  get length(): number {
    return this.size
  }
}
