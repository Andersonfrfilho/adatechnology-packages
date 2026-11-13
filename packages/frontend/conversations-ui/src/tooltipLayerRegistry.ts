export type TooltipLayerRegistry = {
  /** Mounts a layer; the callback hears when it becomes (true) or stops being (false) the one that draws. */
  readonly register: (layer: object, onOwnershipChange: (isOwner: boolean) => void) => () => void
}

/** Layers in mount order: one draws at a time, and when it unmounts the next mounted one takes over. */
export function createTooltipLayerRegistry(): TooltipLayerRegistry {
  const layers = new Map<object, (isOwner: boolean) => void>()
  let owner: object | undefined

  function handOff(): void {
    const next = layers.entries().next()
    if (next.done) {
      owner = undefined
      return
    }
    const [layer, onOwnershipChange] = next.value
    owner = layer
    onOwnershipChange(true)
  }

  return {
    register(layer, onOwnershipChange) {
      layers.set(layer, onOwnershipChange)
      if (owner === undefined) handOff()
      return () => {
        layers.delete(layer)
        if (owner !== layer) return
        owner = undefined
        handOff()
      }
    },
  }
}
