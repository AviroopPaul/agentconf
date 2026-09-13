#!/bin/sh
# agentconf installer: downloads the latest release binary for this OS and
# architecture into ~/.local/bin (or $AGENTCONF_INSTALL_DIR).
#
#   curl -fsSL https://raw.githubusercontent.com/AviroopPaul/agentconf/main/install.sh | sh
#
# The binary is read-only by design: it never writes to your agent config
# and never opens credential files. Source: https://github.com/AviroopPaul/agentconf
set -eu

REPO="AviroopPaul/agentconf"
BIN="agentconf"
DIR="${AGENTCONF_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$arch" in
  x86_64|amd64) arch="amd64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) echo "agentconf: unsupported architecture: $arch" >&2; exit 1 ;;
esac
case "$os" in
  darwin|linux) ;;
  *) echo "agentconf: unsupported OS: $os (use 'go install github.com/$REPO/app/cmd/agentconf@latest')" >&2; exit 1 ;;
esac

tag="${AGENTCONF_VERSION:-}"
if [ -z "$tag" ]; then
  tag="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)"
fi
if [ -z "$tag" ]; then
  echo "agentconf: could not determine latest release. Try: go install github.com/$REPO/app/cmd/agentconf@latest" >&2
  exit 1
fi
ver="${tag#v}"
asset="${BIN}_${ver}_${os}_${arch}.tar.gz"
url="https://github.com/$REPO/releases/download/$tag/$asset"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "agentconf: downloading $tag for $os/$arch"
curl -fsSL "$url" -o "$tmp/$asset"
tar -xzf "$tmp/$asset" -C "$tmp"
mkdir -p "$DIR"
install -m 0755 "$tmp/$BIN" "$DIR/$BIN"

echo "agentconf: installed to $DIR/$BIN"
case ":$PATH:" in
  *":$DIR:"*) ;;
  *) echo "agentconf: add $DIR to your PATH, then run: agentconf" ;;
esac
echo "agentconf: run 'agentconf' to open the UI"
