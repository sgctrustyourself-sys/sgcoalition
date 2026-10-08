import React, { useCallback, useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { motion } from 'motion/react';
import { Tooltip } from 'react-tooltip';

// US TopoJSON (Standard Albers USA projection).
//
// This is fetched here rather than handed to <Geographies geography={url}>, for
// two reasons. react-simple-maps swallows a failed fetch into a console.log and
// then draws nothing, so a blocked or broken request looked exactly like a
// country with no orders; and a URL buried in a component prop escaped the
// client-fetch CSP guard in tests/clientFetchCsp.test.ts, which scans fetch()
// call sites. Fetching it ourselves makes the failure a state we own.
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

type GeometryState =
    | { status: 'loading' }
    | { status: 'ready'; topology: Record<string, any> }
    | { status: 'unavailable'; reason: string };

const describeGeometryFailure = (error: unknown) =>
    error instanceof Error && error.message ? error.message : 'the request did not complete';

interface StateData {
    id: string; // State Code (e.g., 'TX', 'CA')
    name: string;
    count: number;
    lastActive: string; // '2m ago'
}

interface LiveMapProps {
    data: StateData[];
    timeRange: '24h' | '7d' | '30d' | '90d' | 'all';
}

const RANGE_LABELS: Record<LiveMapProps['timeRange'], string> = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    'all': 'All time',
};

const LiveMap: React.FC<LiveMapProps> = ({ data, timeRange }) => {
    // Color Scale: Dark to Bright Purple based on order count
    const colorScale = scaleLinear<string>()
        .domain([0, Math.max(...data.map((d) => d.count), 1)])
        .range(['#1f2937', '#a855f7']); // Gray-800 to Purple-500

    // One owner for the geometry, so "could not load" is a state the UI can show
    // instead of nothing at all.
    const [geometry, setGeometry] = useState<GeometryState>({ status: 'loading' });

    const loadGeometry = useCallback(async (signal?: AbortSignal) => {
        setGeometry({ status: 'loading' });
        try {
            const response = await fetch(GEO_URL, { signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            setGeometry({ status: 'ready', topology: await response.json() });
        } catch (error) {
            if (signal?.aborted) return; // unmounted, or a superseded retry
            setGeometry({ status: 'unavailable', reason: describeGeometryFailure(error) });
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void loadGeometry(controller.signal);
        return () => controller.abort();
    }, [loadGeometry]);

    return (
        <div className="relative h-full min-h-[400px] w-full overflow-hidden rounded-3xl border border-gray-800 bg-black shadow-2xl">
            {geometry.status === 'loading' && (
                <div className="flex h-full min-h-[400px] items-center justify-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Loading order map…</p>
                </div>
            )}

            {/* Named failure state. Without it a failed geometry load renders as a
                country with no orders — which is precisely how this went unnoticed
                while the CSP blocked the request. */}
            {geometry.status === 'unavailable' && (
                <div
                    role="status"
                    className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-6 text-center"
                >
                    <span className="inline-flex items-center border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Map unavailable
                    </span>
                    <p className="max-w-sm text-xs font-medium leading-relaxed text-gray-500">
                        The state map could not load ({geometry.reason}). Order counts by state are still listed beside
                        it.
                    </p>
                    <button
                        type="button"
                        onClick={() => void loadGeometry()}
                        className="border border-white/20 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-black"
                    >
                        Try again
                    </button>
                </div>
            )}

            {geometry.status === 'ready' && (
                /* Map Container */
                <ComposableMap projection="geoAlbersUsa" className="h-full w-full">
                    <Geographies geography={geometry.topology}>
                        {({ geographies }) =>
                            geographies.map((geo) => {
                                // Find data for this state.
                                // Note: us-atlas uses names or FIPS. We match by name for simplicity.
                                // In prod, use FIPS codes for robustness.
                                const stateName = geo.properties.name;
                                const stateData = data.find((d) => d.name === stateName);
                                const count = stateData ? stateData.count : 0;

                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={stateData ? colorScale(count) : '#1f2937'}
                                        stroke="#000"
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: 'none', transition: 'all 0.3s' },
                                            hover: { fill: '#d8b4fe', outline: 'none', cursor: 'pointer' },
                                            pressed: { outline: 'none' },
                                        }}
                                        data-tooltip-id="map-tooltip"
                                        data-tooltip-content={`${stateName}: ${count} Orders${stateData?.lastActive ? ` - Last: ${stateData.lastActive}` : ''}`}
                                    />
                                );
                            })
                        }
                    </Geographies>

                    {/* Pulse Markers for 'hot' states (arbitrary threshold for demo) */}
                    {data
                        .filter((d) => d.count > 5)
                        .map((d) => (
                            <Marker key={d.id} coordinates={getStateCoordinates(d.id)}>
                                <circle r={4} fill="#fff" />
                                <motion.circle
                                    r={10}
                                    fill="none"
                                    stroke="#fff"
                                    strokeWidth={2}
                                    initial={{ opacity: 1, scale: 0 }}
                                    animate={{ opacity: 0, scale: 2 }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'easeOut',
                                    }}
                                />
                            </Marker>
                        ))}
                </ComposableMap>
            )}

            {/* Floating Tooltip — only meaningful while states are actually drawn */}
            {geometry.status === 'ready' && (
                <Tooltip
                    id="map-tooltip"
                    className="z-50 !rounded-xl !border !border-gray-700 !bg-gray-900 !px-4 !py-2 !text-xs !font-bold !uppercase !tracking-widest !text-white !opacity-100 !shadow-xl"
                />
            )}

            {/* Time-Range Badge */}
            <div className="absolute top-4 left-4 z-10">
                <span className="inline-block rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 backdrop-blur-sm">
                    {RANGE_LABELS[timeRange]}
                </span>
            </div>

            {/* Legend / Info — it explains a colour scale, so it belongs with the map */}
            {geometry.status === 'ready' && (
                <div className="absolute bottom-6 right-6 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full bg-gray-800"></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Low</span>
                    </div>
                    <div className="h-1 w-16 rounded-full bg-gradient-to-r from-gray-800 to-purple-500"></div>
                    <div className="flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full bg-purple-500 shadow-[0_0_10px_purple]"></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">High</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper: Approximate centroids for major states for demo markers.
// In a real app, use a proper centroid library or the geojson properties.
function getStateCoordinates(id: string): [number, number] {
    const coords: Record<string, [number, number]> = {
        CA: [-119.4179, 36.7783],
        TX: [-99.9018, 31.9686],
        NY: [-74.006, 40.7128],
        FL: [-81.5158, 27.6648],
        WA: [-120.7401, 47.7511],
        // Add more as needed for the demo markers
    };
    return coords[id] || [-98.5795, 39.8283]; // Default to center US
}

export default LiveMap;
