# The Homebrew workflow sets version and sha256 when a release is published
# and pushes this file to https://github.com/ahmetkorkmaz3/homebrew-tap.

cask "mjml-app" do
  arch arm: "arm64", intel: "x64"

  version "3.1.0"
  sha256 arm:   "fa1b628e5038c9eb6d3f753432cf20aed8835403875282c01e8ca7336e011f18",
         intel: "f6ecd7233fe8f6d5665f081431622ac3b59296b4e5136f7b1c5199220be0ba80"

  url "https://github.com/ahmetkorkmaz3/mjml-app/releases/download/v#{version}/mjml-app-#{version}-mac-#{arch}.dmg"
  name "MJML"
  desc "Desktop app to write, preview and export MJML emails"
  homepage "https://ahmetkorkmaz3.github.io/mjml-app/"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: :ventura

  app "MJML.app"

  # The app has only an ad hoc signature (no Apple Developer ID), so Gatekeeper
  # blocks a quarantined copy. Remove the quarantine attribute after the install.
  postflight_steps do
    run "/usr/bin/xattr",
        args:           ["-dr", "com.apple.quarantine", "{{appdir}}/MJML.app"],
        writable_paths: ["{{appdir}}/MJML.app"]
  end

  uninstall quit: "com.mjmlio.mjmlapp"

  zap trash: [
    "~/Library/Application Support/MJML",
    "~/Library/Logs/MJML",
    "~/Library/Preferences/com.mjmlio.mjmlapp.plist",
    "~/Library/Saved Application State/com.mjmlio.mjmlapp.savedState",
  ]

  caveats <<~EOS
    MJML is not signed. The cask removes the quarantine attribute,
    so macOS does not block the first start.
  EOS
end
