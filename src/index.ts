import { getContext, setContext } from 'svelte'
import { writable, derived } from 'svelte/store'
import type { Readable } from 'svelte/store'

const MODELKEY = typeof Symbol !== 'undefined' ? Symbol('@@@MODELKEY') : '@@@MODELKEY'

/* Types */
export type Value<Model> = Model[keyof Model]

export type ModelNode<Model> = Value<Model> | Model

export type Dispatch<Message> = (msg: Message) => void

export type ModelAPI<Model, Message> = [Readable<ModelNode<Model>>, Dispatch<Message>]

export type UpdateFunction<Model, Message> = (msg: Message) => (state: Model) => Model

export type Middleware<Model, Message> = ([model, dispatch]: ModelAPI<Model, Message>) => (next: Dispatch<Message>) => (msg: Message) => void

/* Helpers/TypeGuards */
function isObject<T, S> (x: T | S): x is T {
  return typeof x === 'object' && x !== null
}

function hasProp<T> (obj: T, x: string | number | symbol): x is keyof T {
  return x in obj
}

function reduce<T, S> (reducer: (a: T, cur: S) => T, init: T, iterable: S[]): T {
  return iterable.reduce(reducer, init)
}

/* API */
export const createModel = <Model, Message> (updater: UpdateFunction<Model, Message>) => (initialModel: Model): ModelAPI<Model, Message> => {
  const { subscribe, update } = writable(initialModel)

  const dispatch = (msg: Message): void => {
    update(updater(msg))
  }

  return [{ subscribe }, dispatch]
}

export const withMiddleware = <Model, Message> (...middlewares: Array<Middleware<Model, Message>>) => (updater: UpdateFunction<Model, Message>) => (initialModel: Model): ModelAPI<Model, Message> => {
  const [model, oldDispatch] = createModel<Model, Message>(updater)(initialModel)

  if (!Array.isArray(middlewares) || middlewares.length === 0) return [model, oldDispatch]

  // Some trickery to make every middleware call to 'dispatch'
  // go through the whole middleware chain again
  let dispatch = (_msg: Message): void => {
    throw new Error(
      'Dispatching while constructing your middleware is not allowed. ' +
      'Other middleware would not be applied to this dispatch.',
    )
  }

  const middlewareAPI: ModelAPI<Model, Message> = [
    model,
    (msg) => dispatch(msg),
  ]

  dispatch = middlewares
    .map((middleware) => middleware(middlewareAPI))
    .reduce((next, middleware) => middleware(next), oldDispatch)

  return [model, dispatch]
}

export const provideModel = <Model, Message> ([model, dispatch]: ModelAPI<Model, Message>): void => {
  setContext(MODELKEY, [model, dispatch])
}

export const useModel = <Model, Message> (...path: string[]): ModelAPI<Model, Message> => {
  const [model, dispatch]: ModelAPI<Model, Message> = getContext(MODELKEY)

  if (model == null) {
    throw new Error('Context not found. Please ensure you provide the model using "provideModel" function')
  }

  const { subscribe } = derived(
    model,
    ($model: ModelNode<Model>): ModelNode<Model> =>
      reduce<ModelNode<Model>, string>((acc: ModelNode<Model>, cur: string) => isObject<Model, Value<Model>>(acc) && hasProp(acc, cur) ? acc[cur] : acc, $model, path),
  )

  return [{ subscribe }, dispatch]
}
