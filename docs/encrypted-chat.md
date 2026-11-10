# Nebulosa memo chat v1

Entry points: `/chat`, `/chat?to=<account>`, account menu, and the Message button on
profiles. Account moderation hides muted conversations. The client polls the mailbox
while this page is open and visible, with older-message pagination.

## Encryption and publication

1. Validate the recipient exists and has a public memo key.
2. Generate a random UUID and serialize `{app:'nebulosa-chat',version:1,id,from,to,body}`.
3. Call Keychain `requestEncodeMessage(from,to,'#'+plaintext,'Memo',callback)`.
4. Accept only a successful encrypted Base58 memo (`#` prefix). Never fall back to
   publishing the plaintext. If account/page changes before publication, abort.
5. Broadcast two custom_json operations together using Keychain requestBroadcast
   with **Posting** authority. Both contain the same encrypted envelope, addressed
   to `nebulosa.chat.<sender>` and `nebulosa.chat.<recipient>`.

Envelope:

```json
{"app":"nebulosa-chat","version":1,"id":"12345678-1234-1234-1234-123456789abc","from":"alice","to":"bob","memo":"#<encrypted memo>"}
```

There is no `body` or plaintext preview in the public envelope. Each ID is at most
30 ASCII bytes for a 16-character Hive username. Reject JSON exceeding 8,192 bytes;
plaintext messages are limited to 3,000 UTF-8 bytes before encryption.

## Retrieval and decryption

Use HafSQL `/operations/custom_json/nebulosa.chat.<viewer>?limit=100&start=<cursor>`.
Keep operation IDs as strings/BigInt. Accept only envelopes whose signer matches
`from`, whose mailbox ID matches the viewer, and whose viewer is a participant.
Reject unsupported schemas and envelopes carrying extra plaintext fields. Deduplicate
by sender and UUID; replace local pending ciphertext with its indexed chain operation.

Unlock explicitly via `requestVerifyKey(viewer,memo,'Memo',callback)`. The decoded
inner app, version, UUID and participants must match the signed public envelope.
Render the body as plain React text, not HTML. Account or conversation switches discard
unlocked state; “Lock messages” clears visible plaintext immediately.

The application never receives a private key. Decrypted content and drafts stay in
page memory, not localStorage. The last 200 successfully sent encrypted envelopes may
be cached per account to bridge HafSQL indexing delay. Local cache is a convenience,
not proof of publication; the indexer supplies the signed history after confirmation.

## Privacy properties and limits

Standard Hive memo encryption permits both sender and recipient to decrypt using their
corresponding private memo keys. This is not recipient-only secrecy. Accounts, activity,
message timing, ciphertext length and the encrypted ciphertext are public and permanent.
There is no message deletion, forward secrecy, key recovery or guarantee that a user
retains the old memo keys needed after a rotation. Existing encrypted history can be
read by anyone who obtains a participant’s relevant memo private key.

Indexing can lag publication. There are no server-side inboxes, delivery/read receipts,
background push notifications, or group chats in v1. Cancelled encryption or publication
is surfaced without claiming delivery; retry is explicit.

Keychain API source checked:
https://github.com/hive-keychain/hive-keychain-extension/blob/master/documentation/README.md
https://github.com/hive-keychain/keychain-sdk
HafSQL API: https://rpc.mahdiyari.info/hafsql/openapi.json
