import { getContext, setContext } from 'svelte'
import { writable, derived } from 'svelte/store'
import type { Readable } from 'svelte/store'

/* Reserved Constant */
const MODELKEY = typeof Symbol !== 'undefined' ? Symbol('svelte-tea/model') : 'svelte-tea/model'

/* Types */
export type Value<Model> = Model[keyof Model]

export type ModelNode<Model> = Value<Model> | Model

export type Dispatch<Message> = (msg: Message) => void

export type ModelAPI<Model, Message> = [Readable<ModelNode<Model>>, Dispatch<Message>]

export type UpdateFunction<Model, Message> = (msg: Message) => (model: Model) => Model

export type Middleware<Model, Message> = ([model, dispatch]: ModelAPI<Model, Message>) => (next: Dispatch<Message>) => (msg: Message) => void

/* TypeGuards */
function isObjNotProp<T> (x: T | T[keyof T]): x is T {
  return typeof x === 'object' && x !== null
}

function hasProp<T> (obj: T, x: string | number | symbol): x is keyof T {
  return x in obj
}

/* API */
export const createModel = <Model, Message> (update: UpdateFunction<Model, Message>) => (init: Model): ModelAPI<Model, Message> => {
  const { subscribe, update: updateStore } = writable(init)

  const dispatch: Dispatch<Message> = (msg) => {
    updateStore(update(msg))
  }

  return [{ subscribe }, dispatch]
}

export const withMiddleware = <Model, Message> (...middlewares: Array<Middleware<Model, Message>>) => (update: UpdateFunction<Model, Message>) => (init: Model): ModelAPI<Model, Message> => {
  const [model, oldDispatch] = createModel<Model, Message>(update)(init)

  if (!Array.isArray(middlewares) || middlewares.length === 0) return [model, oldDispatch]

  // Some trickery to make every middleware call to 'dispatch'
  // go through the whole middleware chain again
  let dispatch: Dispatch<Message> = (_msg) => {
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
    ($model: ModelNode<Model>): ModelNode<Model> => {
      const reducer = (acc: ModelNode<Model>, cur: string): ModelNode<Model> => {
        if (isObjNotProp<Model>(acc) && hasProp(acc, cur)) return acc[cur]
        throw new Error(`Model or node of model ${JSON.stringify(acc)} does not have property ${cur}`)
      }
      return path.reduce(reducer, $model)
    },
  )

  return [{ subscribe }, dispatch]
}
