# Commerce Mini Cart Block

## Overview

The Commerce Mini Cart block renders a read-only cart summary (line items and order total) in the header's cart dropdown, sourced from the ACO connector's mesh GraphQL fields (`connectorGetCart`) rather than the native Magento Cart GraphQL schema. Because that connector schema only carries `sku`/`name`/`qty`/`price`/`rowTotal`, this block does not use `@dropins/storefront-cart`'s `MiniCart` container and does not support product images, configurable options, quantity updates, item removal, coupons, gift cards, or shipping estimation. See also the [Commerce Cart block](../commerce-cart/README.md), which renders the full cart page from the same connector data.

## Integration

### Block Configuration

| Configuration Key | Type | Default | Description | Required | Side Effects |
|-------------------|------|---------|-------------|----------|--------------|
| `start-shopping-url` | string | `''` | URL for "Start Shopping" button when cart is empty | No | Sets destination for empty cart CTA |
| `cart-url` | string | `''` | URL for cart page navigation | No | Sets destination for cart navigation |
| `checkout-url` | string | `''` | URL for checkout navigation | No | Sets destination for checkout action |

<!-- ### URL Parameters

No URL parameters directly affect this block's behavior. -->

<!-- ### Local Storage

No localStorage keys are used by this block. -->

### Events

#### Event Listeners

- `events.on('connector-cart/data', callback)` - Listens for connector cart updates (e.g. after an add-to-cart elsewhere on the page) and re-renders the summary
- `events.on('cart/product/added', callback)` - Listens for successful add-to-cart events to show a transient "added to cart" message

## Behavior Patterns

### Page Context Detection

- **Empty Cart**: When the connector cart has no items, shows empty cart message with start shopping CTA
- **Populated Cart**: When cart has items, shows a compact line-item list (name, qty, subtotal) and the order total

### User Interaction Flows

1. **Cart Display**: On decoration, the block fetches the current cart from the connector mesh (`scripts/connector-cart.js`) and renders it
2. **Live Updates**: Adding a product anywhere on the site (PDP, PLP, recommendations) refreshes this summary via the `connector-cart/data` event
3. **Navigation**: Users can navigate to the full cart page or checkout via the configured URLs
4. **Empty Cart Handling**: When cart is empty, shows start shopping CTA

### Error Handling

- **Cart Data Errors**: If the connector mesh request fails, shows an inline error notification and treats the cart as empty
