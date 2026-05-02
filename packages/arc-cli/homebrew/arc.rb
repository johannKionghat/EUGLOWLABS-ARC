# Homebrew formula skeleton for the EuglowLabs ARC CLI.
#
# Lives in this repo for review; the published copy belongs in a
# dedicated `homebrew-arc` tap at github.com/euglowlabs/homebrew-arc.
# The publish workflow uploads the cross-compiled binaries to a
# GitHub Release; this formula points at those URLs.
#
# Bump VERSION + the four sha256 lines on every release.
class Arc < Formula
  desc "EuglowLabs ARC CLI — bootstrap and operate your self-hosted ARC stack"
  homepage "https://github.com/johannKionghat/EUGLOWLABS-ARC"
  version "0.0.0"
  license "Apache-2.0"

  on_macos do
    on_arm do
      url "https://github.com/johannKionghat/EUGLOWLABS-ARC/releases/download/v#{version}/arc-darwin-arm64"
      sha256 "REPLACE_ME"
    end
    on_intel do
      url "https://github.com/johannKionghat/EUGLOWLABS-ARC/releases/download/v#{version}/arc-darwin-x64"
      sha256 "REPLACE_ME"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/johannKionghat/EUGLOWLABS-ARC/releases/download/v#{version}/arc-linux-arm64"
      sha256 "REPLACE_ME"
    end
    on_intel do
      url "https://github.com/johannKionghat/EUGLOWLABS-ARC/releases/download/v#{version}/arc-linux-x64"
      sha256 "REPLACE_ME"
    end
  end

  def install
    bin.install Dir["arc-*"].first => "arc"
  end

  test do
    assert_match "arc #{version}", shell_output("#{bin}/arc version")
  end
end
