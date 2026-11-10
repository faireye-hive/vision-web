# Community categories and flairs

Communities uses Gallery by default, with an independent `nebulosa_communities_layout` preference. Native member titles are displayed next to the account name using `author_title`, with `bridge.get_community_context` as a fallback. See the [Hive Bridge documentation](https://developers.hive.io/apidefinitions/bridge.html).

## Community configuration

Owners and admins open **Community settings** on the community feed or information card. They configure 1–30 categories, 0–30 post flairs, and 0–30 featured subtags. IDs remain stable across label changes. Without configuration, Nebulosa provides its standard categories and five optional flairs. Featured subtags and configured categories appear as filters; only matching metadata tags are used to filter community posts.

A single Posting-key-signed `custom_json`, ID `neb.community.<hive-account>`, stores the complete configuration:

```json
{"app":"nebulosa-community","version":1,"type":"settings","actor":"admin-account","community":"hive-123456","settings":{"categories":[{"id":"art","label":"Art"}],"flairs":[{"id":"question","label":"Question"}],"subtags":["painting"]}}
```

Readers query HafSQL `/operations/custom_json/{id}`, page backwards using string/BigInt operation IDs, verify the actual operation signer, validate payload bounds and accept the newest authorized operation. Network errors remain errors and never become an empty configuration. Roles are checked against the current Hive community team, so revoked admins' configuration events are no longer authoritative. A current owner/admin can republish the configuration after a team change.

## Publishing

General Write starts on Personal Blog. The Write button inside a community explicitly selects that community. Choosing a community reveals a required category and optional post flair. Before Keychain opens, the current community configuration is loaded and validated again. Category and community tags are reserved ahead of other tags, so tag truncation cannot remove the category.

The initial category/flair is stored atomically with the post in `json_metadata.nebulosa.community`:

```json
{"name":"hive-123456","category":"art","flair":"question"}
```

Categories are required by the Nebulosa publishing flow; Hive posts created through other clients continue to display without a Nebulosa category.

## Changing and moderating post flairs

The author opens **Post flair** on a card or in Reader. Current owners/admins/mods see **Moderate flair** and can remove it. Updates use one Posting-key `custom_json` with ID `neb.flair.` followed by the first 11 bytes of SHA-256(`author/permlink`) as hex (32 bytes total).

```json
{"app":"nebulosa-community","version":1,"type":"flair","actor":"alice","community":"hive-123456","author":"alice","permlink":"my-post","flair":"question"}
```

Removal uses `flair: null`. Author updates and moderator removals are replayed in operation order, with actual signer and post identity checks. A removal overrides initial metadata, including on reload. An author can subsequently choose an available flair again. Moderators cannot assign a different flair on behalf of the author. Community membership is verified against the canonical post before broadcasting. These custom JSON features are interpreted by Nebulosa; they do not change other Hive clients' moderation behavior.

Successful broadcasts update the in-memory view while HafSQL indexes them. Other clients and reloads depend on public indexer availability and indexing delay. Reads are cached for 60 seconds; pending requests are shared. No writes occur until the user invokes the save action and Keychain signs it.
