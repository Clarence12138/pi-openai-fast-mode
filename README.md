# pi-openai-fast-mode

Pi package that adds a Fast Mode toggle for GPT models on any provider.

<img style="width: 100%; height: auto;" alt="fast mode" src="https://raw.githubusercontent.com/johncmunson/pi-openai-fast-mode/refs/heads/main/preview-img.png" />

## Features

- Registers `/fast [on|off|toggle]` and the startup flag `--fast`
- Automatically recognizes GPT model IDs, including routing prefixes such as `cpr/gpt-6-astra`
- Injects `service_tier: "priority"` only when Fast Mode is enabled and the current model is recognized as GPT
- Leaves other models and disabled-mode requests untouched
- Shows a compact right-aligned TUI `fast` indicator using the same recognition rule
- Persists the toggle in user or project scope

## Install

```bash
pi install npm:pi-openai-fast-mode
# or project-local
pi install -l npm:pi-openai-fast-mode
```

For local development:

```bash
pi -e ./src/index.ts
```

## Usage

```text
/fast          # toggle
/fast toggle   # toggle
/fast on       # enable
/fast off      # disable
```

Start Pi with Fast Mode enabled and persisted:

```bash
pi --fast
```

## Model recognition

No provider allowlist or target list is required. The last slash-separated segment of the model ID must match `gpt-` followed by an alphanumeric character and optional alphanumeric characters, dots, underscores, colons, or hyphens, case-insensitively.

Examples:

- `gpt-5.4`, `gpt-6-astra`, `gpt-6-astra-preview`: recognized
- `cpr/gpt-6-astra`, `router/cpr/gpt-5.6-sol`: recognized on any provider
- `claude-sonnet-4`, `gemini-3.6-flash`, `deepseek-flash`, `grok-4.7`, `o3`: untouched
- `not-gpt-5.4`, `gpt-5.4/claude`: untouched

Recognition uses the model ID, not its display name. Aliases without a GPT model ID are not recognized. A GPT name does not guarantee that an upstream service accepts or honors priority; the `fast` indicator reports client-side intent only.

## Configuration

Fast Mode starts disabled. Only the toggle is persisted:

```json
{
  "enabled": false
}
```

Legacy `targets` entries are ignored and removed when the configuration is saved; their `serviceTier` values do not override priority. The existing enabled state is preserved.

User-scoped state lives at `~/.pi/agent/extensions/pi-openai-fast-mode/config.json`. An existing project config at `./.pi/pi-openai-fast-mode/config.json` takes precedence; project-local installs also use that path.

## Development

```bash
npm install
npm run check
```
