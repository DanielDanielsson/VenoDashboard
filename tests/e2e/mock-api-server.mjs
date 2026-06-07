import { createServer } from 'node:http';

const port = Number.parseInt(process.env.PLAYWRIGHT_MOCK_API_PORT || '3101', 10);
const now = '2026-06-07T10:00:00.000Z';

const panel = (id, title, group, options = {}) => ({
  kind: 'Panel',
  spec: {
    id,
    title,
    queries: {
      kind: 'QueryGroup',
      spec: {
        queries: [],
        transformations: [],
        queryOptions: {},
      },
    },
    vizConfig: {
      kind: 'VizConfig',
      group,
      version: 'v1',
      spec: {
        options,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      },
    },
  },
});

const gridItem = (name, x, y, width, height) => ({
  kind: 'GridLayoutItem',
  spec: {
    x,
    y,
    width,
    height,
    element: {
      kind: 'ElementReference',
      name,
    },
  },
});

const timeRangeDashboard = {
  schemaVersion: 'veno.dashboard.v1',
  kind: 'Dashboard',
  spec: {
    uid: 'statistics',
    title: 'Statistics',
    timeSettings: {
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h'],
    },
    elements: {
      'panel-time-in-range': panel(103, 'Time in Range', 'veno.time-in-range', { layout: 'statistics' }),
      'panel-glucose-timeline': panel(104, 'Glucose Timeline', 'veno.glucose-timeline'),
    },
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [
          gridItem('panel-time-in-range', 0, 0, 4, 6),
          gridItem('panel-glucose-timeline', 0, 6, 12, 12),
        ],
      },
    },
  },
};

const liveDashboard = {
  schemaVersion: 'veno.dashboard.v1',
  kind: 'Dashboard',
  spec: {
    uid: 'overview',
    title: 'Overview',
    elements: {},
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [],
      },
    },
  },
};

const dashboards = [
  {
    uid: 'overview',
    title: 'Overview',
    description: null,
    icon: 'dashboard-grid',
    defaultTimeRange: null,
    type: 'live',
    version: 1,
    updatedAt: now,
    dashboard: liveDashboard,
  },
  {
    uid: 'statistics',
    title: 'Statistics',
    description: {
      version: 1,
      blocks: [
        {
          id: 'fixture-description',
          type: 'paragraph',
          spans: [{ text: 'Fixture time range dashboard.' }],
        },
      ],
    },
    icon: 'activity',
    defaultTimeRange: '3d',
    type: 'timeRange',
    version: 2,
    updatedAt: now,
    dashboard: timeRangeDashboard,
  },
];

const preferences = {
  homeDashboardUid: 'statistics',
  pinnedDashboardUids: ['statistics'],
  dashboardOrderUids: ['statistics', 'overview'],
};

const emptyHistory = (requestUrl) => ({
  items: [],
  meta: {
    from: requestUrl.searchParams.get('from') || new Date(Date.parse(now) - 72 * 60 * 60 * 1000).toISOString(),
    to: requestUrl.searchParams.get('to') || now,
    limit: Number.parseInt(requestUrl.searchParams.get('limit') || '1000', 10),
    returned: 0,
  },
});

const json = (response, status, body) => {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
};

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `127.0.0.1:${port}`}`);
  const pathname = requestUrl.pathname;

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'authorization,content-type,x-pulse-actor-id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Origin': '*',
    });
    response.end();
    return;
  }

  if (pathname === '/api/status') {
    json(response, 200, {
      generatedAt: now,
      official: { connected: true, latestReading: null, stable: true, sourceToDbLagMinutes: null, latestReadingAgeMinutes: null },
      share: { connected: true, latestReading: null, stable: true, sourceToDbLagMinutes: null, latestReadingAgeMinutes: null },
      tandem: { connected: true, latestReading: null, stable: true, sourceToDbLagMinutes: null, latestReadingAgeMinutes: null },
      health: { connected: true, latestReading: null, stable: true, sourceToDbLagMinutes: null, latestReadingAgeMinutes: null },
    });
    return;
  }

  if (pathname === '/api/v1/dashboard-preferences') {
    json(response, 200, { preferences });
    return;
  }

  if (pathname === '/api/v1/dashboards') {
    json(response, 200, { dashboards });
    return;
  }

  const dashboardMatch = pathname.match(/^\/api\/v1\/dashboards\/([^/]+)$/);
  if (dashboardMatch) {
    const dashboard = dashboards.find((entry) => entry.uid === decodeURIComponent(dashboardMatch[1]));
    json(response, dashboard ? 200 : 404, dashboard ? { dashboard } : { error: { message: 'Dashboard not found' } });
    return;
  }

  if (
    pathname === '/api/v1/glucose/history' ||
    pathname === '/api/v1/share/glucose/history' ||
    pathname === '/api/v1/tandem/basal/history' ||
    pathname === '/api/v1/tandem/events/history'
  ) {
    json(response, 200, emptyHistory(requestUrl));
    return;
  }

  if (pathname === '/api/v1/glucose/latest' || pathname === '/api/v1/share/glucose/latest') {
    json(response, 200, { reading: null });
    return;
  }

  if (pathname === '/api/admin/health/steps' || pathname === '/api/admin/health/workouts' || pathname === '/api/v1/notes') {
    json(response, 200, { items: [] });
    return;
  }

  if (pathname === '/api/v1/timeline/updates') {
    json(response, 200, {
      meta: {
        since: requestUrl.searchParams.get('since') || now,
        latestRevision: null,
        newCount: 0,
      },
    });
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: { message: `Unhandled fixture route ${pathname}` } }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`E2E fixture API listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
