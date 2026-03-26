'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  BaseEdge,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  getBezierPath,
  Handle,
  MarkerType,
} from '@xyflow/react';
import { twMerge } from 'tailwind-merge';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { Icon } from '@ui/base/Icon';
import { DataFreshnessLight } from '@ui/components/DataFreshnessLight/DataFreshnessLight';
import type { ConnectionMapEdge, ConnectionMapNode, ConnectionMapSnapshot, ConnectionNodeState } from '@/lib/dashboard/connection-map';

interface ConnectionsMapPanelProps {
  initialSnapshot: ConnectionMapSnapshot;
}

interface ConnectionGraphNodeData extends Record<string, unknown>, ConnectionMapNode {}

interface ConnectionGraphEdgeData extends Record<string, unknown> {
  state: ConnectionNodeState;
  direction: ConnectionMapEdge['direction'];
}

type ConnectionFlowNode = Node<ConnectionGraphNodeData, 'connectionNode'>;
type ConnectionFlowEdge = Edge<ConnectionGraphEdgeData, 'connectionEdge'>;

const POLL_INTERVAL_MS = 20_000;
const DEFAULT_NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  official: { x: 36, y: 40 },
  share: { x: 36, y: 195 },
  tandem: { x: 36, y: 350 },
  healthkit: { x: 920, y: 545 },
  'veno-api': { x: 460, y: 195 },
  'veno-dashboard': { x: 460, y: 455 },
  venobar: { x: 920, y: 120 },
  'ios-app': { x: 920, y: 390 },
  'philips-hue': { x: 1290, y: 390 },
};

const HIDDEN_HANDLE_CLASS = '!h-1 !w-1 !border-0 !bg-transparent !opacity-0';

function getStateLabel(state: ConnectionNodeState): string {
  switch (state) {
    case 'live':
      return 'Live';
    case 'stale':
      return 'Delayed';
    case 'fault':
      return 'Fault';
    default:
      return 'Idle';
  }
}

function getFreshnessTone(state: ConnectionNodeState): 'fresh' | 'aging' | 'stale' | 'inactive' {
  switch (state) {
    case 'live':
      return 'fresh';
    case 'stale':
      return 'aging';
    case 'fault':
      return 'stale';
    default:
      return 'inactive';
  }
}

function showsLatestActivity(nodeId: string): boolean {
  return nodeId !== 'veno-api' && nodeId !== 'veno-dashboard';
}

function getNodeTone(state: ConnectionNodeState): {
  ring: string;
  chip: string;
  text: string;
} {
  switch (state) {
    case 'live':
      return {
        ring: 'border-accent/45',
        chip: 'bg-success-soft text-success',
        text: 'text-accent',
      };
    case 'stale':
      return {
        ring: 'border-warning/35',
        chip: 'bg-warning-soft text-warning',
        text: 'text-warning',
      };
    case 'fault':
      return {
        ring: 'border-error/40',
        chip: 'bg-error-soft text-error',
        text: 'text-error',
      };
    default:
      return {
        ring: 'border-border',
        chip: 'bg-surface text-text-soft',
        text: 'text-text-soft',
      };
  }
}

function getEdgeClass(state: ConnectionNodeState): string {
  switch (state) {
    case 'live':
      return 'connection-map-edge-live';
    case 'stale':
      return 'connection-map-edge-stale';
    case 'fault':
      return 'connection-map-edge-fault';
    default:
      return 'connection-map-edge-inactive';
  }
}

function getMarkerColor(state: ConnectionNodeState): string {
  switch (state) {
    case 'live':
      return 'var(--color-connection-map-line-live)';
    case 'stale':
      return 'var(--color-connection-map-line-stale)';
    case 'fault':
      return 'var(--color-connection-map-line-fault)';
    default:
      return 'var(--color-connection-map-line)';
  }
}

function formatUpdatedAt(updatedAt: string): string {
  return new Date(updatedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getHandlesForEdge(edge: ConnectionMapEdge): Pick<Edge<ConnectionGraphEdgeData>, 'sourceHandle' | 'targetHandle'> {
  switch (edge.id) {
    case 'official-api':
    case 'share-api':
    case 'tandem-api':
      return { sourceHandle: 'source-right', targetHandle: 'target-left' };
    case 'healthkit-ios':
      return { sourceHandle: 'source-top', targetHandle: 'target-bottom' };
    case 'api-dashboard':
      return { sourceHandle: 'source-bottom', targetHandle: 'target-top' };
    case 'dashboard-api':
      return { sourceHandle: 'source-top', targetHandle: 'target-bottom' };
    case 'api-venobar':
    case 'api-ios':
    case 'ios-hue':
      return { sourceHandle: 'source-right', targetHandle: 'target-left' };
    case 'venobar-api':
    case 'ios-api':
      return { sourceHandle: 'source-left', targetHandle: 'target-right' };
    default:
      return { sourceHandle: 'source-right', targetHandle: 'target-left' };
  }
}

function getEdgeOffset(edgeId: string): { x: number; y: number } {
  switch (edgeId) {
    case 'api-dashboard':
      return { x: -18, y: 0 };
    case 'dashboard-api':
      return { x: 18, y: 0 };
    case 'api-venobar':
    case 'api-ios':
      return { x: 0, y: -14 };
    case 'venobar-api':
    case 'ios-api':
      return { x: 0, y: 14 };
    default:
      return { x: 0, y: 0 };
  }
}

function buildFlowNodes(snapshot: ConnectionMapSnapshot, existingNodes?: ConnectionFlowNode[]): ConnectionFlowNode[] {
  return snapshot.nodes.map((node) => {
    const existingNode = existingNodes?.find((candidate) => candidate.id === node.id);

    return {
      id: node.id,
      type: 'connectionNode',
      draggable: true,
      selectable: false,
      position: existingNode?.position ?? DEFAULT_NODE_POSITIONS[node.id] ?? { x: 0, y: 0 },
      data: { ...node },
    };
  });
}

function buildFlowEdges(snapshot: ConnectionMapSnapshot): ConnectionFlowEdge[] {
  return snapshot.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'connectionEdge',
    selectable: false,
    animated: false,
    zIndex: 0,
    data: {
      state: edge.state,
      direction: edge.direction,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: getMarkerColor(edge.state),
      width: 18,
      height: 18,
    },
    ...getHandlesForEdge(edge),
  }));
}

function ConnectionNodeCard({ data }: NodeProps<ConnectionFlowNode>) {
  const tone = getNodeTone(data.state);

  return (
    <div
      className={twMerge(
        'connection-map-node-card w-[320px] rounded border bg-connection-map-node-bg px-5 py-4',
        tone.ring,
      )}
    >
      <Handle id="target-left" type="target" position={Position.Left} className={HIDDEN_HANDLE_CLASS} />
      <Handle id="source-left" type="source" position={Position.Left} className={HIDDEN_HANDLE_CLASS} />
      <Handle id="target-right" type="target" position={Position.Right} className={HIDDEN_HANDLE_CLASS} />
      <Handle id="source-right" type="source" position={Position.Right} className={HIDDEN_HANDLE_CLASS} />
      <Handle id="target-top" type="target" position={Position.Top} className={HIDDEN_HANDLE_CLASS} />
      <Handle id="source-top" type="source" position={Position.Top} className={HIDDEN_HANDLE_CLASS} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={HIDDEN_HANDLE_CLASS} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={HIDDEN_HANDLE_CLASS} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={twMerge(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded border border-border bg-surface',
              tone.text,
            )}
          >
            <Icon icon={data.icon} twStyles={data.icon === 'veno-logo' ? 'h-7 w-7' : 'h-6 w-6'} />
          </div>
          <div className="min-w-0">
            <p className="body_text_strong whitespace-nowrap text-text">{data.label}</p>
            <p className="ui_caption text-text-dim">{data.detail}</p>
          </div>
        </div>
        <span className={twMerge('ui_micro_label rounded-full px-2 py-1', tone.chip)}>
          {getStateLabel(data.state)}
        </span>
      </div>
      {showsLatestActivity(data.id) ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="ui_caption text-text-soft">Latest activity</span>
          <DataFreshnessLight
            timestamp={data.latestActivityAt}
            fallbackLabel={data.ageLabel ?? 'No signal yet'}
            status={getFreshnessTone(data.state)}
            autoUpdateEventName={null}
          />
        </div>
      ) : null}
    </div>
  );
}

function ConnectionMapFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<ConnectionFlowEdge>) {
  const offset = getEdgeOffset(id);
  const [path] = getBezierPath({
    sourceX: sourceX + offset.x,
    sourceY: sourceY + offset.y,
    targetX: targetX + offset.x,
    targetY: targetY + offset.y,
    sourcePosition,
    targetPosition,
    curvature: 0.28,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      className={twMerge('connection-map-edge', getEdgeClass(data?.state ?? 'inactive'))}
      markerEnd={markerEnd}
    />
  );
}

const nodeTypes = {
  connectionNode: ConnectionNodeCard,
};

const edgeTypes = {
  connectionEdge: ConnectionMapFlowEdge,
};

function ConnectionsMapCanvas({
  initialSnapshot,
}: ConnectionsMapPanelProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasRefreshError, setHasRefreshError] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<ConnectionFlowNode>(buildFlowNodes(initialSnapshot));
  const [edges, setEdges] = useEdgesState<ConnectionFlowEdge>(buildFlowEdges(initialSnapshot));

  useEffect(() => {
    setNodes((currentNodes) => buildFlowNodes(snapshot, currentNodes));
    setEdges(buildFlowEdges(snapshot));
  }, [setEdges, setNodes, snapshot]);

  useEffect(() => {
    let cancelled = false;

    async function refreshConnections() {
      setIsRefreshing(true);
      try {
        const response = await fetch('/api/dashboard/connections', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to refresh connections');
        }

        const nextSnapshot = (await response.json()) as ConnectionMapSnapshot;
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setHasRefreshError(false);
        }
      } catch {
        if (!cancelled) {
          setHasRefreshError(true);
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    const timer = window.setInterval(refreshConnections, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const liveCount = useMemo(
    () => snapshot.nodes.filter((node) => node.state === 'live').length,
    [snapshot.nodes],
  );

  return (
    <DashboardPanel
      title="Connections"
      headerRight={(
        <div className="flex items-center gap-3">
          <span className={twMerge('ui_caption_strong', hasRefreshError ? 'text-error' : 'text-text-dim')}>
            {hasRefreshError ? 'Refresh delayed' : `${liveCount} live`}
          </span>
          <span className="ui_caption text-text-soft">
            {isRefreshing ? 'Syncing…' : formatUpdatedAt(snapshot.updatedAt)}
          </span>
        </div>
      )}
    >
      <div className="connection-map-flow-shell">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={() => {}}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
          minZoom={0.45}
          maxZoom={1.4}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ zIndex: 0 }}
          className="connection-map-flow"
        >
          <Background gap={28} size={1} color="var(--grid-line)" />
        </ReactFlow>
      </div>
    </DashboardPanel>
  );
}

export function ConnectionsMapPanel(props: ConnectionsMapPanelProps) {
  return (
    <ReactFlowProvider>
      <ConnectionsMapCanvas {...props} />
    </ReactFlowProvider>
  );
}
