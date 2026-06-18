import { DashboardErrorState } from '@ui/components/DashboardErrorState/DashboardErrorState';
import { ApiKeysManager } from '@ui/compositions/ApiKeysManager/ApiKeysManager';
import { requireOwnerSession } from '@/lib/auth';
import { VenoApiClientError, listApiKeys } from '@/lib/veno-api/client';
import { isSystemApiKeyName } from '@/lib/veno-api/key-visibility';

export default async function DashboardApiKeysPage() {
  await requireOwnerSession();
  let items = null;
  let message: string | null = null;

  try {
    const response = await listApiKeys();
    items = response.items.filter((item) => !isSystemApiKeyName(item.name));
  } catch (error) {
    message =
      error instanceof VenoApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to load API keys';
  }

  if (!items) {
    return <DashboardErrorState title="API keys unavailable" message={message || 'Failed to load API keys'} />;
  }

  return <ApiKeysManager initialItems={items} />;
}
