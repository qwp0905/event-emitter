# Event Emitter

A high-performance, pattern-matching event emitter implementation with wildcard support, built with TypeScript. This library provides an efficient event system that supports both string patterns (with wildcards) and symbol-based events, similar to Node.js EventEmitter but with advanced pattern matching capabilities.

## Features

- 🚀 **High Performance**: Optimized Radix Tree-based data structure for efficient pattern matching
- 🎯 **Wildcard Support**: Advanced pattern matching with `*` wildcards (e.g., `user.*.created`)
- 🔍 **KMP Algorithm**: Knuth-Morris-Pratt algorithm for efficient wildcard pattern matching
- 💾 **Memory Efficient**: Automatic tree shrinking and WeakRef-based parent references
- 🔄 **Dual Handler Types**: Support for permanent and temporary (one-time) event handlers
- 📦 **TypeScript**: Fully typed with TypeScript for better developer experience
- 🎨 **Node.js Compatible**: API compatible with Node.js EventEmitter

## Installation

```bash
npm install @qwp0905/event-emitter
# or
yarn add @qwp0905/event-emitter
```

## Quick Start

```typescript
import { EventEmitter } from "@qwp0905/event-emitter"

const emitter = new EventEmitter()

// Register a permanent handler
emitter.on("user.created", (user) => {
  console.log("User created:", user)
})

// Register a one-time handler
emitter.once("user.updated", (user) => {
  console.log("User updated (only once):", user)
})

// Wildcard pattern matching
emitter.on("user.*.deleted", (id) => {
  console.log("User deleted with ID:", id)
})

// Emit events
emitter.emit("user.created", { id: 1, name: "John" })
emitter.emit("user.updated", { id: 1, name: "Jane" })
emitter.emit("user.123.deleted", 123) // Matches 'user.*.deleted'

// Symbol-based events
const SYMBOL_EVENT = Symbol("custom-event")
emitter.on(SYMBOL_EVENT, (data) => {
  console.log("Symbol event:", data)
})
emitter.emit(SYMBOL_EVENT, "Hello")
```

## API Reference

### EventEmitter

#### Methods

##### `on(pattern: EventPattern, handler: EventHandler): this`

Registers a permanent event handler for the given pattern.

- **pattern**: `string | symbol` - Event pattern (supports wildcards for strings)
- **handler**: `(...args: any[]) => any` - Event handler function
- **Returns**: `this` for method chaining

```typescript
emitter.on("user.created", (user) => {
  console.log(user)
})
```

##### `once(pattern: EventPattern, handler: EventHandler): this`

Registers a one-time event handler that will be automatically removed after the first emission.

- **pattern**: `string | symbol` - Event pattern
- **handler**: `(...args: any[]) => any` - Event handler function
- **Returns**: `this` for method chaining

```typescript
emitter.once("user.login", (user) => {
  console.log("First login:", user)
})
```

##### `off(pattern: EventPattern, handler: EventHandler): this`

Removes a specific event handler for the given pattern.

- **pattern**: `string | symbol` - Event pattern
- **handler**: `EventHandler` - Specific handler to remove
- **Returns**: `this` for method chaining

```typescript
const handler = (user) => console.log(user)
emitter.on("user.created", handler)
emitter.off("user.created", handler) // Remove specific handler
```

> **Note**: To remove all handlers for a pattern, use `removeAllListeners(pattern)` instead.

##### `emit(pattern: EventPattern, ...args: any[]): boolean`

Emits an event, calling all matching handlers. Returns `true` if any handler was called.

- **pattern**: `string | symbol` - Event pattern to emit
- **args**: `any[]` - Arguments to pass to handlers
- **Returns**: `boolean` - Whether any handler was called

```typescript
const called = emitter.emit("user.created", { id: 1, name: "John" })
```

##### `removeAllListeners(pattern?: EventPattern): this`

Removes all listeners for a specific pattern, or all listeners if no pattern is provided.

- **pattern**: `EventPattern` (optional) - Pattern to clear
- **Returns**: `this` for method chaining

```typescript
emitter.removeAllListeners("user.created") // Remove all handlers for pattern
emitter.removeAllListeners() // Remove all handlers
```

##### `listeners(pattern: EventPattern): EventHandler[]`

Returns an array of all listeners for the given pattern.

- **pattern**: `EventPattern` - Event pattern
- **Returns**: `EventHandler[]` - Array of handler functions

```typescript
const handlers = emitter.listeners("user.created")
```

##### `listenerCount(pattern: EventPattern): number`

Returns the number of listeners for the given pattern.

- **pattern**: `EventPattern` - Event pattern
- **Returns**: `number` - Number of listeners

```typescript
const count = emitter.listenerCount("user.created")
```

##### `eventNames(): EventPattern[]`

Returns an array of all registered event patterns.

- **Returns**: `EventPattern[]` - Array of event patterns

```typescript
const events = emitter.eventNames()
```

#### Aliases

- `addListener` - Alias for `on`
- `removeListener` - Alias for `off`
- `rawListeners` - Alias for `listeners`

## Pattern Matching

### Wildcard Patterns

The library supports wildcard (`*`) patterns for flexible event matching:

```typescript
// Match any single segment
emitter.on("user.*.created", (data) => {
  console.log("User created in any category")
})

const data = { id: 1, name: "John" }
emitter.emit("user.admin.created", data) // ✓ Matches
emitter.emit("user.moderator.created", data) // ✓ Matches
emitter.emit("user.created", data) // ✗ Doesn't match (no segment)

// Multiple wildcards
emitter.on("*.action.*", (data) => {
  console.log("Action in any namespace and context")
})

emitter.emit("user.action.create", data) // ✓ Matches
emitter.emit("admin.action.delete", data) // ✓ Matches
```

### Pattern Normalization

Multiple consecutive wildcards are automatically normalized:

```typescript
const handler = (data) => console.log(data)

// These are equivalent:
emitter.on("user.***.created", handler)
emitter.on("user.*.created", handler)
```

## Architecture

### Data Structure

The library uses a **Radix Tree** (also known as a Patricia Tree) structure to efficiently store and match event patterns:

```
Root
├── "user"
│   ├── ".created" → [handlers]
│   ├── ".updated" → [handlers]
│   └── "*" (wildcard)
│       └── ".deleted" → [handlers]
└── "admin"
    └── ".action" → [handlers]
```

### Key Components

#### 1. HandlerNode (`node.ts`)

The core tree node implementation with the following features:

- **Binary Search**: Children are kept sorted for O(log n) insertion and lookup
- **Node Splitting**: Common prefixes are automatically split into parent nodes
- **Tree Shrinking**: Empty nodes are automatically merged after handler removal
- **WeakRef Parent Links**: Prevents memory leaks with circular references

#### 2. Queue (`queue.ts`)

A linked-list based queue implementation for efficient BFS traversal during pattern matching.

#### 3. KMP Algorithm

The Knuth-Morris-Pratt algorithm is used for efficient wildcard pattern matching, avoiding unnecessary backtracking.

### Algorithm Complexity

- **Insertion**: O(m log n) where m is pattern length, n is number of nodes
- **Search/Matching**: O(m + k) where m is pattern length, k is number of matching handlers
- **Removal**: O(m log n)

### Memory Management

- **Automatic Cleanup**: Temporary handlers are automatically removed after execution
- **Tree Shrinking**: Empty nodes are merged to reduce memory footprint
- **WeakRef**: Parent references use WeakRef to prevent memory leaks

## Advanced Usage

### Pattern Matching Examples

```typescript
const emitter = new EventEmitter()
const handler = (data) => console.log(data)

// Exact match
emitter.on("user.created", handler)

// Single wildcard
emitter.on("user.*.deleted", handler)

// Multiple wildcards
emitter.on("*.action.*", handler)

// Complex patterns
emitter.on("api.v1.*.post", handler)
emitter.on("api.*.*.get", handler)
```

### Symbol Events

Symbol-based events provide a way to create private or namespaced events:

```typescript
const PRIVATE_EVENT = Symbol("private")
const PUBLIC_EVENT = Symbol("public")
const handler = (data) => console.log(data)

emitter.on(PRIVATE_EVENT, handler)
const data = "Hello"
emitter.emit(PRIVATE_EVENT, data)
```

### Handler Management

```typescript
// Get all listeners
const listeners = emitter.listeners("user.created")

// Count listeners
const count = emitter.listenerCount("user.created")

// Get all event names
const events = emitter.eventNames()

// Remove specific handler
const handler = () => console.log("test")
emitter.on("test", handler)
emitter.off("test", handler)
```

## Performance Considerations

1. **Pattern Complexity**: More complex patterns with multiple wildcards may have slightly higher matching overhead
2. **Handler Count**: Large numbers of handlers per pattern may impact emit performance
3. **Tree Depth**: Very deep pattern hierarchies may affect insertion/removal performance
