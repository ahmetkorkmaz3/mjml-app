# Contributing to MJML App

Thank you for your help. This file tells you how to report a bug, set up the project and send a pull request.

## Report a bug or ask for a feature

Open an [issue](https://github.com/ahmetkorkmaz3/mjml-app/issues/new/choose) and use the template.

- Give the app version ("About MJML" in the menu) and your operating system.
- Give the steps that cause the bug. Attach the `.mjml` file if you can.
- A bug in the rendered HTML is usually an MJML bug. Make sure that the bug also occurs with the [MJML online editor](https://mjml.io/try-it-live). If it does, report it in [mjmlio/mjml](https://github.com/mjmlio/mjml/issues).

For a large change, open an issue before you start. Then we can agree on the solution before you write the code.

## Set up the project

You need:

- Node.js 24. The version is in `.nvmrc`, so `nvm use` selects it.
- Yarn 1. `yarn.lock` is the lockfile. Do not use npm or pnpm.

```bash
git clone https://github.com/ahmetkorkmaz3/mjml-app.git
cd mjml-app
yarn        # install the dependencies
yarn dev    # start the app with hot reload
```

### Commands

| Command               | What it does                                                 |
| --------------------- | ------------------------------------------------------------ |
| `yarn dev`            | Start Vite and the Electron app with hot reload              |
| `yarn build`          | Compile the main process, the preload and the renderer       |
| `yarn start`          | Run the compiled app from `out/`                             |
| `yarn test`           | Run the Vitest unit tests                                    |
| `yarn lint`           | Run ESLint                                                   |
| `yarn prettier`       | Format the repository                                        |
| `yarn prettier:check` | Check the formatting                                         |
| `yarn dist`           | Build the installers for your platform in `release/`         |
| `yarn dist:dir`       | Build an unpacked, unsigned app in `release/`                |
| `yarn site`           | Start the landing page in `site/` on a local server          |

## Project structure

The app is built with electron-vite, Electron, React 19, Redux and CodeMirror 6. It has three parts:

| Part         | Folder         | What it does                                                                         |
| ------------ | -------------- | ------------------------------------------------------------------------------------ |
| Main process | `src/main/`    | The window, the menus, the IPC handlers, the updates, the Figma import and the AI    |
| Preload      | `src/preload/` | Gives `window.api` to the renderer: the file system, MJML rendering and IPC wrappers |
| Renderer     | `src/` folders | The React UI: `components/`, `pages/`, `actions/`, `reducers/`, `helpers/`           |

Other folders:

- `site/`: the landing page on GitHub Pages.
- `assets/`: the screenshots of the README and the landing page.
- `build/`: the app icons.

### Rules for the code

- The renderer has no Node.js access. Do not import `fs`, `path`, `os` or `electron` in the renderer. Use `helpers/api` (`window.api`) and `helpers/fs`.
- The renderer imports from the `src` root, for example `import x from 'helpers/mjml'`. The main process and the preload use relative imports.
- A file with JSX has the `.jsx` extension.
- The reducers use `redux-actions` and Immutable.js.
- Styles use Sass with `@use`. Colors, sizes and shadows come from the CSS custom properties in `src/styles/tokens.scss`. Do not put fixed colors in a component.
- An IPC handler returns `{ error: { code, message } }`. It does not throw.
- API keys and tokens are secrets (`src/main/secrets.js`). Do not keep them in the settings.
- The email preview must never run scripts. Do not add `allow-scripts` to the preview iframe.
- A package that the main process or the preload uses at run time goes in `dependencies`. A package that Vite bundles goes in `devDependencies`.

## Tests

The tests use Vitest. A test file is next to the code, with the name `*.test.js`.

- The tests run in Node.js, so a test must not import `electron`.
- A tested renderer module must not import `helpers/api`, because `helpers/api` reads `window`.
- Add a test when you change the main process code or a pure helper or reducer.

## Send a pull request

1. Fork the repository and make a branch from `master`. Use a prefix for the branch name: `feat/`, `fix/` or `docs/`.
2. Keep one topic in one pull request.
3. Run the checks before you commit:

   ```bash
   yarn lint
   yarn prettier:check
   yarn test
   ```

4. For a change that the user can see, add a line to `CHANGELOG.md`. For a UI change, add a screenshot to the pull request.
5. Open the pull request against `master`. Tell what the change does and how you tested it.

CI runs the checks and `yarn dist:dir` on macOS, Windows and Linux. A pull request must pass CI before the merge.

### Commit messages

Write the subject in the imperative mood, with a capital letter and no period. For example: "Fix the preview of partial files". Use the body to tell why you made the change.

## Release

The maintainer makes the releases. The `Release` workflow (`.github/workflows/release.yml`) builds the installers on macOS, Windows and Linux and uploads them to a draft GitHub release.

1. Set the version in `package.json` (for example `3.2.0`) and add an entry to `CHANGELOG.md`.
2. Commit, then push a tag with the same version: `git tag v3.2.0 && git push origin v3.2.0`.
3. When the workflow is done, open the draft release on GitHub. Check the files and publish the release.

When you publish the release, the `Homebrew` workflow (`.github/workflows/homebrew.yml`) sets the version and the `sha256` values in `homebrew/mjml-app.rb` and pushes the cask to [ahmetkorkmaz3/homebrew-tap](https://github.com/ahmetkorkmaz3/homebrew-tap). The workflow needs the `HOMEBREW_TAP_TOKEN` secret: a fine-grained token with "Contents: Read and write" access to `homebrew-tap`. To push the cask of an old release again, run the workflow by hand with the tag. Edit the cask in `homebrew/mjml-app.rb`, not in the tap.

The installed apps find the update only after you publish the release. The workflow does not sign the macOS app or the Windows installer, and it does not notarize the macOS app.

## License

By contributing, you agree that your contributions are licensed under the [MIT license](LICENSE).
