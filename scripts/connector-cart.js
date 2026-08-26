import { events } from '@dropins/tools/event-bus.js';
import { CONNECTOR_FETCH_GRAPHQL } from './commerce.js';

/**
 * Cart operations for this storefront run against the API Mesh's
 * `connector*` fields, not the native Magento GraphQL schema the
 * @dropins/storefront-cart drop-in expects. Those runtime-action-backed
 * fields only carry sku/name/qty/price/rowTotal (no images, options,
 * coupons, or shipping), so the cart is implemented here directly instead
 * of through the drop-in.
 */

const CART_ID_STORAGE_KEY = 'CONNECTOR_CART_ID';

const CREATE_CART_MUTATION = `
  mutation CONNECTOR_CREATE_CART {
    connectorCreateCart {
      success
      error
      cartId
    }
  }
`;

const ADD_TO_CART_MUTATION = `
  mutation CONNECTOR_ADD_TO_CART($input: mutationInput_connectorAddToCart_input_Input!) {
    connectorAddToCart(input: $input) {
      success
      error
      item {
        sku
        name
        qty
        price
        rowTotal
      }
    }
  }
`;

const GET_CART_QUERY = `
  query CONNECTOR_GET_CART($input: queryInput_connectorGetCart_input_Input!) {
    connectorGetCart(input: $input) {
      success
      error
      cart {
        cartId
        currency
        itemCount
        grandTotal
        items {
          sku
          name
          qty
          price
          rowTotal
        }
      }
    }
  }
`;

function getStoredCartId() {
  return sessionStorage.getItem(CART_ID_STORAGE_KEY);
}

function storeCartId(cartId) {
  if (cartId) {
    sessionStorage.setItem(CART_ID_STORAGE_KEY, cartId);
  } else {
    sessionStorage.removeItem(CART_ID_STORAGE_KEY);
  }
}

/**
 * Adapts the minimal connector cart shape to the `cart/data` event payload
 * the rest of the storefront (e.g. the header cart counter) already listens
 * for, so those consumers keep working unchanged.
 */
function publishCartData(cart) {
  const payload = cart ? {
    id: cart.cartId,
    totalQuantity: cart.itemCount ?? 0,
    items: (cart.items ?? []).map((item) => ({
      uid: item.sku,
      sku: item.sku,
      name: item.name,
      quantity: item.qty,
    })),
  } : null;

  events.emit('cart/data', payload);
  // Full-fidelity payload (with price/rowTotal) for consumers that need more
  // than the adapted `cart/data` shape provides, e.g. the cart page itself.
  events.emit('connector-cart/data', cart);
}

async function createCart() {
  const { data, errors } = await CONNECTOR_FETCH_GRAPHQL.fetchGraphQl(CREATE_CART_MUTATION);
  const result = data?.connectorCreateCart;
  if (errors?.length || !result?.success) {
    throw new Error(result?.error || errors?.[0]?.message || 'Unable to create cart');
  }
  storeCartId(result.cartId);
  return result.cartId;
}

/**
 * Returns the current connector cart id, creating a new cart if none exists yet.
 * @returns {Promise<string>} The cart id
 */
export async function getOrCreateCartId() {
  return getStoredCartId() || createCart();
}

/**
 * Fetches the current cart from the mesh and publishes it on the event bus.
 * @returns {Promise<Object|null>} The connector cart, or null if no cart exists yet
 */
export async function refreshCart() {
  const cartId = getStoredCartId();
  if (!cartId) {
    publishCartData(null);
    return null;
  }

  const { data, errors } = await CONNECTOR_FETCH_GRAPHQL.fetchGraphQl(GET_CART_QUERY, {
    variables: { input: { cartId } },
  });
  const result = data?.connectorGetCart;
  if (errors?.length || !result?.success) {
    throw new Error(result?.error || errors?.[0]?.message || 'Unable to load cart');
  }

  publishCartData(result.cart);
  return result.cart;
}

/**
 * Adds a product to the connector cart and re-publishes the updated cart.
 * @param {string} sku - The product SKU
 * @param {number} [qty] - The quantity to add
 * @returns {Promise<Object>} The updated cart
 */
export async function addToCart(sku, qty = 1) {
  const cartId = await getOrCreateCartId();

  const { data, errors } = await CONNECTOR_FETCH_GRAPHQL.fetchGraphQl(ADD_TO_CART_MUTATION, {
    variables: { input: { cartId, sku, qty } },
  });
  const result = data?.connectorAddToCart;
  if (errors?.length || !result?.success) {
    throw new Error(result?.error || errors?.[0]?.message || 'Unable to add item to cart');
  }

  const cart = await refreshCart();
  events.emit('cart/product/added');
  return cart;
}

/**
 * Formats a price amount as a localized currency string.
 * @param {number} amount - The price amount
 * @param {string} [currency] - The ISO currency code
 * @returns {string} The formatted price
 */
export function formatPrice(amount, currency) {
  return new Intl.NumberFormat(document.documentElement.lang || 'en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount ?? 0);
}
