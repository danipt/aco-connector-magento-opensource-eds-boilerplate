import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '@dropins/storefront-auth/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Core)
  setEndpoint(CORE_FETCH_GRAPHQL);

  // Fetch placeholders
  const labels = await fetchPlaceholders('placeholders/auth.json');
  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  // Initialize auth. Not passing adobeCommerceOptimizer: this tenant's
  // core_saas service (customer/store data) isn't provisioned - only its
  // catalog service is - so the dropin's commerceOptimizer/priceBookId
  // lookup always fails with "Tenant not found or not accessible". The
  // static ac-price-book-id header in config.json covers the default case.
  return initializers.mountImmediately(initialize, { langDefinitions });
})();
