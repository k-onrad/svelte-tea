### Scripts

#### `pnpm run start:dev`

Starts the application in development using `nodemon` and `ts-node` to do hot reloading.

#### `pnpm run start`

Starts the app in production by first building the project with `pnpm run build`, and then executing the compiled JavaScript at `dist/index.js`.

#### `pnpm run build`

Builds the app at `dist`, cleaning the folder first.

#### `pnpm run test`

Runs the `jest` tests once.

#### `pnpm run test:dev`

Run the `jest` tests in watch mode, waiting for file changes.
