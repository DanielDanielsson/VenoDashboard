import { getContractBundle } from '@/lib/contracts/fetch-contracts';
import { groupEndpoints, normalizeEndpoints } from '@/lib/contracts/normalize';

export async function getDocsData() {
  const bundle = await getContractBundle();
  const endpoints = normalizeEndpoints(bundle.openApi, bundle.agentContext);
  const groupedEndpoints = groupEndpoints(endpoints);

  return {
    ...bundle,
    endpoints,
    groupedEndpoints,
    stale: bundle.source.openApi === 'snapshot' || bundle.source.agentContext === 'snapshot'
  };
}
