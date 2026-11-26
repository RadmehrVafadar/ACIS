# AI coach

Select the provider and model in **Help and settings > Assistant settings** or from the Ready screen.

## Connect a provider

| Provider | Host configuration |
| --- | --- |
| Codex CLI | Install a recent Codex CLI with non-interactive mode, run `codex login`, and verify with `codex login status`. |
| OpenAI | Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. |
| Gemini | Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`. |

For API keys, set the host environment variables or copy the example into the ignored local file:

```powershell
Copy-Item .env.example .env.local
```

Edit the file and restart the launcher.
A provider selection and model override can be stored in this browser.
Keys stay on the host.
Codex uses the model from its login unless you set `CODEX_MODEL` or select a model override.
API provider availability on the Ready screen indicates that the corresponding key is configured.
The first request verifies the key and model with the provider.

## During practice

Ask about a requirement, an assertion, syntax, or the next diagnostic step.
Use **Add Context** to select up to four text files and optionally include the latest test output.
The provider receives the public question, recent conversation, your message, and selected context.
Instructor files stay outside the learner workspace and the coaching request.

The Codex adapter runs in a temporary working directory with a read-only sandbox and shell, app, and browser tools disabled.
Hosted adapters send text-only requests.
The coach is instructed to guide the investigation and withhold complete repairs.
Chat history is stored locally with the attempt and has no effect on the grade.
The IDE, preview, timer, and grader operate independently of any model connection.

## Provider references

The local adapter uses the CLI's non-interactive JSON event output. [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive)

The hosted adapters use the Responses and Gemini Interactions APIs. [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create) · [Gemini text generation](https://ai.google.dev/gemini-api/docs/text-generation)
