// Package schemas embeds the per-agent schema packs. The packs are the
// product: the UI knows nothing about individual keys, it renders whatever
// these files describe. See SCHEMA.md for the format.
package schemas

import "embed"

//go:embed *.json
var FS embed.FS
