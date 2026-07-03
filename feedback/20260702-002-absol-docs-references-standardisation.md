# absol-docs doesn't own the docs/references split — reference folders are ad-hoc per project

- date: 2026-07-02 · project: The distillery / darkrai pipeline doc session · run: n/a
- component: absol-docs (+ absol-newproject scaffolding)

## What happened
The darkrai KB was deliberately capped at doctrine/contract pages, with study & analysis docs
pushed down into project folders — which surfaced that reference material has no standard home.
Today: distillery uses `Reference/` (capitalized), zei uses `references/`, barnowl-noir uses
`archives/` + `docs/`; the user dropped a client PDF into the wrong project's references folder
because nothing enforces or standardises the location. absol-docs currently only scaffolds/registers
`docs/` for the hub; reference folders are invisible to it.

## Expected
absol-docs owns and standardises the doc+references convention: `docs/` = working/hosted stuff for
the project (hub-registered HTML), `references/` = project info files — source PDFs, corpus dumps,
study mds — kept as mds/files or served to homer as needed. absol-newproject scaffolds both; one
canonical folder name; absol-docs can optionally register reference files to the hub when asked.
