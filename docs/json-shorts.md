# Nebulosa Snaps v1

Nebulosa Snaps is an independent page at `/snaps`, available from desktop and mobile
menus. Existing Peak Snaps remains at `/shorts`, with its original comment/rewards
workflow. There is no shared mode selector or preferred-mode setting.

Nebulosa Snaps publishes only custom_json operations, signed with Posting via Hive
Keychain. It does not publish Hive comment, comment_options, vote or reblog operations.
Reactions do not create payouts or consume Voting Power; publication still consumes
Resource Credits. Both products are public and their records remain on Hive.

Shared `/snaps?snap=author/uuid` URLs open conversations; `/snaps?channel=owner/slug`
opens channels. Old `/shorts?mode=json` links redirect to `/snaps`, preserving snap,
channel and focus parameters. `/shorts?mode=rewards` normalizes to `/shorts`.
Legacy `/shorts/@author/permlink` URLs continue to open Peak Snaps.

## Events

All events carry `app: "nebulosa-shorts"`, `version: 1`, a fresh UUID v4 `id`, and
`actor` matching a required Posting or Active signer on the actual operation.

- `snap`: `{root:{author,id}, parent:null|{author,id}, channel:null|"owner/slug", body}`.
  A top-level snap's root is itself. Replies keep the original conversation root and
  reference a preceding root/reply as parent. Replies must retain their root's channel.
- `vote`: `{root:{author,id}, target:{author,id}, value:-1|0|1}`. The newest operation
  from each signer for each target is their current reaction. Zero removes the reaction.
  Reaction counts are social counts, not stake-weighted Hive votes.
- `resnap`: `{root:{author,id}, target:{author,id}, channel:null|"owner/slug"}`.
  Each resnap is its own top-level item and conversation, referencing an original root.
  Replies can be added to the resnap itself. The original counts unique resnapping
  signers. UI prevents repeating the same resnap. Removing a published resnap is not
  included in v1. Original content is loaded by reference, not copied into the resnap.
- `channel`: `{slug,title,description}`. A channel is an open public posting topic under
  the creator's `actor/slug` namespace. Reusing a display name under another account
  does not give that account control of the original namespace. These are independent
  of Hive Communities; no membership, ownership transfer or channel moderation is implied.

A body supports existing sanitized Markdown/media rendering and up to 300 visible
characters (URLs and image destinations excluded), with a 6,000-byte raw body ceiling.
Every complete custom JSON payload is validated against Hive's 8,192-byte limit.

## Routing and discovery

- Global root/resnap feed: `nebulosa.shorts.v1`.
- Channel directory: `nebulosa.channels.v1`.
- Conversation stream: `neb.thread.<hash>`.
- Channel feed: `neb.channel.<hash>`.

Hashes are the first 10 bytes of SHA-256 of the canonical `author/uuid` root or
`owner/slug` channel key, encoded as 20 lowercase hexadecimal characters. All IDs fit
within 32 bytes. Publication is atomic using one requestBroadcast with up to four
custom_json operations:

1. Root: global feed + own conversation + optional channel feed.
2. Reply or vote: conversation only.
3. Resnap: global feed + own conversation + original conversation + optional channel.
4. Channel: channel directory only.

These operations intentionally repeat the entire event payload, including the same
actor/UUID, under different routing IDs. A snap in a channel therefore creates three
on-chain records in one transaction, not three independent snaps. Readers deduplicate
by actor/UUID, not by the database operation ID. This is an application design choice
for HafSQL queries by custom JSON ID, not a Hive requirement: it increases stored data
and Resource Credit usage. Publishing a single canonical record would require a
different discovery/indexing strategy; deleting destinations alone would break current
feed, channel or conversation reads.

Read with HafSQL `/operations/custom_json/{id}?limit=...&start=...`. Validate app,
version, exact schema, UUIDs, signer, destination and references. Database operation
IDs are strings/BigInt; never Number. Process history in chain order, not client clock
order. The first signed event for a signer/UUID is immutable. Votes and channel
metadata changes use new event UUIDs. Ignore orphan, self-referencing, cross-channel
or causally invalid replies and reactions to unknown or future content.

Top-level feed pages are loaded incrementally. Full conversations are replayed before
enabling reaction/reply controls. Requests are limited to four concurrent public API
calls. v1 explicitly fails after 10,000 conversation operations or 5,000 channel
operations instead of silently returning partial reaction state. A dedicated indexer
would be appropriate beyond those bounds. There is no background auto-polling in v1;
Refresh reloads the feed, directory and visible conversations.

## Client behavior

- Confirmed local events are cached per publishing account (last 500) to bridge index
  lag; cancelled or failed operations never enter this cache.
- Account mutes and enabled author/word filters apply to the new feed. Muted authors,
  replies and quoted originals are hidden. Optional word filtering applies to feed roots.
- Shared snap and channel links work without being signed in. Publishing asks for login.
- Deep replies are rendered in bounded groups with Continue thread navigation.
- Translate uses the language selected in the UI menu.

Inspired by the interaction model of the user's reference app:
https://faireye-hive.github.io/microblog/
This is a distinct Nebulosa protocol; it does not import HiveLine's existing data.
API contract checked: https://rpc.mahdiyari.info/hafsql/openapi.json
