# Nebulosa public saved lists, v1

UI: `/lists`, `/lists?owner=alice&list=nebulosa.alice.lists.art`.
Discover and gallery Save buttons open the list checkbox picker. Checked membership
changes only after a successful Keychain Posting signature. All list contents are public.

## Identifiers

- Directory: `nebulosa.<owner>.mylists`.
- List: `nebulosa.<owner>.lists.<slug>`.
- Hive limits custom JSON IDs to 32 UTF-8 bytes. Longer identifiers become
  `neb.index.<hash>` or `neb.list.<hash>`, using the first 10 SHA-256 bytes of the
  full logical identifier as lowercase hexadecimal. Owner and slug remain in payloads.
- Titles are 1–80 characters; slugs are accent-normalized lowercase ASCII.

## Snapshots

Directory JSON:

```json
{"app":"nebulosa","version":1,"kind":"catalog","owner":"alice","revision":1,"lists":[{"id":"nebulosa.alice.lists.art","slug":"art","title":"Art"}]}
```

List JSON:

```json
{"app":"nebulosa","version":1,"kind":"list","owner":"alice","id":"nebulosa.alice.lists.art","slug":"art","title":"Art","revision":1,"posts":[{"author":"bob","permlink":"painting","title":"Painting"}]}
```

Each update publishes a complete snapshot. `revision` is a client timestamp, increased
monotonically for local edits, used to preserve successful writes in local cache
while HafSQL catches up. Chain operation order chooses the latest remote snapshot.
Payloads exceeding 8,192 UTF-8 bytes are rejected before asking Keychain to sign.
A full list needs a new list; this version does not shard payloads.

Create the list first, then publish the directory. Cache a successful first operation
as pending until directory publication succeeds. “Finish publication” retries the
second operation. Cache is scoped to the signed-in account and survives a reload.

## Read and trust model

GET `https://rpc.mahdiyari.info/hafsql/operations/custom_json/{id}?limit=100`.
Paginate older operations with `start`, preserving database IDs as bigint strings.
Ignore operations unless the owner appears in required_posting_auths or required_auths,
the custom_id matches, and app/version/owner/kind/schema match the expected payload.
Directory references must match the deterministic ID derived from owner and slug.
Do not follow transitive references or trust an owner field without a matching signer.

Refresh indexed state before writes. The newest snapshot wins; simultaneous edits on
multiple devices can still overwrite one another during indexer lag. There is no
on-chain compare-and-swap or cross-device merge in v1. Errors are surfaced rather
than treated as an empty collection. Locally confirmed snapshots bridge indexer lag.
Existing legacy local bookmarks are not deleted or automatically published.

Documentation checked: https://rpc.mahdiyari.info/hafsql/openapi.json and
https://developers.hive.io/apidefinitions/ (custom operation size limits).
