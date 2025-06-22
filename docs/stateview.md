---
title: "State View"
---
import { Callout } from 'nextra/components'

# Per-client State Visibility with `StateView`

<Callout type="info" emoji="🆕">
    This feature was introduced in version `0.16`. It replaces the previously experimental `@filter()` and `@filterChildren()` decorators.
</Callout>

By default, the entire state is visible to all clients. However, you may want to control which parts of the state are visible to each client.

**You can do so by:**

1. Assigning a `StateView` instance to the client
2. Tag state fields with the `@view()` decorator
3. Manually `.add()` schema instances to the `StateView`
4. Manually `.remove()` schema instances from the `StateView`

A `StateView` instance must be assigned to the `client.view`.

<Callout type="warning">
    It is not recommended to rely on `StateView` for big datasets, as it is not optimized for that yet. However, it is a great way to filter data per client, such as "private fields" per schema instance, "level of detail", area-based, team-owned data, and etc.
</Callout>

## Initializing a `StateView`

```ts filename="MyRoom.ts"
import { StateView } from "@colyseus/schema";
// ...
    onJoin(client, options) {
        client.view = new StateView();
        // ...
    }
// ...
```

<Callout type="info">
    **How serialization works**

    - Each `StateView` instance is going to add a new encoding step for state serialization.
    - You may re-use the same `StateView` instance for multiple clients, or create a new one for each client.
    - Internally, all "shared" properties (properties not tagged with `@view()`) are serialized first, and then each `StateView` is serialized with its own set of properties.
</Callout>


## Tagging fields with `@view()`

The `@view()` decorator is used to tag a field as only visible to `StateView`'s that contains that `Schema` instance.

```ts {6} filename="MyState.ts"
class Player extends Schema {
    // visible to all
    @type("string") name: string;

    // only visible to clients containing this schema instance on their `StateView`
    @view() @type("number") position: number;
}
```

On the example above, the `position` field is only visible to clients that contain this `Player` instance on their `StateView`.

### Adding a schema instance to a `StateView`

In order to add a schema instance to a `StateView`, you must call `.add()` on the `StateView` instance:

```ts {7,8} filename="MyRoom.ts"
import { StateView } from "@colyseus/schema";
// ...
    onJoin(client, options) {
        const player = new Player();
        this.state.players.set(client.sessionId, player);

        client.view = new StateView();
        client.view.add(player);
    }
```

The client-side will receive either a "On Add" or "Listen" callback you can listen to, depending on which structure the schema instance is part of.

### Removing a schema instance from a `StateView`

In order to remove a schema instance from a `StateView`, you must call `.remove()` on the `StateView` instance:

```typescript
client.view.remove(player);
```

The client-side will receive either a "On Remove" or "Listen" callback you can listen to, depending on which structure the schema instance is part of.

### Checking if instance is part of `StateView`

You can check if a schema instance is part of a `StateView` by calling `.has()` on the `StateView` instance:

```typescript
if (client.view.has(player)) {
    // player is part of this client's StateView
}
```

The client-side will receive either a "On Remove" or "Listen" callback you can listen to, depending on which structure the schema instance is part of.

## Specialized tags with `@view(tag: number)`

Sometimes you may want to have multiple views with different fields.

```ts {9} filename="MyState.ts"
class Player extends Schema {
    // visible to all
    @type("string") name: string;

    // any `.add(player)` will see this field
    @view() @type("number") health: number;

    // only `.add(player, 1)` will see this field
    @view(1) @type("number") position: number;
}
```

By assigning a numeric tag to the `@view()` decorator, that field will only be visible to clients that contain this `Schema` instance on their `StateView` with the same tag:

```ts {6,7} filename="MyRoom.ts"
// ...
    onJoin(client, options) {
        const player = new Player().assign({ name: "Player 1", health: 100, position: 0 });
        this.state.players.set(client.sessionId, player);

        client.view = new StateView();
        client.view.add(player, 1); // add with tag 1 - "position" field is visible
    }
// ...
```


On the example above, the `attributes` field is only visible to clients that contain this `Player` instance on their `StateView` with tag `1`, whereas the `position` field is visible to all clients that contain this `Player` instance on their `StateView`.

---

The following table shows the relation between type annotations and the visibility of each field on the client-side:

| Annotations              | Without `view.add()` | `view.add(instance)` | `view.add(instance, 1)` |
|-----------------------------------|----------------------|-------------------------|-----------------|
| `@type(...)`                      | ✅                   | ✅                       | ✅              |
| `@view() @type(...)`              | ❌                   | ✅                       | ✅              |
| `@view(1) @type(...)`             | ❌                   | ❌                       | ✅              |

## Items of `ArraySchema` and `MapSchema`

When you tag an array or map with `@view()`, each element of the array or map must be added to the client's `StateView` individually.

```ts {7} filename="MyState.ts"
class Player extends Schema {
    @type("string") name: string;
    @type("number") position: number;
}

class MyState extends Schema {
    @view() @type({ map: Player }) players = new MapSchema<Player>();
}
```

The instance must be assigned to the state and added to the `StateView`:

```ts {6,7} filename="MyRoom.ts"
import { StateView } from "@colyseus/schema";
// ...
    onJoin(client, options) {
        const player = new Player();
        this.state.players.set(client.sessionId, player);

        client.view = new StateView();
        client.view.add(player);
    }
// ...
```
