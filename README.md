<h1 align="center">MJML App</h1>

![os](assets/os.png)

<p align="center">
	:email: The desktop app for MJML -
	<a href="https://github.com/ahmetkorkmaz3/mjml-app/releases">Download</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/screenshot-dark.png" />
  <img alt="The MJML App editor with the live preview" src="assets/screenshot.png" />
</picture>

MJML App is a desktop editor for [MJML](https://mjml.io) emails, for macOS, Windows and Linux. It shows a live preview, exports HTML, sends test emails, and imports Figma designs with AI. It is a fork of [mjmlio/mjml-app](https://github.com/mjmlio/mjml-app).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/projects-dark.png" />
  <img alt="The project list of MJML App" src="assets/projects.png" />
</picture>

See [CHANGELOG.md](CHANGELOG.md) for the changes of each release.

## Installation

Download the file for your platform from the [releases page](https://github.com/ahmetkorkmaz3/mjml-app/releases):

- macOS: the `.dmg` file (Apple silicon `arm64` or Intel `x64`)
- Windows: the `.exe` installer
- Linux: the `.AppImage` or the `.tar.gz` file

The app updates itself from the GitHub releases.

## Build from source

You need Node.js 24 (see `.nvmrc`) and Yarn 1.

```bash
yarn                 # install the dependencies
yarn dev             # start the app with hot reload
yarn build           # compile the app to out/
yarn start           # run the compiled app
yarn dist            # build the installers for your platform in release/
yarn dist:dir        # build an unpacked, unsigned app in release/
```

Before you commit, make sure that these commands pass:

```bash
yarn lint
yarn prettier:check
yarn test
```

## Release

The `Release` workflow (`.github/workflows/release.yml`) builds the installers on macOS, Windows and Linux. It uploads them to a draft GitHub release.

1. Set the version in `package.json` (for example `3.1.0`) and add an entry to `CHANGELOG.md`.
2. Commit, then push a tag with the same version: `git tag v3.1.0 && git push origin v3.1.0`.
3. When the workflow is done, open the draft release on GitHub, check the files and publish it.

The installed apps find the update only after you publish the release.

Add these secrets to the repository (Settings > Secrets and variables > Actions):

| Secret                        | Use                                                                    |
| ----------------------------- | ---------------------------------------------------------------------- |
| `CSC_LINK`                    | macOS "Developer ID Application" certificate (`.p12`, base64 encoded) |
| `CSC_KEY_PASSWORD`            | Password of the macOS certificate                                      |
| `APPLE_ID`                    | Apple ID for notarization                                              |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password of the Apple ID                                  |
| `APPLE_TEAM_ID`               | Apple developer team ID                                                |
| `WIN_CSC_LINK`                | Windows code signing certificate (`.pfx`, base64 encoded)              |
| `WIN_CSC_KEY_PASSWORD`        | Password of the Windows certificate                                    |

The workflow uses the `GITHUB_TOKEN` of the run to upload the files. Without the macOS secrets, the macOS app is not signed and not notarized. Without the Windows secrets, the Windows installer is not signed.

## License

[MIT](LICENSE)
