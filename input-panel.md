# Panel 1 — Input

## Purpose

The Input panel is the entry point for users to submit data to the workflow engine. It provides a configurable webhook URL and a JSON body editor.

## UI Elements

| Element         | Details                                                    |
|-----------------|------------------------------------------------------------|
| Webhook URL     | `<input type="url">`, pre-filled with `DEFAULT_WEBHOOK_URL` (`https://n8n.econode.ai/webhook/start`) |
| JSON Body       | `<textarea>` (12 rows, monospace), pre-filled with example JSON |
| Send Button     | POSTs parsed JSON to the webhook URL via `fetch`           |
| Status Feedback | Success (green) or error (red) message below button        |

## Behavior

- Clicking "Send" sets status to `loading` (button shows "Sending..." and is disabled)
- JSON is parsed first; `SyntaxError` shows "Invalid JSON" error
- On successful POST: checks for `{"message": "Workflow was started"}` in response
  - If matched: sets `workflowActive = true`, shows success message
  - Otherwise: shows error with response message or status code
- Network/other errors are caught and displayed

## Example JSON (pre-filled)

```json
{
  "source": "solar_panel_array_1",
  "readings": [
    { "timestamp": "2026-03-09T10:00:00Z", "kwh": 42.5 }
  ]
}
```

## State Owned

| State        | Type                                                              | Default              |
|--------------|-------------------------------------------------------------------|----------------------|
| `jsonBody`   | `string`                                                          | `EXAMPLE_JSON`       |
| `webhookUrl` | `string`                                                          | `DEFAULT_WEBHOOK_URL`|
| `status`     | `{ type: 'idle'\|'loading'\|'success'\|'error'; message?: string }` | `{ type: 'idle' }`  |

## Webhook Integration

- **URL:** `https://n8n.econode.ai/webhook/start` (configurable via input field)
- **Method:** POST
- **Content-Type:** `application/json`
- **Expected Success Response:** `{ "message": "Workflow was started" }`
- **No authentication** is currently configured

## Side Effects

On successful webhook response, this panel sets `workflowActive = true`, which activates Panel 2 (Workflow) and Panel 3 (Analysis).

## Verification

- [ ] Webhook URL input is editable
- [ ] JSON textarea is editable with pre-filled example
- [ ] "Send" button fires a POST request to the webhook URL
- [ ] Invalid JSON shows "Invalid JSON" error in red
- [ ] Successful response shows green success message
- [ ] Successful response activates Panels 2 and 3 (opacity change)
- [ ] Network errors are caught and displayed in red
