# ACO tenant: core_saas service not accessible

## Summary

This ACO tenant (environment id `GTrjmqHjaPNCGujUzQWdb7`, endpoint
`https://eu1.api.commerce.adobe.com/GTrjmqHjaPNCGujUzQWdb7/graphql`) serves its
**catalog service** correctly (`products`, `categories`, `productSearch`, ...),
but every field owned by its **core_saas service** — `storeConfig`, `customer`,
`customerGroup`, `commerceOptimizer`, native `cart`, etc. — fails with:

```json
{
  "errors": [{
    "message": "Tenant not found or not accessible",
    "extensions": { "code": "tenant_not_found", "service": "core_saas" }
  }]
}
```

This happens **regardless of headers sent** (`ac-view-id`, `ac-price-book-id`,
or none at all), and regardless of the query being valid — the error fires
before any schema/permission check, at tenant resolution for that service.

The `aem-boilerplate-commerce` boilerplate's dropins (`@dropins/storefront-*`)
assume core_saas is available — several of them call it unconditionally
during page load, with no guard for this case, which crashed the storefront
with uncaught console errors on every page. This doc records what we found
and what we changed in this repo to work around it, so it can be raised with
the ACO/Commerce team (is core_saas simply not provisioned for this tenant,
or is there a different endpoint/config needed for it?).

## Reproduction

Catalog service (works):

```bash
curl https://eu1.api.commerce.adobe.com/GTrjmqHjaPNCGujUzQWdb7/graphql \
  -H 'Content-Type: application/json' \
  -H 'ac-view-id: d31322a2-1493-4da6-86e3-c611b1382fc7' \
  -H 'ac-price-book-id: base-usd-general' \
  -d '{"query":"query { products(skus: [\"24-MG03\"]) { name sku } }"}'
# => {"data":{"products":[{"name":"Summit Watch","sku":"24-MG03"}]}}
```

core_saas service (fails identically with or without headers):

```bash
curl https://eu1.api.commerce.adobe.com/GTrjmqHjaPNCGujUzQWdb7/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { storeConfig { store_code base_currency_code } }"}'
# => {"errors":[{"message":"Tenant not found or not accessible","extensions":{"code":"tenant_not_found","service":"core_saas"}}]}

curl https://eu1.api.commerce.adobe.com/GTrjmqHjaPNCGujUzQWdb7/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { customer { email } }"}'
# => same "tenant_not_found"/"core_saas" error
```

We also tried the connector's own sandbox mesh
(`https://edge-sandbox-graph.adobe.io/api/e40a8973-4e88-45a6-85b8-84cf288c12ce/graphql`,
which stitches a native/Commerce-GraphQL-flavored schema alongside the
project's custom `connector*` fields) as an alternative `commerce-endpoint`.
Its core_saas fields (`storeConfig`, `customer`) fail with the exact same
`tenant_not_found`/`core_saas` error, and its catalog field additionally
fails on its own terms:

```bash
curl https://edge-sandbox-graph.adobe.io/api/e40a8973-4e88-45a6-85b8-84cf288c12ce/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { products(skus: [\"24-MG03\"]) { name sku } }"}'
# => {"errors":[{"message":"Missing catalog, header: Magento-Website-Code", ...}]}
```

So neither endpoint has a working core_saas for this project. Catalog only
works on the ACO tenant endpoint, not on the sandbox mesh.

## Where this hit the boilerplate, and what we did about it

All of these are dropins from `aem-boilerplate-commerce` calling core_saas
fields unconditionally, with no try/catch at the boilerplate's call site
(the dropins are third-party and weren't modified):

| Dropin / file | Core_saas call | Trigger | What we did |
|---|---|---|---|
| `@dropins/storefront-cart`, wired up in the (now removed) `scripts/initializers/cart.js` | `createGuestCart` mutation, auto-run on init | Every page load (global init) | Removed the native cart dropin entirely. All cart operations (`connectorCreateCart`/`connectorAddToCart`/`connectorGetCart`) now go through the connector's own mesh fields instead — see `scripts/connector-cart.js`. |
| `@dropins/storefront-cart` via `header.js`'s `publishShoppingCartViewEvent()` | reads the (never-populated) native cart's own state | Opening the header mini-cart | Removed the call; the mini-cart was rebuilt to render from the connector cart instead (`blocks/commerce-mini-cart/commerce-mini-cart.js`). |
| `@dropins/storefront-auth`, `scripts/initializers/auth.js` | `commerceOptimizer { priceBookId }` query, run when `adobeCommerceOptimizer: true` is passed to `initialize()` | Every page load + every auth state change (global init) | Stopped passing `adobeCommerceOptimizer` to the dropin (defaults to `false`). The static `ac-price-book-id` header in `config.json` already covers the default price book. |
| `@dropins/storefront-personalization`, `scripts/initializers/personalization.js` | `STORE_CONFIG_QUERY` (`storeConfig { share_active_segments, ... }`), run unconditionally on init | Every page load (global init) | Added a `.catch()` around the dropin's `initialize()` so the rejection doesn't propagate into the rest of eager init (which awaits this module). The dropin itself still can't do anything useful without core_saas — see below. |

## Not addressed (out of scope so far, lower priority)

These also call core_saas fields, but aren't in the global eager-init path —
they only run on pages/flows we haven't exercised yet in this project:

- `@dropins/storefront-wishlist` (`scripts/initializers/wishlist.js`, loaded on
  PDP/PLP/wishlist page for the wishlist-toggle button): `STORE_CONFIG_QUERY`,
  `GET_WISHLISTS_QUERY`, `GET_WISHLIST_BY_ID_QUERY`, and the
  add/remove/update-wishlist mutations are all core_saas. The wishlist toggle
  button itself may still render, but any actual server-synced wishlist
  read/write will fail the same way.
- `@dropins/storefront-account` (`scripts/initializers/account.js`)
- `@dropins/storefront-order` (`scripts/initializers/order.js`)
- `@dropins/storefront-checkout` (`scripts/initializers/checkout.js`)

Per this project's architecture, checkout isn't implemented in this
storefront at all (it redirects to an external transactional storefront via
`transactional_commerce_url`), so `checkout`/`account`/`order` are likely
unused in practice — but they'd hit the same wall if ever reached.

## Open question for the ACO/Commerce team

Is core_saas simply not provisioned for this tenant/environment (e.g. a
catalog-only plan or sandbox tier), or is there a different endpoint,
header, or account setting required to reach it? If core_saas is not meant
to be available here, the boilerplate dropins that assume it (cart, auth,
personalization, wishlist, account, order, checkout) need that documented as
an explicit unsupported/opt-out configuration, since right now they fail with
an unhandled, generically-worded error instead of degrading gracefully.
