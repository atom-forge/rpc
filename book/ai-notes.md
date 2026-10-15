# AI Notes

A coding agent works best when it reads the documentation of the package first and knows the decisions your project has already made. Copy the fenced block below into the instruction file of your project (for example `AGENTS.md`) and replace every `<...>` field with a fact you have verified in your application.

## Purpose

Separate the package's transport and response contracts from the application's
API conventions, branch map, and middleware inventory.

## Copyable instructions

````markdown
## AtomForge RPC

Before implementing endpoints, clients, or middleware with `@atom-forge/rpc`,
start with `node_modules/@atom-forge/rpc/README-AI.md` at the package root,
then follow its pointers to the task-relevant documentation. Follow dependency
symlinks to the library repository when present. Use documentation matching the
installed version; Markdown filesystem paths are not package import subpaths.

Read the relevant server, client, validation, middleware, response/error, and
upload guidance for the task. Verify the API rather than importing example-local
helpers as if they were package exports.

These are this project's API conventions:

- Server API definition / composition: <SERVER_API_LOCATION>
- Client construction and shared API type: <CLIENT_LOCATION_AND_TYPE>
- Transport mount and prefix: <MOUNT_AND_PREFIX>

- Endpoint grouping / naming within each branch: <GROUPING_POLICY>
- Read and mutation conventions: <OPERATION_POLICY>
- Input validation: <VALIDATION_POLICY>
- Domain-to-RPC error translation: <ERROR_POLICY_AND_LOCATION>

### API branch map

Read the project's branch map before choosing where an endpoint belongs. Each
branch describes its audience and responsibility; group endpoints within it by
business capability. These are project-defined branches, not built-in RPC names.

| Branch | Purpose / consumers | Definition location | Typical capabilities |
| --- | --- | --- | --- |
| <BRANCH_NAME> | <PURPOSE_AND_CONSUMERS> | <DEFINITION_LOCATION> | <CAPABILITIES> |

An illustrative arrangement:

```text
admin/     # management and operational workflows
  items/   # management operations on items
client/    # application workflows used by the client-facing product
  items/   # item operations required by that product surface
guest/     # browsing and informational workflows
  items/   # item discovery and display
```

Replace these branch names and descriptions with the application's actual map.
The tree describes an API hierarchy; it does not imply matching filesystem
paths or transport URLs unless the project explicitly uses that mapping.

Before adding an endpoint:

- Identify its consumers and choose the branch whose documented responsibility
  fits the operation.
- Reuse the project's business-capability grouping and naming conventions.
- Check for an existing operation before adding a near-duplicate.
- Share business behavior behind the API where appropriate; keep each branch's
  input and response contract explicit.
- Do not create a new branch just because a new screen needs an endpoint.
- If no branch fits, propose a focused change to this map rather than silently
  creating a competing hierarchy.

### Existing middleware

| Middleware | Location | Runs where / in what order | Provides or enforces |
| --- | --- | --- | --- |
| <MIDDLEWARE_NAME> | <PROJECT_LOCATION> | <SCOPE_AND_ORDER> | <CONTRACT> |

Follow these existing conventions and use the relevant middleware. Do not invent
middleware names, request-context fields, or client wrappers. Distinguish
request parsing, transport failures, and application errors according to their
real contracts.
Preserve the existing middleware order; verify its behavior before changing it.
Keep server-only runtime dependencies out of client code.
````

## Usage

Fill the fields from the target project's API and middleware code. The template
does not prescribe a framework, validator version, route prefix, or error wrapper.
Fill the branch table from the actual API definitions. `admin`, `client`, and
`guest` are illustrative, not a mandatory three-branch architecture.
If middleware is absent, record that fact rather than adding a fictitious entry. Library documentation defines API behavior;
the completed project section defines local policy.
