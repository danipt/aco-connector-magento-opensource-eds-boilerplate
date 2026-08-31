import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '@dropins/storefront-personalization/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL } from '../commerce.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Catalog Service)
  setEndpoint(CORE_FETCH_GRAPHQL);

  // Initialize personalization. This tenant's core_saas service (storeConfig,
  // customerGroup, customerSegments) isn't provisioned, so this always
  // rejects - caught here so it doesn't break the rest of eager init, which
  // awaits this module.
  return initializers.mountImmediately(initialize, {}).catch((error) => {
    console.error('Error initializing personalization dropin:', error);
  });
})();
