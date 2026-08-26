# Local File Attachments Design

## Goal

Add a polished, local-first attachment flow to the web composer. Users can choose or drag CSV, DOCX, XLSX, PDF, TXT, Markdown, and existing image types; the session keeps an immutable local copy, shows a file card before and after sending, and supplies locally extracted content to the configured model.

## Product behavior

The leading `+` control becomes an attachment menu with **Upload files** and the existing slash-command launcher. Dragging files anywhere over the app uses the same intake path. Before send, each file appears as a stacked card above the input: type badge, filename, size, parse state, and remove action. After send, the same file cards appear beside the user message so a later reader can identify the source material.

The first release accepts CSV, XLSX, DOCX, PDF, TXT, Markdown, JSON, and the already-supported image formats. It rejects files larger than 20 MiB, more than 10 non-image files in one message, and a combined non-image payload above 50 MiB. A rejected batch does not partially enter the draft. Every visible error names the offending file and the reason.

## Local-first data flow

1. The browser reads an accepted `File` as canonical base64 and sends it only to the local Harness host at `127.0.0.1`.
2. `attachment-local` validates MIME/type/size, hashes the original bytes, and writes one content-addressed object beneath `DSH_HOME/attachments/v2/files` with private permissions.
3. A local extractor reads the stored bytes and produces bounded plain-text context. CSV/TXT/Markdown/JSON use UTF-8 decoding; DOCX and XLSX use ZIP/XML extraction; PDF uses a local parser. Extraction is capped at 60,000 Unicode code points per file and 160,000 per message, with an explicit truncation note.
4. The session log stores a durable `file` block containing only an immutable reference and display metadata. It also stores a following text block headed with the filename and local-extraction notice. Provider adapters receive the text block; they do not receive raw office or PDF bytes.
5. The file card is reconstructed from the durable reference on history reload. A session-authorized attachment route can download the original local object without exposing a filesystem path.

The raw file is never uploaded merely by choosing it. When the user submits the prompt, the extracted content becomes model input and follows the configured model provider's normal privacy boundary.

## Architecture

`@deepseek-ai/dsh-attachment` gains generic file vocabulary beside its image vocabulary: `FileAttachmentRef`, `FileAttachmentLimits`, `EncodedFileAttachment`, `SaveFileAttachment`, and store methods for validate/save/read. The local backend owns content-addressed persistence and extraction; it never calls a model provider.

The session prompt wire accepts `file` parts. The API proxy admits files before appending a user message, turns them into durable `file` blocks plus bounded local-extraction text blocks, and retains current image behavior unchanged. The core LLM content union adds a `file` block. DeepSeek and Pi adapters intentionally ignore file blocks because the following local text block is the provider-visible representation.

The conversation controller owns one draft map for both images and files. `ui-attachment` renders the A-style stacked cards and exposes a native file picker, drop target, clipboard intake, removal, and historical file cards. Image previews remain unchanged.

## Security and failure handling

- Names are reduced to a clean leaf name before persistence or session logging.
- MIME type is determined from a conservative extension/type allowlist and confirmed by parser admission where possible; an arbitrary `application/octet-stream` is refused.
- Files are saved before their owning session event, so a logged reference always points to an object; unused content-addressed objects are safe to retain.
- Password-protected/corrupt DOCX/XLSX/PDF files are stored but their card reports that text extraction was unavailable; a concise local notice is provided to the model rather than pretending the file was read.
- The file download route is session-authorized and returns the stored MIME type plus a safe `Content-Disposition` filename.

## Non-goals for this release

- No provider-specific raw-file upload or cloud Files API.
- No OCR for scanned PDFs.
- No automatic conversion of assistant-generated workspace artifacts into attachment cards. The agent can still create them in the selected workspace through existing tools.
- No cross-session attachment library or deletion UI; session references continue to use durable local objects.

## Acceptance criteria

- Selecting or dropping `01_经营数据.csv` renders an A-style card, sends a durable file reference plus extracted table text, and the model can answer questions based on the data.
- Selecting `02_项目背景与要求.docx` renders a Word card and sends readable extracted Chinese text.
- CSV, XLSX, DOCX, PDF, TXT/Markdown, JSON, and images retain their type-specific visual treatment.
- Removing a draft file prevents it from being uploaded; an invalid/oversized batch stays out of the draft and gives a localized error.
- Reloading a session shows sent file cards and permits downloading the original local file.
- Existing image attachment tests and all targeted new attachment tests stay green.
